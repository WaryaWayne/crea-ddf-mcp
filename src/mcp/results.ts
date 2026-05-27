import { Effect, Schema } from "effect";

export const errorMessage = Effect.fnUntraced(function* (error: unknown) {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
});

export const toJson = Effect.fnUntraced(function* (value: unknown) {
  return yield* Schema.encodeUnknownEffect(
    Schema.fromJsonString(Schema.Json),
  )(value);
});

export const toolResult = Effect.fn("Mcp.toolResult")(function* (
  value: Record<string, unknown>,
) {
  const text = yield* toJson(value);

  return {
    content: [{ type: "text" as const, text }],
    structuredContent: value,
  };
});

export const toolError = Effect.fn("Mcp.toolError")(function* (
  error: unknown,
) {
  const text = yield* errorMessage(error);

  return {
    isError: true,
    content: [{ type: "text" as const, text }],
  };
});
