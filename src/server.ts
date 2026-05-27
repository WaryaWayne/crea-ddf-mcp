import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { registerResources } from "./resources.js";
import { registerDbInspectionTools } from "./tools/db-inspect.js";
import { registerDbReadTools } from "./tools/db-read.js";

export const packageVersion = "0.0.1";

export const createServer = Effect.fn("Mcp.createServer")(function* () {
  const server = new McpServer({
    name: "crea-ddf-mcp",
    version: packageVersion,
  });

  yield* registerResources(server);
  yield* registerDbInspectionTools(server);
  yield* registerDbReadTools(server);

  return server;
});
