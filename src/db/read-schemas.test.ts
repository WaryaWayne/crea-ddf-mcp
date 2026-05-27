import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";
import {
  DbJsonObjectSchema,
  JsonObjectSchema,
} from "./read-schemas.js";

describe("DbJsonObjectSchema", () => {
  it.effect("encodes database row values through Effect Schema", () =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encodeUnknownEffect(DbJsonObjectSchema)({
        createdAt: DateTime.makeUnsafe("2026-05-26T10:15:30.000Z"),
        count: 12n,
        missing: undefined,
        metric: Number.NaN,
        nested: {
          values: [
            DateTime.makeUnsafe("2026-05-27T00:00:00.000Z"),
            undefined,
          ],
        },
      });

      const jsonObject = yield* Schema.decodeUnknownEffect(JsonObjectSchema)(
        encoded,
      );

      assert.deepStrictEqual(jsonObject, {
        createdAt: "2026-05-26T10:15:30.000Z",
        count: "12",
        missing: null,
        metric: "NaN",
        nested: {
          values: ["2026-05-27T00:00:00.000Z", null],
        },
      });
    }));

  it.effect("rejects unsupported database row values", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Schema.encodeUnknownEffect(DbJsonObjectSchema)({
          value: Symbol("not-json"),
        }),
      );

      assert.strictEqual(exit._tag, "Failure");
    }));
});
