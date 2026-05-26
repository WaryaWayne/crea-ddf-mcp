#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/server";
import { pathToFileURL } from "node:url";
import { createServer } from "#/server";
import { errorMessage } from "#/mcp/results";

export { createServer } from "#/server";

export const main = async () => {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
