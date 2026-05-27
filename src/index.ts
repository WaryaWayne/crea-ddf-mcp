#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { createServer } from "./server.js";
import { errorMessage } from "./mcp/results.js";
import { disposeMcpRuntime } from "./mcp/runtime.js";

export { createServer } from "./server.js";

const logStartupError = Effect.fn("Mcp.logStartupError")(function* (
  error: unknown,
) {
  const message = yield* errorMessage(error);

  yield* Effect.logError(message);
});

let runtimeDisposed = false;

const disposeRuntime = () => {
  if (runtimeDisposed) return Promise.resolve();

  runtimeDisposed = true;
  return disposeMcpRuntime();
};

const handleShutdown = (exitCode: number) => {
  process.exitCode = exitCode;
  disposeRuntime()
    .catch((error: unknown) => {
      Effect.runSync(logStartupError(error));
      process.exitCode = 1;
    })
    .finally(() => {
      process.exit(process.exitCode ?? exitCode);
    });
};

export const main = () => {
  const server = Effect.runSync(createServer());
  const transport = new StdioServerTransport();

  transport.onclose = () => {
    disposeRuntime().catch((error: unknown) => {
      Effect.runSync(logStartupError(error));
    });
  };

  process.once("SIGINT", () => handleShutdown(130));
  process.once("SIGTERM", () => handleShutdown(143));

  return server.connect(transport);
};

if (import.meta.main) {
  main()
    .catch((error: unknown) => {
      Effect.runSync(logStartupError(error));
      process.exitCode = 1;
      return disposeRuntime();
    });
}
