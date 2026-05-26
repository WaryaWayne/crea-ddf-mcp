import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { SelectedFields } from "drizzle-orm/pg-core";
import { DdfDatabase } from "crea-ddf/db";
import { Effect } from "effect";
import { toJsonObject } from "./json.js";
import {
  TableQueryResultSchema,
  type FilterInput,
  type GetRowInput,
  type OrderByInput,
  type TableQueryInput,
  type TableQueryResult,
} from "./read-schemas.js";
import { decodeUnknownOrThrow } from "../mcp/effect-decode.js";
import {
  columnsForTable,
  tableDefinition,
  tableInfo,
  type DbColumnMap,
  type DbTableName,
} from "../sdk/fields.js";

type ScalarValue = string | number | boolean | null;

const DEFAULT_LIMIT = 25;
const DEFAULT_OFFSET = 0;

const isScalarValue = (value: unknown): value is ScalarValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const validFieldsMessage = (table: DbTableName, columns: DbColumnMap) =>
  `Valid fields for ${table}: ${Object.keys(columns).sort().join(", ")}`;

const columnForField = (
  table: DbTableName,
  columns: DbColumnMap,
  field: string,
) => {
  const normalized = field.trim();
  const column = columns[normalized];

  if (column === undefined) {
    throw new Error(
      `Unknown field "${field}" on table "${table}". ${validFieldsMessage(
        table,
        columns,
      )}`,
    );
  }

  return { field: normalized, column };
};

const defaultFieldsForTable = (table: DbTableName, columns: DbColumnMap) => {
  const fields = Object.keys(columns)
    .filter((field) => field !== "raw")
    .sort();

  if (fields.length === 0) {
    throw new Error(`Table "${table}" has no queryable columns.`);
  }

  return fields;
};

const selectFieldsForQuery = (
  table: DbTableName,
  columns: DbColumnMap,
  fields: ReadonlyArray<string> | undefined,
) => {
  const requested = fields ?? defaultFieldsForTable(table, columns);
  const selection: SelectedFields = {};
  const selectedFields: Array<string> = [];

  for (const field of requested) {
    const { field: selectedField, column } = columnForField(
      table,
      columns,
      field,
    );

    if (!selectedFields.includes(selectedField)) {
      selection[selectedField] = column;
      selectedFields.push(selectedField);
    }
  }

  return { selectedFields, selection };
};

const scalarForFilter = (filter: FilterInput): ScalarValue => {
  if (!("value" in filter) || filter.value === undefined) {
    throw new Error(`Filter "${filter.field}" with op "${filter.op}" needs value.`);
  }

  if (!isScalarValue(filter.value)) {
    throw new Error(
      `Filter "${filter.field}" with op "${filter.op}" needs a scalar value.`,
    );
  }

  return filter.value;
};

const stringForFilter = (filter: FilterInput): string => {
  const value = scalarForFilter(filter);

  if (typeof value !== "string") {
    throw new Error(`Filter "${filter.field}" with op "${filter.op}" needs a string value.`);
  }

  return value;
};

const valuesForInFilter = (filter: FilterInput): ReadonlyArray<ScalarValue> => {
  const values =
    filter.values ??
    (Array.isArray(filter.value) ? filter.value : undefined);

  if (values === undefined || values.length === 0) {
    throw new Error(`Filter "${filter.field}" with op "in" needs values.`);
  }

  const scalarValues: Array<ScalarValue> = [];

  for (const value of values) {
    if (!isScalarValue(value)) {
      throw new Error(`Filter "${filter.field}" with op "in" only accepts scalar values.`);
    }

    scalarValues.push(value);
  }

  return scalarValues;
};

const conditionForFilter = (
  table: DbTableName,
  columns: DbColumnMap,
  filter: FilterInput,
): SQL => {
  const { column } = columnForField(table, columns, filter.field);

  switch (filter.op) {
    case "eq":
      return eq(column, scalarForFilter(filter));
    case "ne":
      return ne(column, scalarForFilter(filter));
    case "gt":
      return gt(column, scalarForFilter(filter));
    case "gte":
      return gte(column, scalarForFilter(filter));
    case "lt":
      return lt(column, scalarForFilter(filter));
    case "lte":
      return lte(column, scalarForFilter(filter));
    case "like":
      return like(column, stringForFilter(filter));
    case "ilike":
      return ilike(column, stringForFilter(filter));
    case "in":
      return inArray(column, valuesForInFilter(filter));
    case "isNull":
      return isNull(column);
    case "isNotNull":
      return isNotNull(column);
    case "jsonContains": {
      if (!("value" in filter) || filter.value === undefined) {
        throw new Error(
          `Filter "${filter.field}" with op "jsonContains" needs value.`,
        );
      }

      return sql`${column} @> ${JSON.stringify(filter.value)}::jsonb`;
    }

    default:
      throw new Error(`Unsupported filter op "${filter.op}"`);
  }
};

const conditionForWhereEntry = (
  table: DbTableName,
  columns: DbColumnMap,
  field: string,
  value: ScalarValue | ReadonlyArray<ScalarValue>,
): SQL => {
  const { column } = columnForField(table, columns, field);

  if (Array.isArray(value)) return inArray(column, value);
  if (value === null) return isNull(column);
  return eq(column, value);
};

const whereExpression = (
  input: TableQueryInput,
  columns: DbColumnMap,
): SQL | undefined => {
  const conditions: Array<SQL> = [];

  const whereInput = input.where ?? {};

  for (const [field, value] of Object.entries(
    whereInput as Record<string, ScalarValue | ReadonlyArray<ScalarValue>>,
  )) {
    conditions.push(conditionForWhereEntry(input.table, columns, field, value));
  }

  for (const filter of input.filters ?? []) {
    conditions.push(conditionForFilter(input.table, columns, filter));
  }

  return conditions.length === 0 ? undefined : and(...conditions);
};

const defaultOrderBy = (
  table: DbTableName,
  columns: DbColumnMap,
): ReadonlyArray<OrderByInput> => {
  const info = tableInfo(table);
  const firstField = info.keyField ?? Object.keys(columns).sort()[0];

  return firstField === undefined
    ? []
    : [{ field: firstField, direction: "asc" }];
};

const orderByExpressions = (
  table: DbTableName,
  columns: DbColumnMap,
  orderBy: ReadonlyArray<OrderByInput> | undefined,
) =>
  (orderBy ?? defaultOrderBy(table, columns)).map((entry) => {
    const { column } = columnForField(table, columns, entry.field);
    return entry.direction === "desc" ? desc(column) : asc(column);
  });

export const queryTable = (
  input: TableQueryInput,
): Effect.Effect<TableQueryResult, unknown, DdfDatabase> => {
  const table = tableDefinition(input.table).table;
  const columns = columnsForTable(input.table);
  const tableMeta = tableInfo(input.table);
  const limit = input.limit ?? DEFAULT_LIMIT;
  const offset = input.offset ?? DEFAULT_OFFSET;
  const includeCount = input.includeCount ?? true;
  const where = whereExpression(input, columns);
  const orders = orderByExpressions(input.table, columns, input.orderBy);
  const { selectedFields, selection } = selectFieldsForQuery(
    input.table,
    columns,
    input.select,
  );

  return Effect.gen(function* () {
    const { db } = yield* DdfDatabase;

    let query = db.select(selection).from(table).$dynamic();

    if (where !== undefined) query = query.where(where);
    if (orders.length > 0) query = query.orderBy(...orders);

    query = query.limit(limit).offset(offset);

    const rows = yield* query;
    const total = includeCount ? yield* db.$count(table, where) : null;
    const jsonRows = rows.map((row) =>
      toJsonObject(row as Record<string, unknown>),
    );

    return decodeUnknownOrThrow(
      TableQueryResultSchema,
      {
        table: input.table,
        tableName: tableMeta.tableName,
        fields: selectedFields,
        page: {
          limit,
          offset,
          returned: jsonRows.length,
          total,
          hasMore: total === null ? false : offset + jsonRows.length < total,
        },
        rows: jsonRows,
      },
      "Database result",
    );
  });
};

export const getRow = (
  input: GetRowInput,
): Effect.Effect<TableQueryResult, unknown, DdfDatabase> => {
  const keyField = tableInfo(input.table).keyField;

  if (keyField === null) {
    throw new Error(`Table "${input.table}" does not define a key field.`);
  }

  return queryTable({
    table: input.table,
    where: { [keyField]: input.key },
    limit: 1,
    offset: 0,
    includeCount: false,
  });
};
