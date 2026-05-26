import { DdfDatabase } from "crea-ddf/db";
import { Effect } from "effect";

export const dbOnlyLayer = DdfDatabase.layerConfig;

export const runDdfDatabase = <A, E>(
  effect: Effect.Effect<A, E, DdfDatabase>,
) => Effect.runPromise(Effect.provide(effect, dbOnlyLayer));
