import type { McpServer } from "@modelcontextprotocol/server";
import { desc } from "drizzle-orm";
import { ddfSyncRuns } from "crea-ddf/db";
import { DdfDatabase } from "crea-ddf/db";
import { Effect } from "effect";
import * as z from "zod/v4";
import { queryTable } from "#/db/read-query";
import { runTool } from "#/mcp/results";
import { smallLimitSchema, tableNameSchema } from "#/mcp/schemas";
import {
  allTableInfo,
  dbTableNames,
  tableDefinition,
  tableInfo,
} from "#/sdk/fields";
import { runDdfDatabase } from "#/sdk/runtime";

const envStatus = () => ({
  databaseUrlConfigured: process.env.DATABASE_URL !== undefined,
});

export const registerDbInspectionTools = (server: McpServer) => {
  server.registerTool(
    "ddf_runtime_status",
    {
      title: "Check CREA DDF MCP runtime status",
      description:
        "Report configured environment variables without exposing secret values.",
      inputSchema: z.object({}),
    },
    async () =>
      runTool(async () => ({
        env: envStatus(),
        resources: ["crea-ddf://capabilities", "crea-ddf://db/schema"],
        toolGroups: {
          databaseInspection: 5,
          databaseRead: 3,
        },
      })),
  );

  server.registerTool(
    "ddf_db_list_tables",
    {
      title: "List synced database tables",
      description:
        "List known crea-ddf synced Postgres tables, schema-derived fields, and optional row counts.",
      inputSchema: z.object({
        includeCounts: z.boolean().default(true),
      }),
    },
    async (input) =>
      runTool(async () => {
        if (!input.includeCounts) {
          return { tables: allTableInfo() };
        }

        const tables = await runDdfDatabase(
          Effect.gen(function* () {
            const { db } = yield* DdfDatabase;
            return yield* Effect.forEach(dbTableNames, (name) =>
              db.$count(tableDefinition(name).table).pipe(
                Effect.map((rowCount) => ({
                  ...tableInfo(name),
                  rowCount,
                })),
              ),
            );
          }),
        );

        return { tables };
      }),
  );

  server.registerTool(
    "ddf_db_describe_table",
    {
      title: "Describe synced database table",
      description:
        "Show table name, schema-defined key field, queryable fields, and physical columns.",
      inputSchema: z.object({
        table: tableNameSchema,
      }),
    },
    async (input) =>
      runTool(async () => ({
        table: tableInfo(input.table),
      })),
  );

  server.registerTool(
    "ddf_db_sample_table",
    {
      title: "Sample synced database table",
      description:
        "Return a small read-only sample from a known crea-ddf table using the same generic paginated query path.",
      inputSchema: z.object({
        table: tableNameSchema,
        limit: smallLimitSchema,
      }),
    },
    async (input) =>
      runTool(async () => {
        return await runDdfDatabase(
          queryTable({
            table: input.table,
            limit: input.limit,
            offset: 0,
            includeCount: false,
          }),
        );
      }),
  );

  server.registerTool(
    "ddf_db_latest_sync_runs",
    {
      title: "List latest database sync runs",
      description:
        "Inspect recent sync run summary rows from the local database.",
      inputSchema: z.object({
        limit: smallLimitSchema,
      }),
    },
    async (input) =>
      runTool(async () => {
        const rows = await runDdfDatabase(
          Effect.gen(function* () {
            const { db } = yield* DdfDatabase;
            return yield* db
              .select()
              .from(ddfSyncRuns)
              .orderBy(desc(ddfSyncRuns.startedAt))
              .limit(input.limit);
          }),
        );
        return { count: rows.length, rows };
      }),
  );
};
