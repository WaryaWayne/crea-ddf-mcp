import type { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { getRow, queryTable } from "../db/read-query.js";
import type { GetRowInput, TableQueryInput } from "../db/read-schemas.js";
import { runDbMcpTool, runLocalMcpTool } from "../mcp/runtime.js";
import {
  GetRowMcpInputSchema,
  TableNameMcpInputSchema,
  TableQueryMcpInputSchema,
  type TableNameInput,
} from "../mcp/schemas.js";
import { tableInfo } from "../sdk/fields.js";

export const ddfDbQueryTableTool = Effect.fn(
  "McpTool.ddf_db_query_table",
)(function* (
  input: TableQueryInput,
) {
  return yield* queryTable(input);
});

export const ddfDbGetRowTool = Effect.fn("McpTool.ddf_db_get_row")(function* (
  input: GetRowInput,
) {
  return yield* getRow(input);
});

export const ddfDbTableFieldsTool = Effect.fn(
  "McpTool.ddf_db_table_fields",
)(function* (
  input: TableNameInput,
) {
  return { table: yield* tableInfo(input.table) };
});

export const registerDbReadTools = Effect.fn(
  "Mcp.registerDbReadTools",
)(function* (server: McpServer) {
  server.registerTool(
    "ddf_db_query_table",
    {
      title: "Query a synced CREA DDF table",
      description:
        "Read rows from a known synced Postgres table. Accepts structured select, where, filters, orderBy, limit, and offset; returns paginated JSON.",
      inputSchema: TableQueryMcpInputSchema,
    },
    (input) => ddfDbQueryTableTool(input).pipe(runDbMcpTool),
  );

  server.registerTool(
    "ddf_db_get_row",
    {
      title: "Get one synced database row by key",
      description:
        "Read a single row by the table's schema-defined key field and return found plus row/null, such as listingKey, memberKey, officeKey, openHouseKey, or destinationId.",
      inputSchema: GetRowMcpInputSchema,
    },
    (input) => ddfDbGetRowTool(input).pipe(runDbMcpTool),
  );

  server.registerTool(
    "ddf_db_table_fields",
    {
      title: "List fields for a synced table",
      description:
        "Return queryable Drizzle field names for a table so the model can build select, where, filters, and orderBy objects.",
      inputSchema: TableNameMcpInputSchema,
    },
    (input) => ddfDbTableFieldsTool(input).pipe(runLocalMcpTool),
  );
});
