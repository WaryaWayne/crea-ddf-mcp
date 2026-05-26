import type { CallToolResult } from "@modelcontextprotocol/server";

export const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
};

export const toJson = (value: unknown) =>
  JSON.stringify(
    value,
    (_key, entry) => {
      if (typeof entry === "bigint") return entry.toString();
      if (entry instanceof Error) {
        return {
          name: entry.name,
          message: entry.message,
          stack: entry.stack,
        };
      }
      return entry;
    },
    2,
  );

export const toolResult = (
  value: Record<string, unknown>,
): CallToolResult => ({
  content: [{ type: "text", text: toJson(value) }],
  structuredContent: value,
});

export const toolError = (error: unknown): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: errorMessage(error) }],
});

export const runTool = async (
  run: () => Promise<Record<string, unknown>>,
): Promise<CallToolResult> => {
  try {
    return toolResult(await run());
  } catch (error) {
    return toolError(error);
  }
};
