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

export const dbTableEnumValues = dbTableNames as unknown as [
  DbTableName,
  ...DbTableName[],
];

export type DbColumnMap = Record<string, PgColumn>;

export const columnsForTable = (name: DbTableName): DbColumnMap =>
  getColumns(tableDefinition(name).table) as unknown as DbColumnMap;

export const tableInfo = (name: DbTableName) => {
  const definition = tableDefinitions[name];
  const columns = columnsForTable(name);

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
};

export const tableDefinition = (name: DbTableName) => tableDefinitions[name];

export const allTableInfo = () => dbTableNames.map((name) => tableInfo(name));

export const sdkCapabilities = () => ({
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
  tables: allTableInfo(),
});
