import type { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { toJson } from "./mcp/results.js";
import { allTableInfo, sdkCapabilities } from "./sdk/fields.js";

const jsonResource = Effect.fn("Mcp.jsonResource")(function* (
  uri: URL,
  value: unknown,
) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: yield* toJson(value),
      },
    ],
  };
});

export const capabilitiesResource = Effect.fn(
  "McpResource.capabilities",
)(function* (uri: URL) {
  return yield* jsonResource(uri, yield* sdkCapabilities());
});

export const dbSchemaResource = Effect.fn("McpResource.dbSchema")(function* (
  uri: URL,
) {
  return yield* jsonResource(uri, { tables: yield* allTableInfo() });
});

export const registerResources = Effect.fn("Mcp.registerResources")(function* (
  server: McpServer,
) {
  const context = yield* Effect.context<never>();
  // Resource rendering is synchronous today; use an async boundary if that changes.
  const runResource = Effect.runSyncWith(context);

  server.registerResource(
    "crea-ddf-capabilities",
    "crea-ddf://capabilities",
    {
      title: "CREA DDF MCP capabilities",
      description:
        "Read-only database tools, synced tables, schema-derived fields, and required environment variables.",
      mimeType: "application/json",
    },
    (uri) => runResource(capabilitiesResource(uri)),
  );

  server.registerResource(
    "crea-ddf-db-schema",
    "crea-ddf://db/schema",
    {
      title: "CREA DDF database schema",
      description:
        "Known synced database tables and Drizzle field names from crea-ddf.",
      mimeType: "application/json",
    },
    (uri) => runResource(dbSchemaResource(uri)),
  );
});
