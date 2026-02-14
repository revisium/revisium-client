<div align="center">

# @revisium/client

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=revisium_revisium-client&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=revisium_revisium-client)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=revisium_revisium-client&metric=coverage)](https://sonarcloud.io/summary/new_code?id=revisium_revisium-client)
[![GitHub License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/revisium/revisium-client/blob/master/LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/revisium/revisium-client)](https://github.com/revisium/revisium-client/releases)

Typed TypeScript client for [Revisium](https://revisium.io) REST API.

</div>

## Installation

```bash
npm install @revisium/client
```

## Quick Start

```typescript
import { RevisiumClient } from '@revisium/client';

const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });

// Set context — resolves revisionId from branch
await client.setContext({
  organizationId: 'admin',
  projectName: 'my-project',
  branchName: 'master',   // default: 'master'
  revision: 'draft',       // default: 'draft'
});

// Create table with schema
await client.createTable('posts', {
  type: 'object',
  properties: {
    title: { type: 'string', default: '' },
    published: { type: 'boolean', default: false },
  },
  additionalProperties: false,
  required: ['title', 'published'],
});

// Create row
await client.createRow('posts', 'post-1', {
  title: 'Hello World',
  published: true,
});

// Read data
const rows = await client.getRows('posts', { first: 100 });
const row = await client.getRow('posts', 'post-1');

// Commit changes
await client.commit('Initial content');

// Read committed data (head revision)
await client.setContext({
  organizationId: 'admin',
  projectName: 'my-project',
  revision: 'head',
});
const tables = await client.getTables();
```

## API

### Authentication (optional)

Authentication is not required when the server runs in no-auth mode. If auth is enabled:

```typescript
await client.login('username', 'password');
// or
client.loginWithToken('jwt-token');

client.isAuthenticated(); // boolean

const user = await client.me(); // { id, username, email, hasPassword }
```

### Context

```typescript
await client.setContext({
  organizationId: 'admin',
  projectName: 'my-project',
  branchName: 'master',      // default: 'master'
  revision: 'draft',          // 'draft' | 'head' | '<revisionId>'
});

client.organizationId;  // current org
client.projectName;     // current project
client.branchName;      // current branch
client.revisionId;      // resolved revision ID
client.isDraft;         // true if revision === 'draft'
```

### Read Operations (any revision)

```typescript
await client.getTables({ first: 100, after: 'cursor' });
await client.getTable('posts');
await client.getTableSchema('posts');
await client.getRows('posts', { first: 100 });
await client.getRow('posts', 'post-1');
await client.getChanges();
await client.getMigrations();
```

### Write Operations (draft only)

Write methods throw if `revision` is not `'draft'`.

```typescript
// Tables
await client.createTable('posts', schema);
await client.updateTable('posts', patches);
await client.deleteTable('posts');
await client.renameTable('posts', 'articles');

// Rows
await client.createRow('posts', 'row-1', data);
await client.createRows('posts', [{ rowId: 'r1', data }, { rowId: 'r2', data }]);
await client.createRows('posts', rows, { isRestore: true }); // restore mode
await client.updateRow('posts', 'row-1', data);
await client.updateRows('posts', [{ rowId: 'r1', data }]);
await client.updateRows('posts', rows, { isRestore: true }); // restore mode
await client.patchRow('posts', 'row-1', [{ op: 'replace', path: 'title', value: 'New' }]);
await client.deleteRow('posts', 'row-1');
await client.deleteRows('posts', ['row-1', 'row-2']);
await client.renameRow('posts', 'row-1', 'post-1');

// Migrations
await client.applyMigrations([
  { type: 'init', tableId: 'posts', schema },
]);
```

### Version Control (draft only)

```typescript
const revision = await client.commit('my changes');  // auto-refreshes draftRevisionId
await client.revertChanges();                        // auto-refreshes draftRevisionId
```

### Isolated Scopes (`withContext`)

Use `withContext()` to create isolated scopes that share authentication but have independent context. Useful for multi-context scenarios (e.g., handling parallel requests in a server).

```typescript
const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
await client.login('admin', 'admin');

// Create isolated scopes — each has its own revisionId
const scopeA = await client.withContext({
  organizationId: 'admin',
  projectName: 'project-a',
  revision: 'draft',
});

const scopeB = await client.withContext({
  organizationId: 'admin',
  projectName: 'project-b',
  revision: 'draft',
});

// Scopes work independently
await scopeA.createRow('posts', 'row-1', { title: 'Hello' });
await scopeB.getTables();

// Commit in one scope marks sibling scopes (same branch) as stale
const scopeC = await client.withContext({
  organizationId: 'admin',
  projectName: 'project-a',
  revision: 'draft',
});

await scopeA.commit('changes');
// scopeC.isStale === true — auto-refreshes on next data access

// Dispose when done to clean up tracking
scopeA.dispose();
scopeB.dispose();
scopeC.dispose();
```

#### Scope Properties

```typescript
scope.organizationId;  // string
scope.projectName;     // string
scope.branchName;      // string
scope.revisionId;      // string — current cached revisionId
scope.isDraft;         // boolean
scope.isStale;         // boolean — true if sibling committed
scope.isDisposed;      // boolean
scope.client;          // underlying HTTP client (shared with parent)
```

#### Scope Methods

```typescript
// Same data methods as RevisiumClient
await scope.getTables();
await scope.createRow('posts', 'row-1', data);
await scope.getMigrations();
await scope.applyMigrations(migrations);
await scope.commit('message');
// ... all other read/write/version-control methods

// Scope-specific
scope.markStale();      // manually mark as stale
await scope.refresh();  // manually refresh revisionId
scope.dispose();        // unregister from parent tracking
```

#### Stale Behavior

- When one scope commits or reverts, all sibling scopes on the same branch are marked stale
- Stale scopes auto-refresh their `revisionId` on the next data method call
- Scopes with explicit `revisionId` (not `'draft'` or `'head'`) never go stale
- Concurrent reads on a stale scope share a single refresh API call (promise dedup)

## Error Handling

`RevisiumClient` methods throw on errors instead of returning `{ data, error }`:

```typescript
// Context not set
try {
  await client.getRows('posts');
} catch (err) {
  console.error(err.message); // "Context not set. Call setContext() first."
}

// Mutations in read-only revision
await client.setContext({
  organizationId: 'admin',
  projectName: 'my-project',
  revision: 'head', // or explicit revisionId
});

try {
  await client.createRow('posts', 'row-1', { title: 'Hello' });
} catch (err) {
  console.error(err.message);
  // "Mutations are only allowed in draft revision. Use setContext({ revision: "draft" })."
}
```

## Low-Level SDK

For advanced use cases, the auto-generated SDK functions are available:

```typescript
import { client, sdk } from '@revisium/client';

client.setConfig({ baseUrl: 'http://localhost:8080' });

const { data, error } = await sdk.login({
  body: { emailOrUsername: 'admin', password: 'admin' },
});

if (error) {
  console.error(error.statusCode, error.message);
} else {
  client.setConfig({ auth: data.accessToken });
}
```

### Custom Client Instance

```typescript
import { createClient, createConfig, sdk } from '@revisium/client';

const myClient = createClient(createConfig({
  baseUrl: 'https://my-revisium.example.com',
  auth: 'my-token',
}));

const result = await sdk.projects({
  client: myClient,
  path: { organizationId: 'admin' },
  query: { first: 100 },
});
```

## Available Low-Level Functions

### Auth

| Function | Method | Description |
|----------|--------|-------------|
| `login` | POST | Authenticate and get access token |
| `me` | GET | Get current user |
| `createUser` | POST | Create user (admin) |
| `updatePassword` | PUT | Update password |

### Projects

| Function | Method | Description |
|----------|--------|-------------|
| `projects` | GET | List projects |
| `project` | GET | Get project by name |
| `createProject` | POST | Create project |
| `updateProject` | PUT | Update project settings |
| `deleteProject` | DELETE | Delete project |

### Branches

| Function | Method | Description |
|----------|--------|-------------|
| `rootBranch` | GET | Get root branch |
| `branches` | GET | List branches |
| `branch` | GET | Get branch by name |
| `branchTouched` | GET | Check for uncommitted changes |
| `createBranch` | POST | Create branch from revision |
| `deleteBranch` | DELETE | Delete branch |
| `parentBranch` | GET | Get parent branch |
| `childBranches` | GET | List child branches |

### Revisions

| Function | Method | Description |
|----------|--------|-------------|
| `draftRevision` | GET | Get draft (working) revision |
| `headRevision` | GET | Get latest committed revision |
| `startRevision` | GET | Get first revision |
| `revision` | GET | Get revision by ID |
| `revisions` | GET | List revisions |
| `createRevision` | POST | Commit changes |
| `revertChanges` | POST | Revert uncommitted changes |
| `parentRevision` | GET | Get parent revision |
| `childRevision` | GET | Get child revision |

### Tables

| Function | Method | Description |
|----------|--------|-------------|
| `tables` | GET | List tables |
| `table` | GET | Get table by ID |
| `tableSchema` | GET | Get table JSON Schema |
| `createTable` | POST | Create table |
| `updateTable` | PATCH | Update table schema (JSON Patch) |
| `renameTable` | PATCH | Rename table |
| `deleteTable` | DELETE | Delete table |
| `tableCountRows` | GET | Count rows in table |

### Rows

| Function | Method | Description |
|----------|--------|-------------|
| `rows` | POST | Query rows (with filters) |
| `row` | GET | Get row by ID |
| `createRow` | POST | Create row |
| `createRows` | POST | Bulk create rows |
| `updateRow` | PUT | Update row data |
| `updateRows` | PUT | Bulk update rows |
| `patchRow` | PATCH | Patch row (JSON Patch) |
| `patchRows` | PATCH | Bulk patch rows |
| `renameRow` | PATCH | Rename row |
| `deleteRow` | DELETE | Delete row |
| `deleteRows` | DELETE | Bulk delete rows |

### Changes

| Function | Method | Description |
|----------|--------|-------------|
| `revisionChanges` | GET | Get revision changes summary |
| `tableChanges` | GET | Get table-level changes |
| `rowChanges` | GET | Get row-level changes |

### Migrations, Endpoints, Foreign Keys

| Function | Method | Description |
|----------|--------|-------------|
| `migrations` | GET | Get migrations |
| `applyMigrations` | POST | Apply migrations |
| `endpoints` | GET | List endpoints |
| `createEndpoint` | POST | Create endpoint |
| `deleteEndpoint` | DELETE | Delete endpoint |
| `endpointRelatives` | GET | Get endpoint relatives |
| `tableForeignKeysBy` | GET | Foreign keys from table |
| `tableForeignKeysTo` | GET | Foreign keys to table |
| `rowForeignKeysBy` | GET | Foreign keys from row |
| `rowForeignKeysTo` | GET | Foreign keys to row |
| `uploadFile` | POST | Upload file |

### System

| Function | Method | Description |
|----------|--------|-------------|
| `getConfiguration` | GET | Get server configuration |
| `liveness` | GET | Liveness probe |
| `readiness` | GET | Readiness probe |

### Organization & Users

| Function | Method | Description |
|----------|--------|-------------|
| `usersOrganization` | GET | List organization users |
| `addUserToOrganization` | POST | Add user to organization |
| `removeUserFromOrganization` | DELETE | Remove user from organization |
| `usersProject` | GET | List project users |
| `addUserToProject` | POST | Add user to project |
| `removeUserFromProject` | DELETE | Remove user from project |

## Development

```bash
npm run generate          # Regenerate client from OpenAPI spec
npm run generate:download # Download spec and regenerate
npm run tsc               # TypeScript check
npm run lint:ci           # Lint
npm test                  # Unit tests
npm run test:integration  # Integration tests (requires running Revisium)
npm run build             # Build
```

## License

MIT
