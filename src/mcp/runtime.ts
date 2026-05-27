import type { CallToolResult } from "@modelcontextprotocol/server";
import { DdfDatabase } from "crea-ddf/db";
import { Cause, Effect, Exit, ManagedRuntime } from "effect";
import { toolError, toolResult } from "./results.js";

export const mcpRuntime = ManagedRuntime.make(DdfDatabase.layerConfig);

export const toolResultFromExit = Effect.fnUntraced(function* <
  A extends Record<string, unknown>,
  E,
>(
  exit: Exit.Exit<A, E>,
) {
  if (Exit.isSuccess(exit)) {
    return yield* toolResult(exit.value);
  }

  return yield* toolError(Cause.pretty(exit.cause));
});

export const runDbMcpTool = <A extends Record<string, unknown>, E>(
  effect: Effect.Effect<A, E, DdfDatabase>,
): Promise<CallToolResult> =>
  mcpRuntime
    .runPromiseExit(effect)
    .then((exit) => exit.pipe(toolResultFromExit, Effect.runSync));

export const runLocalMcpTool = <A extends Record<string, unknown>, E>(
  effect: Effect.Effect<A, E>,
): Promise<CallToolResult> =>
  Effect.runPromiseExit(effect).then((exit) =>
    exit.pipe(toolResultFromExit, Effect.runSync)
  );

export const disposeMcpRuntime = (): Promise<void> => mcpRuntime.dispose();
