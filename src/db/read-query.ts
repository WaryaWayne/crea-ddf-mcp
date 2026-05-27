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
import { Effect, Formatter, Result, Schema } from "effect";
import {
  DbJsonObjectSchema,
  JsonObjectSchema,
  TableQueryResultSchema,
  type FilterInput,
  type GetRowInput,
  type JsonObject,
  type OrderByInput,
  type TableQueryInput,
} from "./read-schemas.js";
import {
  columnsForTable,
  tableDefinition,
  tableInfo,
  type DbColumnMap,
  type DbTableName,
} from "../sdk/fields.js";
import { DdfMcpDecodeError, DdfMcpValidationError } from "../mcp/errors.js";

type ScalarValue = string | number | boolean | null;

type QuerySelection = {
  readonly selectedFields: ReadonlyArray<string>;
  readonly selection: SelectedFields;
};

const DEFAULT_LIMIT = 25;
const DEFAULT_OFFSET = 0;

const fail = Effect.fnUntraced(function* (
  message: string,
) {
  return yield* new DdfMcpValidationError({ message });
});

const validFieldsMessage = Effect.fnUntraced(function* (
  table: DbTableName,
  columns: DbColumnMap,
) {
  return `Valid fields for ${table}: ${Object.keys(columns).sort().join(", ")}`;
});

const columnForField = Effect.fnUntraced(function* (
  table: DbTableName,
  columns: DbColumnMap,
  field: string,
) {
  const normalized = field.trim();
  const column = columns[normalized];

  if (column === undefined) {
    const message = yield* validFieldsMessage(table, columns);

    return yield* fail(
      `Unknown field "${field}" on table "${table}". ${message}`,
    );
  }

  return { field: normalized, column };
});

const defaultFieldsForTable = Effect.fnUntraced(function* (
  table: DbTableName,
  columns: DbColumnMap,
) {
  const fields = Object.keys(columns)
    .filter((field) => field !== "raw")
    .sort();

  if (fields.length === 0) {
    return yield* fail(`Table "${table}" has no queryable columns.`);
  }

  return fields;
});

const selectFieldsForQuery = Effect.fnUntraced(function* (
  table: DbTableName,
  columns: DbColumnMap,
  fields: ReadonlyArray<string> | undefined,
) {
  const requested = fields ?? (yield* defaultFieldsForTable(table, columns));
  const selection: SelectedFields = {};
  const selectedFields: Array<string> = [];

  for (const field of requested) {
    const selected = yield* columnForField(table, columns, field);

    if (!selectedFields.includes(selected.field)) {
      selection[selected.field] = selected.column;
      selectedFields.push(selected.field);
    }
  }

  return { selectedFields, selection };
});

const scalarForFilter = Effect.fnUntraced(function* (
  filter: FilterInput,
) {
  if (!("value" in filter) || filter.value === undefined) {
    return yield* fail(
      `Filter "${filter.field}" with op "${filter.op}" needs value.`,
    );
  }

  if (
    filter.value === null ||
    typeof filter.value === "string" ||
    typeof filter.value === "number" ||
    typeof filter.value === "boolean"
  ) {
    return filter.value;
  }

  return yield* fail(
    `Filter "${filter.field}" with op "${filter.op}" needs a scalar value.`,
  );
});

const stringForFilter = Effect.fnUntraced(function* (
  filter: FilterInput,
) {
  const value = yield* scalarForFilter(filter);

  if (typeof value !== "string") {
    return yield* fail(
      `Filter "${filter.field}" with op "${filter.op}" needs a string value.`,
    );
  }

  return value;
});

const valuesForInFilter = Effect.fnUntraced(function* (
  filter: FilterInput,
) {
  const values =
    filter.values ??
    (Array.isArray(filter.value) ? filter.value : undefined);

  if (values === undefined || values.length === 0) {
    return yield* fail(`Filter "${filter.field}" with op "in" needs values.`);
  }

  const scalarValues: Array<ScalarValue> = [];

  for (const value of values) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      scalarValues.push(value);
    } else {
      return yield* fail(
        `Filter "${filter.field}" with op "in" only accepts scalar values.`,
      );
    }
  }

  return scalarValues;
});

const conditionForFilter = Effect.fnUntraced(function* (
  table: DbTableName,
  columns: DbColumnMap,
  filter: FilterInput,
) {
  const { column } = yield* columnForField(table, columns, filter.field);

  switch (filter.op) {
    case "eq":
      return eq(column, yield* scalarForFilter(filter));
    case "ne":
      return ne(column, yield* scalarForFilter(filter));
    case "gt":
      return gt(column, yield* scalarForFilter(filter));
    case "gte":
      return gte(column, yield* scalarForFilter(filter));
    case "lt":
      return lt(column, yield* scalarForFilter(filter));
    case "lte":
      return lte(column, yield* scalarForFilter(filter));
    case "like":
      return like(column, yield* stringForFilter(filter));
    case "ilike":
      return ilike(column, yield* stringForFilter(filter));
    case "in":
      return inArray(column, yield* valuesForInFilter(filter));
    case "isNull":
      return isNull(column);
    case "isNotNull":
      return isNotNull(column);
    case "jsonContains": {
      if (!("value" in filter) || filter.value === undefined) {
        return yield* fail(
          `Filter "${filter.field}" with op "jsonContains" needs value.`,
        );
      }

      const jsonString = yield* Schema.encodeUnknownEffect(
        Schema.fromJsonString(Schema.Json),
      )(filter.value);

      return sql`${column} @> ${jsonString}::jsonb`;
    }
  }
});

const conditionForWhereEntry = Effect.fnUntraced(function* (
  table: DbTableName,
  columns: DbColumnMap,
  field: string,
  value: ScalarValue | ReadonlyArray<ScalarValue>,
) {
  const { column } = yield* columnForField(table, columns, field);

  if (Array.isArray(value)) return inArray(column, value);
  if (value === null) return isNull(column);
  return eq(column, value);
});

const whereExpression = Effect.fnUntraced(function* (
  input: TableQueryInput,
  columns: DbColumnMap,
) {
  const conditions: Array<SQL> = [];
  const whereInput = input.where ?? {};

  for (const [field, value] of Object.entries(
    whereInput as Record<string, ScalarValue | ReadonlyArray<ScalarValue>>,
  )) {
    conditions.push(
      yield* conditionForWhereEntry(input.table, columns, field, value),
    );
  }

  for (const filter of input.filters ?? []) {
    conditions.push(yield* conditionForFilter(input.table, columns, filter));
  }

  return conditions.length === 0 ? undefined : and(...conditions);
});

const defaultOrderBy = Effect.fnUntraced(function* (
  table: DbTableName,
  columns: DbColumnMap,
) {
  const info = yield* tableInfo(table);
  const firstField = info.keyField ?? Object.keys(columns).sort()[0];

  return firstField === undefined
    ? []
    : [{ field: firstField, direction: "asc" }];
});

const orderByExpressions = Effect.fnUntraced(function* (
  table: DbTableName,
  columns: DbColumnMap,
  orderBy: ReadonlyArray<OrderByInput> | undefined,
) {
  const entries = orderBy ?? (yield* defaultOrderBy(table, columns));
  const expressions: Array<SQL> = [];

  for (const entry of entries) {
    const { column } = yield* columnForField(table, columns, entry.field);
    expressions.push(entry.direction === "desc" ? desc(column) : asc(column));
  }

  return expressions;
});

export const queryTable = Effect.fn("DdfDb.queryTable")(function* (
  input: TableQueryInput,
) {
  const definition = yield* tableDefinition(input.table);
  const columns = yield* columnsForTable(input.table);
  const tableMeta = yield* tableInfo(input.table);
  const limit = input.limit ?? DEFAULT_LIMIT;
  const offset = input.offset ?? DEFAULT_OFFSET;
  const includeCount = input.includeCount ?? true;
  const where = yield* whereExpression(input, columns);
  const orders = yield* orderByExpressions(
    input.table,
    columns,
    input.orderBy,
  );
  const { selectedFields, selection } = yield* selectFieldsForQuery(
    input.table,
    columns,
    input.select,
  );
  const { db } = yield* DdfDatabase;

  let query = db.select(selection).from(definition.table).$dynamic();

  if (where !== undefined) query = query.where(where);
  if (orders.length > 0) query = query.orderBy(...orders);

  query = query.limit(limit).offset(offset);

  const rows = yield* query;
  const total = includeCount ? yield* db.$count(definition.table, where) : null;
  const jsonRows: Array<JsonObject> = [];

  for (const row of rows) {
    const jsonRow = yield* Schema.encodeUnknownEffect(DbJsonObjectSchema)(row);
    const result = Schema.decodeUnknownResult(JsonObjectSchema)(jsonRow);

    if (Result.isFailure(result)) {
      return yield* new DdfMcpDecodeError({
        message: `Database row failed Effect Schema validation:\n${
          Formatter.format(result.failure, { space: 2 })
        }`,
        subject: "Database row",
      });
    }

    jsonRows.push(result.success);
  }

  const tableQueryResult = Schema.decodeUnknownResult(TableQueryResultSchema)({
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
  });

  if (Result.isFailure(tableQueryResult)) {
    return yield* new DdfMcpDecodeError({
      message: `Database result failed Effect Schema validation:\n${
        Formatter.format(tableQueryResult.failure, { space: 2 })
      }`,
      subject: "Database result",
    });
  }

  return tableQueryResult.success;
});

export const getRow = Effect.fn("DdfDb.getRow")(function* (
  input: GetRowInput,
) {
  const info = yield* tableInfo(input.table);

  if (info.keyField === null) {
    return yield* fail(`Table "${input.table}" does not define a key field.`);
  }

  return yield* queryTable({
    table: input.table,
    where: { [info.keyField]: input.key },
    limit: 1,
    offset: 0,
    includeCount: false,
  });
});
