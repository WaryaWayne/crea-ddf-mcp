import { McpServer } from "@modelcontextprotocol/server";
import { registerResources } from "#/resources";
import { registerDbInspectionTools } from "#/tools/db-inspect";
import { registerDbReadTools } from "#/tools/db-read";

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
