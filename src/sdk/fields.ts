import { getColumns, getTableName } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  ddfDestinations,
  ddfMembers,
  ddfOffices,
  ddfOpenHouses,
  ddfProperties,
  ddfSyncErrors,
  ddfSyncRuns,
  ddfWatermarks,
} from "crea-ddf/db";
import { Effect } from "effect";

export const dbTableNames = [
  "properties",
  "members",
  "offices",
  "openHouses",
  "destinations",
  "watermarks",
  "syncRuns",
  "syncErrors",
] as const;

export type DbTableName = (typeof dbTableNames)[number];

type TableInfo = {
  readonly table: PgTable;
  readonly keyField?: string;
};

export type DbTableInfo = {
  readonly name: DbTableName;
  readonly tableName: string;
  readonly keyField: string | null;
  readonly fields: ReadonlyArray<string>;
  readonly columns: ReadonlyArray<{
    readonly field: string;
    readonly column: string;
  }>;
};

const tableDefinitions: Record<DbTableName, TableInfo> = {
  properties: {
    table: ddfProperties,
    keyField: "listingKey",
  },
  members: {
    table: ddfMembers,
    keyField: "memberKey",
  },
  offices: {
    table: ddfOffices,
    keyField: "officeKey",
  },
  openHouses: {
    table: ddfOpenHouses,
    keyField: "openHouseKey",
  },
  destinations: {
    table: ddfDestinations,
    keyField: "destinationId",
  },
  watermarks: {
    table: ddfWatermarks,
  },
  syncRuns: {
    table: ddfSyncRuns,
  },
  syncErrors: {
    table: ddfSyncErrors,
  },
};

export type DbColumnMap = Record<string, PgColumn>;

export const tableDefinition = Effect.fnUntraced(function* (
  name: DbTableName,
) {
  return tableDefinitions[name];
});

export const columnsForTable = Effect.fnUntraced(function* (
  name: DbTableName,
) {
  const definition = yield* tableDefinition(name);

  // Drizzle preserves precise columns per concrete table, but this adapter needs
  // a table-name-indexed map for model-selected field names.
  return getColumns(definition.table) as unknown as DbColumnMap;
});

export const tableInfo = Effect.fnUntraced(function* (
  name: DbTableName,
) {
  const definition = yield* tableDefinition(name);
  const columns = yield* columnsForTable(name);

  return {
    name,
    tableName: getTableName(definition.table),
    keyField: definition.keyField ?? null,
    fields: Object.keys(columns).sort(),
    columns: Object.entries(columns).map(([field, column]) => ({
      field,
      column: column.name,
    })),
  };
});

export const allTableInfo = Effect.fnUntraced(function* () {
  return yield* Effect.forEach(dbTableNames, tableInfo);
});

export const sdkCapabilities = Effect.fnUntraced(function* () {
  return {
    package: "crea-ddf-mcp",
    transport: "stdio",
    mode: "read-only-database",
    env: {
      database: ["DATABASE_URL"],
    },
    tools: [
      "ddf_runtime_status",
      "ddf_db_list_tables",
      "ddf_db_describe_table",
      "ddf_db_table_fields",
      "ddf_db_query_table",
      "ddf_db_get_row",
      "ddf_db_sample_table",
      "ddf_db_latest_sync_runs",
    ],
    tables: yield* allTableInfo(),
  };
});
