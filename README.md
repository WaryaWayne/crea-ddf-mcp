# crea-ddf-mcp

Read-only MCP server for querying synced CREA DDF Postgres data through the `crea-ddf` package.

The server runs over stdio and reads the database through `crea-ddf/db`. It does not expose CREA API credentials, live API calls, sync, migrations, inserts, updates, or deletes.

## Requirements

- Node.js `24.14.0` or newer
- A Postgres database already synced by `crea-ddf` (install it with `pnpm install crea-ddf`)
- `DATABASE_URL` for that database

## Usage

### opencode

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "crea-ddf": {
      "type": "local",
      "command": ["npx", "-y", "crea-ddf-mcp"],
      "environment": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/crea_ddf"
      },
      "enabled": true
    }
  }
}
```

opencode uses `environment`, not `env`.

### MCP clients using `mcpServers`

```json
{
  "mcpServers": {
    "crea-ddf": {
      "command": "npx",
      "args": ["-y", "crea-ddf-mcp"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/crea_ddf"
      }
    }
  }
}
```

Use a read-only Postgres role for `DATABASE_URL` when giving this to agents. The MCP server only registers read tools, but database permissions are still the hard safety boundary.

If your MCP client runs on a different machine or inside a container, `localhost` means that client machine, not the machine where your database might be running.

## Tools

- `ddf_runtime_status`
- `ddf_db_list_tables`
- `ddf_db_describe_table`
- `ddf_db_table_fields`
- `ddf_db_query_table`
- `ddf_db_get_row`
- `ddf_db_sample_table`
- `ddf_db_latest_sync_runs`

`ddf_db_query_table` accepts structured input:

```json
{
  "table": "properties",
  "select": ["listingKey", "city", "listPrice", "standardStatus"],
  "where": { "city": "Toronto" },
  "filters": [{ "field": "listPrice", "op": "gte", "value": 500000 }],
  "orderBy": [{ "field": "listPrice", "direction": "asc" }],
  "limit": 25,
  "offset": 0,
  "includeCount": true
}
```

The model can call `ddf_db_list_tables` or `ddf_db_table_fields` first to discover valid table and field names. Inputs and returned JSON are decoded with Effect Schema so validation failures point at the missing or invalid field path.

## Tables

The server exposes the synced tables exported by `crea-ddf/db`:

- `properties`
- `members`
- `offices`
- `openHouses`
- `destinations`
- `watermarks`
- `syncRuns`
- `syncErrors`

## Resources

- `crea-ddf://capabilities`
- `crea-ddf://db/schema`

## Development

```sh
pnpm install
pnpm run build
pnpm test
```

For local opencode testing from this repo:

```sh
export DATABASE_URL="postgresql://user:password@localhost:5432/crea_ddf"
pnpm run build
opencode
```

The repo-local `.opencode/opencode.json` starts `node ./dist/index.js` and passes `DATABASE_URL` through with `{env:DATABASE_URL}`.

## Author

Built by Warya Wayne, `@waryawayne`.

- GitHub: [@WaryaWayne](https://github.com/WaryaWayne)
- X: [@waryawayne](https://x.com/waryawayne)
