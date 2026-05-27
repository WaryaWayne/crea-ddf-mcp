import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { Schema } from "effect";
import {
  DbTableNameSchema,
  GetRowInputSchema,
  TableQueryInputSchema,
  type GetRowInput,
  type TableQueryInput,
} from "../db/read-schemas.js";

type McpInputSchema<S extends Schema.Top> = StandardSchemaWithJSON<
  S["Encoded"],
  S["Type"]
> &
  S;

export const toMcpInputSchema = <S extends Schema.Top>(
  schema: S,
): McpInputSchema<S> => {
  // The MCP SDK and Effect expose structurally-compatible Standard Schema V1
  // types from different packages. Keep that cast at this adapter boundary.
  const standardSchema = Schema.toStandardSchemaV1(
    schema as unknown as Schema.Decoder<unknown, never>,
  ) as unknown as S;

  // The MCP SDK requires one object with both validate and jsonSchema.
  return Schema.toStandardJSONSchemaV1(
    standardSchema,
  ) as unknown as McpInputSchema<S>;
};

const SmallLimitValueSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1),
  Schema.isLessThanOrEqualTo(100),
);

export const EmptyInputSchema = Schema.Record(Schema.String, Schema.Never);

export const IncludeCountsInputSchema = Schema.Struct({
  includeCounts: Schema.optional(Schema.Boolean),
});

export const TableNameInputSchema = Schema.Struct({
  table: DbTableNameSchema,
});

export const SmallLimitInputSchema = Schema.Struct({
  limit: Schema.optional(SmallLimitValueSchema),
});

export const TableSmallLimitInputSchema = Schema.Struct({
  table: DbTableNameSchema,
  limit: Schema.optional(SmallLimitValueSchema),
});

export const RuntimeStatusInputSchema = EmptyInputSchema;

export type RuntimeStatusInput = Schema.Schema.Type<
  typeof RuntimeStatusInputSchema
>;
export type IncludeCountsInput = Schema.Schema.Type<
  typeof IncludeCountsInputSchema
>;
export type TableNameInput = Schema.Schema.Type<typeof TableNameInputSchema>;
export type SmallLimitInput = Schema.Schema.Type<typeof SmallLimitInputSchema>;
export type TableSmallLimitInput = Schema.Schema.Type<
  typeof TableSmallLimitInputSchema
>;

export const EmptyMcpInputSchema: StandardSchemaWithJSON<
  unknown,
  RuntimeStatusInput
> = toMcpInputSchema(EmptyInputSchema);
export const IncludeCountsMcpInputSchema: StandardSchemaWithJSON<
  unknown,
  IncludeCountsInput
> = toMcpInputSchema(IncludeCountsInputSchema);
export const TableNameMcpInputSchema: StandardSchemaWithJSON<
  unknown,
  TableNameInput
> = toMcpInputSchema(TableNameInputSchema);
export const SmallLimitMcpInputSchema: StandardSchemaWithJSON<
  unknown,
  SmallLimitInput
> = toMcpInputSchema(SmallLimitInputSchema);
export const TableSmallLimitMcpInputSchema: StandardSchemaWithJSON<
  unknown,
  TableSmallLimitInput
> = toMcpInputSchema(TableSmallLimitInputSchema);
export const TableQueryMcpInputSchema: StandardSchemaWithJSON<
  unknown,
  TableQueryInput
> = toMcpInputSchema(TableQueryInputSchema);
export const GetRowMcpInputSchema: StandardSchemaWithJSON<
  unknown,
  GetRowInput
> = toMcpInputSchema(GetRowInputSchema);
