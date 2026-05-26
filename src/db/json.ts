export type JsonValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export const toJsonValue = (value: unknown): JsonValue => {
  if (value === null || value === undefined) return null;

  if (typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "bigint") return value.toString();

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) return value.map(toJsonValue);

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]),
    );
  }

  return String(value);
};

export const toJsonObject = (value: Record<string, unknown>): JsonObject =>
  toJsonValue(value) as JsonObject;
