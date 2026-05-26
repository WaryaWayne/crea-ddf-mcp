import type { McpServer } from "@modelcontextprotocol/server";
import { allTableInfo, sdkCapabilities } from "./sdk/fields.js";
import { toJson } from "./mcp/results.js";

const jsonResource = (uri: URL, value: unknown) => ({
  contents: [
    {
      uri: uri.href,
      mimeType: "application/json",
      text: toJson(value),
    },
  ],
});

export const registerResources = (server: McpServer) => {
  server.registerResource(
    "crea-ddf-capabilities",
    "crea-ddf://capabilities",
    {
      title: "CREA DDF MCP capabilities",
      description:
        "Read-only database tools, synced tables, schema-derived fields, and required environment variables.",
      mimeType: "application/json",
    },
    async (uri) => jsonResource(uri, sdkCapabilities()),
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
    async (uri) => jsonResource(uri, { tables: allTableInfo() }),
  );
};
