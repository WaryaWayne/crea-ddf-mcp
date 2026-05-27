import type { McpServer } from "@modelcontextprotocol/server";
import { desc } from "drizzle-orm";
import { ddfSyncRuns, DdfDatabase } from "crea-ddf/db";
import { Config, Effect, Formatter, Option, Result, Schema } from "effect";
import {
  DbJsonObjectSchema,
  JsonObjectSchema,
  type JsonObject,
} from "../db/read-schemas.js";
import { queryTable } from "../db/read-query.js";
import { DdfMcpDecodeError } from "../mcp/errors.js";
import { runDbMcpTool, runLocalMcpTool } from "../mcp/runtime.js";
import {
  EmptyMcpInputSchema,
  IncludeCountsMcpInputSchema,
  SmallLimitMcpInputSchema,
  TableNameMcpInputSchema,
  TableSmallLimitMcpInputSchema,
  type IncludeCountsInput,
  type RuntimeStatusInput,
  type SmallLimitInput,
  type TableNameInput,
  type TableSmallLimitInput,
} from "../mcp/schemas.js";
import {
  allTableInfo,
  dbTableNames,
  tableDefinition,
  tableInfo,
} from "../sdk/fields.js";

const DEFAULT_SMALL_LIMIT = 10;

const runtimeEnvStatus = Effect.fn("Mcp.runtimeEnvStatus")(function* () {
  const databaseUrl = yield* Config.redacted("DATABASE_URL").pipe(
    Config.option,
  );

  return { databaseUrlConfigured: Option.isSome(databaseUrl) };
});

export const ddfRuntimeStatusTool = Effect.fn(
  "McpTool.ddf_runtime_status",
)(function* (
  _input: RuntimeStatusInput,
) {
  return {
    env: yield* runtimeEnvStatus(),
    resources: ["crea-ddf://capabilities", "crea-ddf://db/schema"],
    toolGroups: {
      databaseInspection: 5,
      databaseRead: 3,
    },
  };
});

export const ddfDbListTablesTool = Effect.fn(
  "McpTool.ddf_db_list_tables",
)(function* (
  input: IncludeCountsInput,
) {
  if (!(input.includeCounts ?? true)) {
    return { tables: yield* allTableInfo() };
  }

  const { db } = yield* DdfDatabase;
  const tables = yield* Effect.forEach(dbTableNames, (name) =>
    Effect.gen(function* () {
      const definition = yield* tableDefinition(name);
      const rowCount = yield* db.$count(definition.table);
      const info = yield* tableInfo(name);

      return {
        ...info,
        rowCount,
      };
    }),
  );

  return { tables };
});

export const ddfDbDescribeTableTool = Effect.fn(
  "McpTool.ddf_db_describe_table",
)(function* (
  input: TableNameInput,
) {
  return { table: yield* tableInfo(input.table) };
});

export const ddfDbSampleTableTool = Effect.fn(
  "McpTool.ddf_db_sample_table",
)(function* (
  input: TableSmallLimitInput,
) {
  return yield* queryTable({
    table: input.table,
    limit: input.limit ?? DEFAULT_SMALL_LIMIT,
    offset: 0,
    includeCount: false,
  });
});

export const ddfDbLatestSyncRunsTool = Effect.fn(
  "McpTool.ddf_db_latest_sync_runs",
)(function* (
  input: SmallLimitInput,
) {
  const { db } = yield* DdfDatabase;
  const rows = yield* db
    .select()
    .from(ddfSyncRuns)
    .orderBy(desc(ddfSyncRuns.startedAt))
    .limit(input.limit ?? DEFAULT_SMALL_LIMIT);
  const jsonRows: Array<JsonObject> = [];

  for (const row of rows) {
    const jsonRow = yield* Schema.encodeUnknownEffect(DbJsonObjectSchema)(row);
    const result = Schema.decodeUnknownResult(JsonObjectSchema)(jsonRow);

    if (Result.isFailure(result)) {
      return yield* new DdfMcpDecodeError({
        message: `Sync run row failed Effect Schema validation:\n${
          Formatter.format(result.failure, { space: 2 })
        }`,
        subject: "Sync run row",
      });
    }

    jsonRows.push(result.success);
  }

  return { count: jsonRows.length, rows: jsonRows };
});

export const registerDbInspectionTools = Effect.fn(
  "Mcp.registerDbInspectionTools",
)(function* (server: McpServer) {
  server.registerTool(
    "ddf_runtime_status",
    {
      title: "Check CREA DDF MCP runtime status",
      description:
        "Report configured environment variables without exposing secret values.",
      inputSchema: EmptyMcpInputSchema,
    },
    (input) => ddfRuntimeStatusTool(input).pipe(runLocalMcpTool),
  );

  server.registerTool(
    "ddf_db_list_tables",
    {
      title: "List synced database tables",
      description:
        "List known crea-ddf synced Postgres tables, schema-derived fields, and optional row counts.",
      inputSchema: IncludeCountsMcpInputSchema,
    },
    (input) => ddfDbListTablesTool(input).pipe(runDbMcpTool),
  );

  server.registerTool(
    "ddf_db_describe_table",
    {
      title: "Describe synced database table",
      description:
        "Show table name, schema-defined key field, queryable fields, and physical columns.",
      inputSchema: TableNameMcpInputSchema,
    },
    (input) => ddfDbDescribeTableTool(input).pipe(runLocalMcpTool),
  );

  server.registerTool(
    "ddf_db_sample_table",
    {
      title: "Sample synced database table",
      description:
        "Return a small read-only sample from a known crea-ddf table using the same generic paginated query path.",
      inputSchema: TableSmallLimitMcpInputSchema,
    },
    (input) => ddfDbSampleTableTool(input).pipe(runDbMcpTool),
  );

  server.registerTool(
    "ddf_db_latest_sync_runs",
    {
      title: "List latest database sync runs",
      description:
        "Inspect recent sync run summary rows from the local database.",
      inputSchema: SmallLimitMcpInputSchema,
    },
    (input) => ddfDbLatestSyncRunsTool(input).pipe(runDbMcpTool),
  );
});
