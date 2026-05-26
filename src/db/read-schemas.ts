import { Schema } from "effect";
import { dbTableNames } from "../sdk/fields.js";
import type { JsonValue } from "./json.js";

const fieldNameSchema = Schema.NonEmptyString;
const fieldListSchema = Schema.Array(fieldNameSchema).check(
  Schema.isLengthBetween(1, 100),
);

export const DbTableNameSchema = Schema.Literals(dbTableNames);

export const JsonValueSchema: Schema.Schema<JsonValue> = Schema.suspend(() =>
  Schema.Union([
    Schema.String,
    Schema.Number,
    Schema.Boolean,
    Schema.Null,
    Schema.Array(JsonValueSchema),
    Schema.Record(Schema.String, JsonValueSchema),
  ]),
) as Schema.Schema<JsonValue>;

export const ScalarValueSchema = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
]);

export const WhereValueSchema = Schema.Union([
  ScalarValueSchema,
  Schema.Array(ScalarValueSchema).check(Schema.isLengthBetween(1, 250)),
]);

export const FilterOperationSchema = Schema.Literals([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "in",
  "isNull",
  "isNotNull",
  "jsonContains",
]);

export const FilterInputSchema = Schema.Struct({
  field: fieldNameSchema,
  op: FilterOperationSchema,
  value: Schema.optional(JsonValueSchema),
  values: Schema.optional(
    Schema.Array(JsonValueSchema).check(Schema.isLengthBetween(1, 250)),
  ),
});

export const OrderByInputSchema = Schema.Struct({
  field: fieldNameSchema,
  direction: Schema.optional(Schema.Literals(["asc", "desc"])),
});

const limitSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1),
  Schema.isLessThanOrEqualTo(500),
);

const offsetSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);

export const TableQueryInputSchema = Schema.Struct({
  table: DbTableNameSchema,
  select: Schema.optional(fieldListSchema),
  where: Schema.optional(Schema.Record(fieldNameSchema, WhereValueSchema)),
  filters: Schema.optional(
    Schema.Array(FilterInputSchema).check(Schema.isLengthBetween(1, 25)),
  ),
  orderBy: Schema.optional(
    Schema.Array(OrderByInputSchema).check(Schema.isLengthBetween(1, 5)),
  ),
  limit: Schema.optional(limitSchema),
  offset: Schema.optional(offsetSchema),
  includeCount: Schema.optional(Schema.Boolean),
});

export type TableQueryInput = Schema.Schema.Type<typeof TableQueryInputSchema>;
export type FilterInput = Schema.Schema.Type<typeof FilterInputSchema>;
export type OrderByInput = Schema.Schema.Type<typeof OrderByInputSchema>;

export const GetRowInputSchema = Schema.Struct({
  table: DbTableNameSchema,
  key: Schema.Union([Schema.String, Schema.Number]),
});

export type GetRowInput = Schema.Schema.Type<typeof GetRowInputSchema>;

export const PageSchema = Schema.Struct({
  limit: Schema.Number,
  offset: Schema.Number,
  returned: Schema.Number,
  total: Schema.NullOr(Schema.Number),
  hasMore: Schema.Boolean,
});

export const TableQueryResultSchema = Schema.Struct({
  table: DbTableNameSchema,
  tableName: Schema.String,
  fields: Schema.Array(Schema.String),
  page: PageSchema,
  rows: Schema.Array(Schema.Record(Schema.String, JsonValueSchema)),
});

export type TableQueryResult = Schema.Schema.Type<
  typeof TableQueryResultSchema
>;
