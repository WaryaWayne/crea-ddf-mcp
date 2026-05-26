import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { queryTable, getRow } from "../db/read-query.js";
import {
  GetRowInputSchema,
  TableQueryInputSchema,
} from "../db/read-schemas.js";
import { decodeUnknownOrThrow } from "../mcp/effect-decode.js";
import { runTool } from "../mcp/results.js";
import { dbQueryInputSchema, tableNameSchema } from "../mcp/schemas.js";
import { tableInfo } from "../sdk/fields.js";
import { runDdfDatabase } from "../sdk/runtime.js";

type DbQueryInput = z.infer<typeof dbQueryInputSchema>;
type TableNameInput = { readonly table: z.infer<typeof tableNameSchema> };

export const registerDbReadTools = (server: McpServer) => {
  server.registerTool(
    "ddf_db_query_table",
    {
      title: "Query a synced CREA DDF table",
      description:
        "Read rows from a known synced Postgres table. Accepts structured select, where, filters, orderBy, limit, and offset; returns paginated JSON.",
      inputSchema: dbQueryInputSchema,
    },
    async (input: DbQueryInput) =>
      runTool(async () => {
        const decoded = decodeUnknownOrThrow(
          TableQueryInputSchema,
          input,
          "Tool input",
        );

        return await runDdfDatabase(queryTable(decoded));
      }),
  );

  server.registerTool(
    "ddf_db_get_row",
    {
      title: "Get one synced database row by key",
      description:
        "Read a single row by the table's schema-defined key field, such as listingKey, memberKey, officeKey, openHouseKey, or destinationId.",
      inputSchema: z.object({
        table: tableNameSchema,
        key: z.union([z.string().trim().min(1), z.number()]),
      }),
    },
    async (input: z.infer<typeof GetRowInputSchema>) =>
      runTool(async () => {
        const decoded = decodeUnknownOrThrow(
          GetRowInputSchema,
          input,
          "Tool input",
        );

        return await runDdfDatabase(getRow(decoded));
      }),
  );

  server.registerTool(
    "ddf_db_table_fields",
    {
      title: "List fields for a synced table",
      description:
        "Return queryable Drizzle field names for a table so the model can build select, where, filters, and orderBy objects.",
      inputSchema: z.object({
        table: tableNameSchema,
      }),
    },
    async (input: TableNameInput) =>
      runTool(async () => ({
        table: tableInfo(input.table),
      })),
  );
};
