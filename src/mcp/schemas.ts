import * as z from "zod/v4";
import { dbTableEnumValues } from "../sdk/fields.js";

export const limitSchema = z.number().int().min(1).max(500).default(25);
export const smallLimitSchema = z.number().int().min(1).max(100).default(10);
export const offsetSchema = z.number().int().min(0).default(0);
export const tableNameSchema = z.enum(dbTableEnumValues);

export const selectSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .max(100)
  .optional();

export const orderBySchema = z
  .array(
    z.object({
      field: z.string().trim().min(1),
      direction: z.enum(["asc", "desc"]).default("asc"),
    }),
  )
  .min(1)
  .max(5)
  .optional();

const scalarValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const whereSchema = z
  .record(
    z.string().trim().min(1),
    z.union([scalarValueSchema, z.array(scalarValueSchema).min(1).max(250)]),
  )
  .optional();

export const filterSchema = z.object({
  field: z.string().trim().min(1),
  op: z.enum([
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
  ]),
  value: z.json().optional(),
  values: z.array(z.json()).min(1).max(250).optional(),
});

export const dbQueryInputSchema = z.object({
  table: tableNameSchema,
  select: selectSchema,
  where: whereSchema,
  filters: z.array(filterSchema).max(25).optional(),
  orderBy: orderBySchema,
  limit: limitSchema,
  offset: offsetSchema,
  includeCount: z.boolean().default(true),
});
