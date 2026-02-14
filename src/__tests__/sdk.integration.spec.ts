import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createClient, createConfig } from '../generated/client/index.js';
import * as sdk from '../generated/sdk.gen.js';
import { RevisiumClient } from '../revisium-client.js';
import { RevisiumScope } from '../revisium-scope.js';

const BASE_URL = process.env.REVISIUM_URL || 'http://localhost:8080';
const USERNAME = process.env.REVISIUM_USERNAME || 'admin';
const PASSWORD = process.env.REVISIUM_PASSWORD || 'admin';

describe('SDK Integration', () => {
  const testClient = createClient(createConfig({ baseUrl: BASE_URL }));

  let token: string;
  const organizationId = USERNAME;
  const projectName = `test-client-${Date.now()}`;

  beforeAll(async () => {
    const result = await sdk.login({
      client: testClient,
      body: { emailOrUsername: USERNAME, password: PASSWORD },
    });

    expect(result.error).toBeUndefined();
    token = result.data!.accessToken;
    testClient.setConfig({ auth: token });
  });

  afterAll(async () => {
    await sdk.deleteProject({
      client: testClient,
      path: { organizationId, projectName },
    });
  });

  it('me', async () => {
    const result = await sdk.me({ client: testClient });

    expect(result.error).toBeUndefined();
    expect(result.data!.username).toBe(USERNAME);
  });

  it('projects lifecycle', async () => {
    const createResult = await sdk.createProject({
      client: testClient,
      path: { organizationId },
      body: { projectName },
    });

    expect(createResult.error).toBeUndefined();
    expect(createResult.data!.name).toBe(projectName);

    const getResult = await sdk.project({
      client: testClient,
      path: { organizationId, projectName },
    });

    expect(getResult.error).toBeUndefined();
    expect(getResult.data!.name).toBe(projectName);

    const listResult = await sdk.projects({
      client: testClient,
      path: { organizationId },
      query: { first: 100 },
    });

    expect(listResult.error).toBeUndefined();
    expect(
      listResult.data!.edges.some((e) => e.node.name === projectName),
    ).toBe(true);
  });

  it('branch and revision', async () => {
    const rootResult = await sdk.rootBranch({
      client: testClient,
      path: { organizationId, projectName },
    });

    expect(rootResult.error).toBeUndefined();
    expect(rootResult.data!.name).toBe('master');

    const branchResult = await sdk.branch({
      client: testClient,
      path: { organizationId, projectName, branchName: 'master' },
    });

    expect(branchResult.error).toBeUndefined();

    const draftResult = await sdk.draftRevision({
      client: testClient,
      path: { organizationId, projectName, branchName: 'master' },
    });

    expect(draftResult.error).toBeUndefined();
    expect(draftResult.data!.id).toBeDefined();

    const headResult = await sdk.headRevision({
      client: testClient,
      path: { organizationId, projectName, branchName: 'master' },
    });

    expect(headResult.error).toBeUndefined();
    expect(headResult.data!.id).toBeDefined();
  });

  describe('tables and rows', () => {
    let draftRevisionId: string;
    const tableId = 'test-table';
    const rowId = 'row-1';

    beforeAll(async () => {
      const draftResult = await sdk.draftRevision({
        client: testClient,
        path: { organizationId, projectName, branchName: 'master' },
      });
      draftRevisionId = draftResult.data!.id;
    });

    it('create table', async () => {
      const result = await sdk.createTable({
        client: testClient,
        path: { revisionId: draftRevisionId },
        body: {
          tableId,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', default: '' },
              ver: { type: 'number', default: 0 },
            },
            additionalProperties: false,
            required: ['name', 'ver'],
          },
        },
      });

      expect(result.error).toBeUndefined();
      expect(result.data!.table.id).toBe(tableId);
    });

    it('list tables', async () => {
      const result = await sdk.tables({
        client: testClient,
        path: { revisionId: draftRevisionId },
        query: { first: 100 },
      });

      expect(result.error).toBeUndefined();
      expect(result.data!.edges.some((e) => e.node.id === tableId)).toBe(true);
    });

    it('get table', async () => {
      const result = await sdk.table({
        client: testClient,
        path: { revisionId: draftRevisionId, tableId },
      });

      expect(result.error).toBeUndefined();
      expect(result.data!.id).toBe(tableId);
    });

    it('get table schema', async () => {
      const result = await sdk.tableSchema({
        client: testClient,
        path: { revisionId: draftRevisionId, tableId },
      });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('create row', async () => {
      const result = await sdk.createRow({
        client: testClient,
        path: { revisionId: draftRevisionId, tableId },
        body: { rowId, data: { name: 'test', ver: 1 } },
      });

      expect(result.error).toBeUndefined();
      expect(result.data!.row.id).toBe(rowId);
    });

    it('get row', async () => {
      const result = await sdk.row({
        client: testClient,
        path: { revisionId: draftRevisionId, tableId, rowId },
      });

      expect(result.error).toBeUndefined();
      expect(result.data!.id).toBe(rowId);
      expect(result.data!.data).toEqual({ name: 'test', ver: 1 });
    });

    it('list rows', async () => {
      const result = await sdk.rows({
        client: testClient,
        path: { revisionId: draftRevisionId, tableId },
        body: { first: 100 },
      });

      expect(result.error).toBeUndefined();
      expect(result.data!.edges.length).toBeGreaterThanOrEqual(1);
    });

    it('update row', async () => {
      const result = await sdk.updateRow({
        client: testClient,
        path: { revisionId: draftRevisionId, tableId, rowId },
        body: { data: { name: 'updated', ver: 2 } },
      });

      expect(result.error).toBeUndefined();

      const getResult = await sdk.row({
        client: testClient,
        path: { revisionId: draftRevisionId, tableId, rowId },
      });

      expect(getResult.data!.data).toEqual({ name: 'updated', ver: 2 });
    });

    it('commit revision', async () => {
      const result = await sdk.createRevision({
        client: testClient,
        path: { organizationId, projectName, branchName: 'master' },
        body: { comment: 'test commit' },
      });

      expect(result.error).toBeUndefined();
      expect(result.data!.id).toBeDefined();
    });

    it('revision changes', async () => {
      const draftResult = await sdk.draftRevision({
        client: testClient,
        path: { organizationId, projectName, branchName: 'master' },
      });
      const newDraftId = draftResult.data!.id;

      const result = await sdk.revisionChanges({
        client: testClient,
        path: { revisionId: newDraftId },
      });

      expect(result.error).toBeUndefined();
    });
  });

  it('error handling - 401', async () => {
    const unauthClient = createClient(createConfig({ baseUrl: BASE_URL }));

    const result = await sdk.me({ client: unauthClient });

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  it('error handling - 404 project', async () => {
    const result = await sdk.project({
      client: testClient,
      path: { organizationId, projectName: 'non-existent-project' },
    });

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });
});

describe('RevisiumClient Integration', () => {
  const projectName = `test-hla-${Date.now()}`;
  const rc = new RevisiumClient({ baseUrl: BASE_URL });

  const tableSchema = {
    type: 'object',
    properties: {
      title: { type: 'string', default: '' },
      count: { type: 'number', default: 0 },
    },
    additionalProperties: false,
    required: ['title', 'count'],
  };

  beforeAll(async () => {
    await rc.login(USERNAME, PASSWORD);
    expect(rc.isAuthenticated()).toBe(true);

    const testClient = createClient(
      createConfig({ baseUrl: BASE_URL, auth: rc.client.getConfig().auth }),
    );
    await sdk.createProject({
      client: testClient,
      path: { organizationId: USERNAME },
      body: { projectName },
    });
  });

  afterAll(async () => {
    const testClient = createClient(
      createConfig({ baseUrl: BASE_URL, auth: rc.client.getConfig().auth }),
    );
    await sdk.deleteProject({
      client: testClient,
      path: { organizationId: USERNAME, projectName },
    });
  });

  it('me returns authenticated user', async () => {
    const user = await rc.me();
    expect(user.username).toBe(USERNAME);
    expect(user.id).toBeDefined();
  });

  it('setContext with draft revision', async () => {
    await rc.setContext({
      organizationId: USERNAME,
      projectName,
      branchName: 'master',
      revision: 'draft',
    });

    expect(rc.organizationId).toBe(USERNAME);
    expect(rc.projectName).toBe(projectName);
    expect(rc.branchName).toBe('master');
    expect(rc.revisionId).toBeDefined();
    expect(rc.isDraft).toBe(true);
  });

  it('createTable and getTables', async () => {
    const createResult = await rc.createTable('posts', tableSchema);
    expect(createResult.table.id).toBe('posts');

    const tables = await rc.getTables();
    expect(tables.edges.some((e) => e.node.id === 'posts')).toBe(true);
  });

  it('getTable and getTableSchema', async () => {
    const table = await rc.getTable('posts');
    expect(table.id).toBe('posts');

    const schema = await rc.getTableSchema('posts');
    expect(schema).toBeDefined();
  });

  it('createRow and getRow', async () => {
    const createResult = await rc.createRow('posts', 'post-1', {
      title: 'Hello',
      count: 1,
    });
    expect(createResult.row.id).toBe('post-1');

    const row = await rc.getRow('posts', 'post-1');
    expect(row.id).toBe('post-1');
    expect(row.data).toEqual({ title: 'Hello', count: 1 });
  });

  it('getRows', async () => {
    const rows = await rc.getRows('posts', { first: 100 });
    expect(rows.edges.length).toBeGreaterThanOrEqual(1);
  });

  it('updateRow', async () => {
    await rc.updateRow('posts', 'post-1', { title: 'Updated', count: 2 });

    const row = await rc.getRow('posts', 'post-1');
    expect(row.data).toEqual({ title: 'Updated', count: 2 });
  });

  it('renameRow', async () => {
    await rc.renameRow('posts', 'post-1', 'article-1');

    const row = await rc.getRow('posts', 'article-1');
    expect(row.id).toBe('article-1');
  });

  it('commit and revisionId changes', async () => {
    const oldRevisionId = rc.revisionId;

    const revision = await rc.commit('first commit');
    expect(revision.id).toBeDefined();
    expect(rc.revisionId).not.toBe(oldRevisionId);
    expect(rc.isDraft).toBe(true);
  });

  it('getChanges after commit', async () => {
    const changes = await rc.getChanges();
    expect(changes).toBeDefined();
    expect(changes.totalChanges).toBe(0);
  });

  it('commit twice — modify after commit and commit again', async () => {
    await rc.updateRow('posts', 'article-1', {
      title: 'Second edit',
      count: 3,
    });

    const revisionIdBeforeSecondCommit = rc.revisionId;
    const revision = await rc.commit('second commit');
    expect(revision.id).toBeDefined();
    expect(rc.revisionId).not.toBe(revisionIdBeforeSecondCommit);
    expect(rc.isDraft).toBe(true);

    const row = await rc.getRow('posts', 'article-1');
    expect(row.data).toEqual({ title: 'Second edit', count: 3 });
  });

  it('patchRow', async () => {
    const result = await rc.patchRow('posts', 'article-1', [
      { op: 'replace', path: 'title', value: 'Patched' },
    ]);
    expect(result.row).toBeDefined();
    expect(result.row!.data).toEqual({ title: 'Patched', count: 3 });
  });

  it.skip('createRows', async () => {
    const result = await rc.createRows('posts', [
      { rowId: 'bulk-1', data: { title: 'Bulk 1', count: 10 } },
      { rowId: 'bulk-2', data: { title: 'Bulk 2', count: 20 } },
    ]);
    expect(result.rows).toHaveLength(2);
  });

  it.skip('updateRows', async () => {
    const result = await rc.updateRows('posts', [
      { rowId: 'bulk-1', data: { title: 'Bulk 1 Updated', count: 11 } },
      { rowId: 'bulk-2', data: { title: 'Bulk 2 Updated', count: 21 } },
    ]);
    expect(result.rows).toHaveLength(2);
  });

  it.skip('deleteRows', async () => {
    await rc.deleteRows('posts', ['bulk-1', 'bulk-2']);

    const rows = await rc.getRows('posts', { first: 100 });
    const ids = rows.edges.map((e) => e.node.id);
    expect(ids).not.toContain('bulk-1');
    expect(ids).not.toContain('bulk-2');
  });

  it('revertChanges', async () => {
    await rc.revertChanges();
    expect(rc.isDraft).toBe(true);
    expect(rc.revisionId).toBeDefined();
  });

  it('getMigrations returns empty on fresh revision', async () => {
    const migrations = await rc.getMigrations();
    expect(migrations).toEqual([]);
  });

  it('applyMigrations and getMigrations round-trip', async () => {
    await rc.applyMigrations([
      {
        changeType: 'init',
        tableId: 'migrated-table',
        hash: 'abc123',
        id: new Date().toISOString(),
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', default: '' },
          },
          additionalProperties: false,
          required: ['name'],
        },
      },
    ]);

    const migrations = await rc.getMigrations();
    expect(migrations.length).toBeGreaterThanOrEqual(1);
    expect(migrations.some((m) => m.tableId === 'migrated-table')).toBe(true);

    await rc.deleteTable('migrated-table');
    await rc.revertChanges();
  });

  it('createRows with isRestore', async () => {
    await rc.setContext({
      organizationId: USERNAME,
      projectName,
      revision: 'draft',
    });

    await rc.createTable('restore-test', tableSchema);

    const result = await rc.createRows(
      'restore-test',
      [
        { rowId: 'r1', data: { title: 'A', count: 1 } },
        { rowId: 'r2', data: { title: 'B', count: 2 } },
      ],
      { isRestore: true },
    );
    expect(result.rows).toHaveLength(2);

    await rc.deleteTable('restore-test');
    await rc.revertChanges();
  });

  it('deleteRow and deleteTable', async () => {
    await rc.createRow('posts', 'temp-row', { title: 'Temp', count: 0 });
    await rc.deleteRow('posts', 'temp-row');
    await rc.deleteTable('posts');

    const tables = await rc.getTables();
    expect(tables.edges.some((e) => e.node.id === 'posts')).toBe(false);
  });

  describe('head revision prevents mutations', () => {
    beforeAll(async () => {
      await rc.setContext({
        organizationId: USERNAME,
        projectName,
        branchName: 'master',
        revision: 'head',
      });
    });

    it('isDraft is false', () => {
      expect(rc.isDraft).toBe(false);
    });

    it('read operations work', async () => {
      const tables = await rc.getTables();
      expect(tables).toBeDefined();
    });

    it('createTable throws', async () => {
      await expect(rc.createTable('test', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('createRow throws', async () => {
      await expect(rc.createRow('test', 'row-1', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('commit throws', async () => {
      await expect(rc.commit()).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });
  });

  describe('explicit revisionId prevents mutations', () => {
    beforeAll(async () => {
      const headRc = new RevisiumClient({ baseUrl: BASE_URL });
      headRc.loginWithToken(rc.client.getConfig().auth as string);
      await headRc.setContext({
        organizationId: USERNAME,
        projectName,
        branchName: 'master',
        revision: 'head',
      });

      await rc.setContext({
        organizationId: USERNAME,
        projectName,
        branchName: 'master',
        revision: headRc.revisionId!,
      });
    });

    it('isDraft is false', () => {
      expect(rc.isDraft).toBe(false);
    });

    it('createTable throws', async () => {
      await expect(rc.createTable('test', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });
  });

  describe('context switching', () => {
    it('switch draft → head → draft preserves correct state', async () => {
      await rc.setContext({
        organizationId: USERNAME,
        projectName,
        branchName: 'master',
        revision: 'draft',
      });
      const draftRevisionId = rc.revisionId;
      expect(rc.isDraft).toBe(true);

      await rc.setContext({
        organizationId: USERNAME,
        projectName,
        branchName: 'master',
        revision: 'head',
      });
      const headRevisionId = rc.revisionId;
      expect(rc.isDraft).toBe(false);
      expect(headRevisionId).not.toBe(draftRevisionId);

      await rc.setContext({
        organizationId: USERNAME,
        projectName,
        branchName: 'master',
        revision: 'draft',
      });
      expect(rc.isDraft).toBe(true);
      expect(rc.revisionId).toBe(draftRevisionId);
    });

    it('switch to explicit revisionId', async () => {
      await rc.setContext({
        organizationId: USERNAME,
        projectName,
        branchName: 'master',
        revision: 'head',
      });
      const headRevisionId = rc.revisionId!;

      await rc.setContext({
        organizationId: USERNAME,
        projectName,
        branchName: 'master',
        revision: headRevisionId,
      });
      expect(rc.revisionId).toBe(headRevisionId);
      expect(rc.isDraft).toBe(false);
    });

    it('defaults to draft and master', async () => {
      await rc.setContext({
        organizationId: USERNAME,
        projectName,
      });
      expect(rc.branchName).toBe('master');
      expect(rc.isDraft).toBe(true);
      expect(rc.revisionId).toBeDefined();
    });

    it('head allows reads, draft allows writes after switch', async () => {
      await rc.setContext({
        organizationId: USERNAME,
        projectName,
        revision: 'head',
      });
      const tables = await rc.getTables();
      expect(tables).toBeDefined();
      await expect(rc.createTable('tmp', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );

      await rc.setContext({
        organizationId: USERNAME,
        projectName,
        revision: 'draft',
      });
      const createResult = await rc.createTable('ctx-test', {
        type: 'object',
        properties: { name: { type: 'string', default: '' } },
        additionalProperties: false,
        required: ['name'],
      });
      expect(createResult.table.id).toBe('ctx-test');

      await rc.deleteTable('ctx-test');
    });

    it('setContext with invalid revisionId throws', async () => {
      await expect(
        rc.setContext({
          organizationId: USERNAME,
          projectName,
          revision: 'non-existent-revision-id',
        }),
      ).rejects.toThrow();
    });
  });

  describe('no context throws', () => {
    it('getTables throws without context', async () => {
      const fresh = new RevisiumClient({ baseUrl: BASE_URL });
      await expect(fresh.getTables()).rejects.toThrow(
        'Context not set. Call setContext() first.',
      );
    });

    it('getRow throws without context', async () => {
      const fresh = new RevisiumClient({ baseUrl: BASE_URL });
      await expect(fresh.getRow('t', 'r')).rejects.toThrow(
        'Context not set. Call setContext() first.',
      );
    });

    it('commit throws without context', async () => {
      const fresh = new RevisiumClient({ baseUrl: BASE_URL });
      await expect(fresh.commit()).rejects.toThrow(
        'Context not set. Call setContext() first.',
      );
    });
  });
});

describe('RevisiumScope Integration', () => {
  const projectName = `test-scope-${Date.now()}`;
  const rc = new RevisiumClient({ baseUrl: BASE_URL });

  const tableSchema = {
    type: 'object',
    properties: {
      title: { type: 'string', default: '' },
      count: { type: 'number', default: 0 },
    },
    additionalProperties: false,
    required: ['title', 'count'],
  };

  beforeAll(async () => {
    await rc.login(USERNAME, PASSWORD);

    const testClient = createClient(
      createConfig({ baseUrl: BASE_URL, auth: rc.client.getConfig().auth }),
    );
    await sdk.createProject({
      client: testClient,
      path: { organizationId: USERNAME },
      body: { projectName },
    });
  });

  afterAll(async () => {
    const testClient = createClient(
      createConfig({ baseUrl: BASE_URL, auth: rc.client.getConfig().auth }),
    );
    await sdk.deleteProject({
      client: testClient,
      path: { organizationId: USERNAME, projectName },
    });
  });

  it('withContext returns a RevisiumScope', async () => {
    const scope = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      branchName: 'master',
      revision: 'draft',
    });
    expect(scope).toBeInstanceOf(RevisiumScope);
    expect(scope.organizationId).toBe(USERNAME);
    expect(scope.projectName).toBe(projectName);
    expect(scope.branchName).toBe('master');
    expect(scope.isDraft).toBe(true);
    expect(scope.revisionId).toBeDefined();
    scope.dispose();
  });

  it('scope CRUD operations work', async () => {
    const scope = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: 'draft',
    });

    await scope.createTable('items', tableSchema);
    await scope.createRow('items', 'item-1', { title: 'Test', count: 1 });

    const row = await scope.getRow('items', 'item-1');
    expect(row.data).toEqual({ title: 'Test', count: 1 });

    const tables = await scope.getTables();
    expect(tables.edges.some((e) => e.node.id === 'items')).toBe(true);

    await scope.updateRow('items', 'item-1', { title: 'Updated', count: 2 });
    const updatedRow = await scope.getRow('items', 'item-1');
    expect(updatedRow.data).toEqual({ title: 'Updated', count: 2 });

    scope.dispose();
  });

  it('scope commit refreshes revisionId and marks siblings stale', async () => {
    const scopeA = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: 'draft',
    });

    const scopeB = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: 'draft',
    });

    expect(scopeA.isStale).toBe(false);
    expect(scopeB.isStale).toBe(false);

    const oldRevisionId = scopeA.revisionId;
    await scopeA.commit('scope commit');

    expect(scopeA.revisionId).not.toBe(oldRevisionId);
    expect(scopeA.isStale).toBe(false);
    expect(scopeB.isStale).toBe(true);

    scopeA.dispose();
    scopeB.dispose();
  });

  it('stale scope auto-refreshes on data access', async () => {
    const scopeA = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: 'draft',
    });

    const scopeB = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: 'draft',
    });

    await scopeA.createTable('stale-test', tableSchema);
    await scopeA.commit('trigger stale');

    expect(scopeB.isStale).toBe(true);

    const tables = await scopeB.getTables();
    expect(tables).toBeDefined();
    expect(scopeB.isStale).toBe(false);

    scopeA.dispose();
    scopeB.dispose();
  });

  it('explicit revisionId scope never goes stale', async () => {
    const draftScope = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: 'draft',
    });

    const headScope = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: 'head',
    });

    const explicitScope = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: headScope.revisionId,
    });

    await draftScope.createTable('explicit-test', tableSchema);
    await draftScope.commit('explicit test');

    expect(headScope.isStale).toBe(true);
    expect(explicitScope.isStale).toBe(false);

    draftScope.dispose();
    headScope.dispose();
    explicitScope.dispose();
  });

  it('disposed scope throws on operations', async () => {
    const scope = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: 'draft',
    });

    scope.dispose();
    expect(scope.isDisposed).toBe(true);

    await expect(scope.getTables()).rejects.toThrow('Scope has been disposed.');
    await expect(scope.createTable('t', {})).rejects.toThrow(
      'Scope has been disposed.',
    );
  });

  it('head scope prevents mutations', async () => {
    const scope = await rc.withContext({
      organizationId: USERNAME,
      projectName,
      revision: 'head',
    });

    const tables = await scope.getTables();
    expect(tables).toBeDefined();

    await expect(scope.createTable('t', {})).rejects.toThrow(
      'Mutations are only allowed in draft revision',
    );
    await expect(scope.commit()).rejects.toThrow(
      'Mutations are only allowed in draft revision',
    );

    scope.dispose();
  });
});
