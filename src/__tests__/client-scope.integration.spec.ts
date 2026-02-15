import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createClient, createConfig } from '../generated/client/index.js';
import * as sdk from '../generated/sdk.gen.js';
import { RevisiumClient } from '../revisium-client.js';
import { BranchScope } from '../branch-scope.js';
import { RevisionScope } from '../revision-scope.js';
import { OrgScope } from '../org-scope.js';

const BASE_URL = process.env.REVISIUM_URL || 'http://localhost:8080';
const USERNAME = process.env.REVISIUM_USERNAME || 'admin';
const PASSWORD = process.env.REVISIUM_PASSWORD || 'admin';

describe('RevisiumClient Scope Integration', () => {
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

  it('org() returns OrgScope', () => {
    const orgScope = rc.org(USERNAME);
    expect(orgScope).toBeInstanceOf(OrgScope);
    expect(orgScope.organizationId).toBe(USERNAME);
  });

  it('branch() shortcut returns BranchScope', async () => {
    const bs = await rc.branch({
      org: USERNAME,
      project: projectName,
    });
    expect(bs).toBeInstanceOf(BranchScope);
    expect(bs.organizationId).toBe(USERNAME);
    expect(bs.projectName).toBe(projectName);
    expect(bs.branchName).toBe('master');
    expect(bs.headRevisionId).toBeDefined();
    expect(bs.draftRevisionId).toBeDefined();
  });

  it('revision() shortcut returns draft RevisionScope by default', async () => {
    const scope = await rc.revision({
      org: USERNAME,
      project: projectName,
    });
    expect(scope).toBeInstanceOf(RevisionScope);
    expect(scope.isDraft).toBe(true);
    expect(scope.revisionId).toBeDefined();
    scope.dispose();
  });

  it('revision() shortcut with head', async () => {
    const scope = await rc.revision({
      org: USERNAME,
      project: projectName,
      revision: 'head',
    });
    expect(scope).toBeInstanceOf(RevisionScope);
    expect(scope.isDraft).toBe(false);
    scope.dispose();
  });

  describe('draft scope CRUD operations', () => {
    let bs: BranchScope;
    let draft: RevisionScope;

    beforeAll(async () => {
      bs = await rc.branch({ org: USERNAME, project: projectName });
      draft = bs.draft();
    });

    afterAll(() => {
      draft.dispose();
    });

    it('createTable and getTables', async () => {
      const createResult = await draft.createTable('posts', tableSchema);
      expect(createResult.table.id).toBe('posts');

      const tables = await draft.getTables();
      expect(tables.edges.some((e) => e.node.id === 'posts')).toBe(true);
    });

    it('getTable and getTableSchema', async () => {
      const table = await draft.getTable('posts');
      expect(table.id).toBe('posts');

      const schema = await draft.getTableSchema('posts');
      expect(schema).toBeDefined();
    });

    it('createRow and getRow', async () => {
      const createResult = await draft.createRow('posts', 'post-1', {
        title: 'Hello',
        count: 1,
      });
      expect(createResult.row.id).toBe('post-1');

      const row = await draft.getRow('posts', 'post-1');
      expect(row.id).toBe('post-1');
      expect(row.data).toEqual({ title: 'Hello', count: 1 });
    });

    it('getRows', async () => {
      const rows = await draft.getRows('posts', { first: 100 });
      expect(rows.edges.length).toBeGreaterThanOrEqual(1);
    });

    it('updateRow', async () => {
      await draft.updateRow('posts', 'post-1', {
        title: 'Updated',
        count: 2,
      });

      const row = await draft.getRow('posts', 'post-1');
      expect(row.data).toEqual({ title: 'Updated', count: 2 });
    });

    it('renameRow', async () => {
      await draft.renameRow('posts', 'post-1', 'article-1');

      const row = await draft.getRow('posts', 'article-1');
      expect(row.id).toBe('article-1');
    });

    it('commit and revisionId changes', async () => {
      const oldRevisionId = draft.revisionId;

      const revision = await draft.commit('first commit');
      expect(revision.id).toBeDefined();
      expect(draft.revisionId).not.toBe(oldRevisionId);
      expect(draft.isDraft).toBe(true);
    });

    it('getChanges after commit', async () => {
      const changes = await draft.getChanges();
      expect(changes).toBeDefined();
      expect(changes.totalChanges).toBe(0);
    });

    it('commit twice — modify after commit and commit again', async () => {
      await draft.updateRow('posts', 'article-1', {
        title: 'Second edit',
        count: 3,
      });

      const revisionIdBeforeSecondCommit = draft.revisionId;
      const revision = await draft.commit('second commit');
      expect(revision.id).toBeDefined();
      expect(draft.revisionId).not.toBe(revisionIdBeforeSecondCommit);
      expect(draft.isDraft).toBe(true);

      const row = await draft.getRow('posts', 'article-1');
      expect(row.data).toEqual({ title: 'Second edit', count: 3 });
    });

    it('patchRow', async () => {
      const result = await draft.patchRow('posts', 'article-1', [
        { op: 'replace', path: 'title', value: 'Patched' },
      ]);
      expect(result.row).toBeDefined();
      expect(result.row!.data).toEqual({ title: 'Patched', count: 3 });
    });

    it.skip('createRows', async () => {
      const result = await draft.createRows('posts', [
        { rowId: 'bulk-1', data: { title: 'Bulk 1', count: 10 } },
        { rowId: 'bulk-2', data: { title: 'Bulk 2', count: 20 } },
      ]);
      expect(result.rows).toHaveLength(2);
    });

    it.skip('updateRows', async () => {
      const result = await draft.updateRows('posts', [
        { rowId: 'bulk-1', data: { title: 'Bulk 1 Updated', count: 11 } },
        { rowId: 'bulk-2', data: { title: 'Bulk 2 Updated', count: 21 } },
      ]);
      expect(result.rows).toHaveLength(2);
    });

    it.skip('deleteRows', async () => {
      await draft.deleteRows('posts', ['bulk-1', 'bulk-2']);

      const rows = await draft.getRows('posts', { first: 100 });
      const ids = rows.edges.map((e) => e.node.id);
      expect(ids).not.toContain('bulk-1');
      expect(ids).not.toContain('bulk-2');
    });

    it('revertChanges', async () => {
      await draft.revertChanges();
      expect(draft.isDraft).toBe(true);
      expect(draft.revisionId).toBeDefined();
    });

    it('getMigrations returns migrations for committed tables', async () => {
      const migrations = await draft.getMigrations();
      expect(migrations.length).toBeGreaterThanOrEqual(1);
      expect(migrations.some((m) => m.tableId === 'posts')).toBe(true);
    });

    it('applyMigrations and getMigrations round-trip', async () => {
      await draft.applyMigrations([
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

      const migrations = await draft.getMigrations();
      expect(migrations.length).toBeGreaterThanOrEqual(1);
      expect(migrations.some((m) => m.tableId === 'migrated-table')).toBe(true);

      await draft.deleteTable('migrated-table');
      await draft.revertChanges();
    });

    it('createRows with isRestore', async () => {
      await draft.createTable('restore-test', tableSchema);

      const result = await draft.createRows(
        'restore-test',
        [
          { rowId: 'r1', data: { title: 'A', count: 1 } },
          { rowId: 'r2', data: { title: 'B', count: 2 } },
        ],
        { isRestore: true },
      );
      expect(result.rows).toHaveLength(2);

      await draft.deleteTable('restore-test');
      await draft.revertChanges();
    });

    it('deleteRow and deleteTable', async () => {
      await draft.createRow('posts', 'temp-row', { title: 'Temp', count: 0 });
      await draft.deleteRow('posts', 'temp-row');
      await draft.deleteTable('posts');

      const tables = await draft.getTables();
      expect(tables.edges.some((e) => e.node.id === 'posts')).toBe(false);
    });
  });

  describe('head revision prevents mutations', () => {
    let headScope: RevisionScope;

    beforeAll(async () => {
      const bs = await rc.branch({
        org: USERNAME,
        project: projectName,
      });
      headScope = bs.head();
    });

    afterAll(() => {
      headScope.dispose();
    });

    it('isDraft is false', () => {
      expect(headScope.isDraft).toBe(false);
    });

    it('read operations work', async () => {
      const tables = await headScope.getTables();
      expect(tables).toBeDefined();
    });

    it('createTable throws', async () => {
      await expect(headScope.createTable('test', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('createRow throws', async () => {
      await expect(headScope.createRow('test', 'row-1', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('commit throws', async () => {
      await expect(headScope.commit()).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });
  });

  describe('explicit revisionId prevents mutations', () => {
    let explicitScope: RevisionScope;

    beforeAll(async () => {
      const bs = await rc.branch({
        org: USERNAME,
        project: projectName,
      });
      explicitScope = await bs.revision(bs.headRevisionId);
    });

    afterAll(() => {
      explicitScope.dispose();
    });

    it('isDraft is false', () => {
      expect(explicitScope.isDraft).toBe(false);
    });

    it('createTable throws', async () => {
      await expect(explicitScope.createTable('test', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });
  });

  describe('revision shortcut defaults', () => {
    it('defaults to draft and master', async () => {
      const scope = await rc.revision({
        org: USERNAME,
        project: projectName,
      });
      expect(scope.branchName).toBe('master');
      expect(scope.isDraft).toBe(true);
      expect(scope.revisionId).toBeDefined();
      scope.dispose();
    });

    it('head scope allows reads, draft allows writes', async () => {
      const headScope = await rc.revision({
        org: USERNAME,
        project: projectName,
        revision: 'head',
      });
      const tables = await headScope.getTables();
      expect(tables).toBeDefined();
      await expect(headScope.createTable('tmp', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
      headScope.dispose();

      const draftScope = await rc.revision({
        org: USERNAME,
        project: projectName,
        revision: 'draft',
      });
      const createResult = await draftScope.createTable('ctx-test', {
        type: 'object',
        properties: { name: { type: 'string', default: '' } },
        additionalProperties: false,
        required: ['name'],
      });
      expect(createResult.table.id).toBe('ctx-test');

      await draftScope.deleteTable('ctx-test');
      draftScope.dispose();
    });

    it('explicit revisionId via revision shortcut', async () => {
      const headScope = await rc.revision({
        org: USERNAME,
        project: projectName,
        revision: 'head',
      });
      const headRevisionId = headScope.revisionId;
      headScope.dispose();

      const explicitScope = await rc.revision({
        org: USERNAME,
        project: projectName,
        revision: headRevisionId,
      });
      expect(explicitScope.revisionId).toBe(headRevisionId);
      expect(explicitScope.isDraft).toBe(false);
      explicitScope.dispose();
    });

    it('invalid revisionId via revision shortcut throws', async () => {
      await expect(
        rc.revision({
          org: USERNAME,
          project: projectName,
          revision: 'non-existent-revision-id',
        }),
      ).rejects.toThrow();
    });
  });
});
