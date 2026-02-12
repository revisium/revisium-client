<div align="center">

# @revisium/client

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=revisium_revisium-client&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=revisium_revisium-client)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=revisium_revisium-client&metric=coverage)](https://sonarcloud.io/summary/new_code?id=revisium_revisium-client)
[![GitHub License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/revisium/revisium-client/blob/master/LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/revisium/revisium-client)](https://github.com/revisium/revisium-client/releases)

TypeScript HTTP client for [Revisium](https://revisium.io) REST API.

</div>

## Installation

```bash
npm install @revisium/client
```

## Usage

```typescript
import { RevisiumClient } from '@revisium/client';

const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });

// Authenticate
await client.login({ username: 'admin', password: 'admin' });

// Set project context
client.setProject({ organizationId: 'admin', projectName: 'my-project' });

// Work with data
const rows = await client.getRows('my-table', { first: 100 });
await client.createRow('my-table', 'row-1', { name: 'Test' });
await client.commit('Added test row');
```

## API

### Connection

| Method | Description |
|--------|-------------|
| `login(credentials)` | Authenticate with username/password |
| `loginWithToken(token)` | Authenticate with JWT token |
| `setProject(options)` | Set organization, project, and branch context |

### Data Operations

| Method | Description |
|--------|-------------|
| `getRows(tableId, options?)` | Get rows from a table |
| `getRow(tableId, rowId)` | Get a single row |
| `createRow(tableId, rowId, data)` | Create a new row |
| `updateRow(tableId, rowId, data)` | Update a row |
| `removeRow(tableId, rowId)` | Remove a row |

### Version Control

| Method | Description |
|--------|-------------|
| `commit(comment?)` | Commit pending changes |
| `rollback()` | Revert uncommitted changes |
| `getChanges()` | Get pending changes summary |

### Schema

| Method | Description |
|--------|-------------|
| `getTables()` | List all tables |
| `getTableSchema(tableId)` | Get table JSON Schema |
| `createTable(tableId, schema)` | Create a new table |

## License

MIT
