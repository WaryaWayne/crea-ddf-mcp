import { McpServer } from "@modelcontextprotocol/server";
import { registerResources } from "./resources.js";
import { registerDbInspectionTools } from "./tools/db-inspect.js";
import { registerDbReadTools } from "./tools/db-read.js";

export const packageVersion = "0.0.1";

export const createServer = () => {
  const server = new McpServer({
    name: "crea-ddf-mcp",
    version: packageVersion,
  });

  registerResources(server);
  registerDbInspectionTools(server);
  registerDbReadTools(server);

  return server;
};
