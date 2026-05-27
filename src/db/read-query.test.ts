import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect } from "effect";
import {
  getRowResultFromQueryResult,
  validateTableQueryInput,
} from "./read-query.js";
import type { TableQueryInput } from "./read-schemas.js";

const expectValidationFailure = Effect.fnUntraced(function* (
  input: TableQueryInput,
  expected: RegExp,
) {
  const exit = yield* Effect.exit(validateTableQueryInput(input));

  assert.strictEqual(exit._tag, "Failure");

  if (exit._tag === "Failure") {
    const pretty = Cause.pretty(exit.cause);

    assert.match(pretty, /DdfMcpValidationError/);
    assert.match(pretty, expected);
    assert.notMatch(pretty, /EffectDrizzleQueryError|Failed query/);
  }
});

describe("validateTableQueryInput", () => {
  it.effect("rejects ilike on non-text columns before querying Postgres", () =>
    expectValidationFailure(
      {
        table: "properties",
        select: ["listingKey", "listPrice"],
        filters: [{ field: "listPrice", op: "ilike", value: "%5%" }],
        limit: 1,
        includeCount: false,
      },
      /only supports text columns.*double precision/s,
    ));

  it.effect("rejects jsonContains on non-json columns before querying Postgres", () =>
    expectValidationFailure(
      {
        table: "properties",
        select: ["listingKey", "city"],
        filters: [{ field: "city", op: "jsonContains", value: "Toronto" }],
        limit: 1,
        includeCount: false,
      },
      /only supports json\/jsonb columns.*text/s,
    ));

  it.effect("accepts text and json-specific operators on compatible columns", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        validateTableQueryInput({
          table: "properties",
          select: ["listingKey", "city"],
          filters: [
            { field: "city", op: "ilike", value: "%toronto%" },
            { field: "raw", op: "jsonContains", value: { City: "Toronto" } },
          ],
          limit: 1,
          includeCount: false,
        }),
      );

      assert.strictEqual(exit._tag, "Success");
    }));
});

describe("getRowResultFromQueryResult", () => {
  it.effect("returns an explicit not-found result for a missing row", () =>
    Effect.gen(function* () {
      const result = yield* getRowResultFromQueryResult(
        { table: "properties", key: "missing-listing" },
        "listingKey",
        {
          table: "properties",
          tableName: "ddf_properties",
          fields: ["listingKey"],
          page: {
            limit: 1,
            offset: 0,
            returned: 0,
            total: null,
            hasMore: false,
          },
          rows: [],
        },
      );

      assert.deepStrictEqual(result, {
        table: "properties",
        keyField: "listingKey",
        key: "missing-listing",
        found: false,
        row: null,
        message:
          'No row found in properties where listingKey = "missing-listing".',
      });
    }));

  it.effect("returns a single found row without the query page envelope", () =>
    Effect.gen(function* () {
      const result = yield* getRowResultFromQueryResult(
        { table: "properties", key: "listing-1" },
        "listingKey",
        {
          table: "properties",
          tableName: "ddf_properties",
          fields: ["listingKey", "city"],
          page: {
            limit: 1,
            offset: 0,
            returned: 1,
            total: null,
            hasMore: false,
          },
          rows: [{ listingKey: "listing-1", city: "Toronto" }],
        },
      );

      assert.deepStrictEqual(result, {
        table: "properties",
        keyField: "listingKey",
        key: "listing-1",
        found: true,
        row: { listingKey: "listing-1", city: "Toronto" },
      });
    }));
});
