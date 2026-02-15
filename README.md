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
await client.login('admin', 'admin');

// Navigate to a revision scope
const scope = await client.revision({
  org: 'admin',
  project: 'my-project',
  // branch: 'master',  // default
  // revision: 'draft', // default
});

// Create table with schema
await scope.createTable('posts', {
  type: 'object',
  properties: {
    title: { type: 'string', default: '' },
    published: { type: 'boolean', default: false },
  },
  additionalProperties: false,
  required: ['title', 'published'],
});

// Create row
await scope.createRow('posts', 'post-1', {
  title: 'Hello World',
  published: true,
});

// Read data
const rows = await scope.getRows('posts', { first: 100 });
const row = await scope.getRow('posts', 'post-1');

// Commit changes
await scope.commit('Initial content');
```

## API

### Authentication

```typescript
await client.login('username', 'password');
// or
client.loginWithToken('jwt-token');

client.isAuthenticated(); // boolean
const user = await client.me(); // { id, username, email, hasPassword }
```

### Scope Hierarchy

The client provides a hierarchical navigation model:

```
RevisiumClient
  └── OrgScope             — organization-level operations
       └── ProjectScope    — project-level operations
            └── BranchScope — branch-level operations, holds head + draft revision IDs
                 └── RevisionScope — all data operations (tables, rows, migrations)
```

Each level is created synchronously except `BranchScope` (fetches head + draft revision IDs) and `RevisionScope` via `branch.revision(id)` (validates the revision exists).

### Shortcuts

For common cases, skip intermediate scopes with shortcuts on `RevisiumClient`:

```typescript
// Jump directly to a branch
const branch = await client.branch({
  org: 'admin',
  project: 'my-project',
  branch: 'master', // default
});

// Jump directly to a revision scope
const scope = await client.revision({
  org: 'admin',
  project: 'my-project',
  branch: 'master',    // default
  revision: 'draft',   // 'draft' | 'head' | '<revisionId>', default: 'draft'
});
```

### Full Hierarchy Navigation

```typescript
const org = client.org('admin');
const project = org.project('my-project');
const branch = await project.branch('master');

const draft = branch.draft();   // RevisionScope for draft revision
const head = branch.head();     // RevisionScope for head revision
const rev = await branch.revision('some-revision-id'); // specific revision
```

### OrgScope

```typescript
const org = client.org('admin');

await org.getProjects({ first: 100, after: 'cursor' });
await org.createProject({ projectName: 'new-project', branchName: 'master' });
await org.getUsers();
await org.addUser(userId, 'developer');
await org.removeUser(userId);
```

### ProjectScope

```typescript
const project = client.org('admin').project('my-project');

await project.get();
await project.update({ isPublic: true });
await project.delete();
await project.getBranches();
await project.getRootBranch();
await project.createBranch('feature', revisionId);
await project.getUsers();
await project.addUser(userId, 'editor');
await project.removeUser(userId);
await project.getEndpoints();
await project.createEndpoint({ type: 'GRAPHQL' });
await project.deleteEndpoint(endpointId);
await project.getEndpointRelatives(endpointId);
```

### BranchScope

```typescript
const branch = await client.branch({ org: 'admin', project: 'my-project' });

branch.headRevisionId;   // string
branch.draftRevisionId;  // string

await branch.get();
await branch.delete();
await branch.getTouched();
await branch.getRevisions({ first: 100 });
await branch.getStartRevision();
```

### RevisionScope — Read Operations

```typescript
const scope = await client.revision({ org: 'admin', project: 'my-project' });

// Tables
await scope.getTables({ first: 100, after: 'cursor' });
await scope.getTable('posts');
await scope.getTableSchema('posts');
await scope.getTableCountRows('posts');
await scope.getTableForeignKeysBy('posts');
await scope.getTableForeignKeysTo('posts');

// Rows
await scope.getRows('posts', { first: 100 });
await scope.getRow('posts', 'post-1');
await scope.getRowForeignKeysBy('posts', 'post-1', 'comments');
await scope.getRowForeignKeysTo('posts', 'post-1', 'authors');

// Changes
await scope.getChanges();
await scope.getTableChanges({ changeTypes: ['ADDED', 'MODIFIED'] });
await scope.getRowChanges({ tableId: 'posts' });

// Migrations
await scope.getMigrations();
```

### RevisionScope — Endpoint Operations

Endpoint operations work on any revision (draft, head, or explicit).

```typescript
await scope.getEndpoints();
await scope.getEndpointRelatives(endpointId);
await scope.createEndpoint({ type: 'GRAPHQL' });
await scope.deleteEndpoint(endpointId);
```

### RevisionScope — Write Operations (draft only)

Write methods throw if the scope is not a draft revision.

```typescript
const draft = branch.draft();

// Tables
await draft.createTable('posts', schema);
await draft.updateTable('posts', patches);
await draft.deleteTable('posts');
await draft.renameTable('posts', 'articles');

// Rows
await draft.createRow('posts', 'row-1', data);
await draft.createRows('posts', [{ rowId: 'r1', data }, { rowId: 'r2', data }]);
await draft.createRows('posts', rows, { isRestore: true });
await draft.updateRow('posts', 'row-1', data);
await draft.updateRows('posts', [{ rowId: 'r1', data }]);
await draft.patchRow('posts', 'row-1', [{ op: 'replace', path: 'title', value: 'New' }]);
await draft.patchRows('posts', { rows: [...] });
await draft.deleteRow('posts', 'row-1');
await draft.deleteRows('posts', ['row-1', 'row-2']);
await draft.renameRow('posts', 'row-1', 'post-1');

// Migrations
await draft.applyMigrations([{ changeType: 'init', tableId: 'posts', ... }]);
const results = await draft.applyMigrationsWithStatus(migrations);

// File upload
await draft.uploadFile('posts', 'post-1', 'avatar', file);
```

### Version Control (draft only)

```typescript
const revision = await draft.commit('my changes');
await draft.revertChanges();
```

After `commit`, `revertChanges`, or `applyMigrations`, the scope automatically refreshes its `revisionId` and marks sibling scopes on the same branch as stale.

### Stale Scopes

When one scope commits or reverts, all sibling scopes (created from the same `BranchScope`) on the same branch are marked stale.

```typescript
const branch = await client.branch({ org: 'admin', project: 'my-project' });
const scopeA = branch.draft();
const scopeB = branch.draft();

await scopeA.commit('changes');
// scopeB.isStale === true — auto-refreshes revisionId on next data access

scopeA.dispose(); // unregister from BranchScope tracking
scopeB.dispose();
```

- Stale scopes auto-refresh their `revisionId` on the next data method call
- Scopes with explicit `revisionId` (via `branch.revision(id)`) never go stale
- Concurrent reads on a stale scope share a single refresh call (promise dedup)

### RevisionScope Properties

```typescript
scope.organizationId;  // string
scope.projectName;     // string
scope.branchName;      // string
scope.revisionId;      // string
scope.isDraft;         // boolean
scope.isStale;         // boolean
scope.isDisposed;      // boolean
scope.client;          // underlying HTTP client
```

## Error Handling

Methods throw on errors instead of returning `{ data, error }`:

```typescript
const branch = await client.branch({ org: 'admin', project: 'my-project' });

// Mutations in read-only revision
const head = branch.head();
try {
  await head.createRow('posts', 'row-1', { title: 'Hello' });
} catch (err) {
  console.error(err.message);
  // "Mutations are only allowed in draft revision."
}

// Disposed scope
const scope = branch.draft();
scope.dispose();
try {
  await scope.getTables();
} catch (err) {
  console.error(err.message); // "Scope has been disposed."
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
