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

describe('Scope Hierarchy Integration', () => {
  const projectName = `test-hierarchy-${Date.now()}`;
  const rc = new RevisiumClient({ baseUrl: BASE_URL });

  const tableSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', default: '' },
    },
    additionalProperties: false,
    required: ['name'],
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

  describe('OrgScope', () => {
    it('org returns OrgScope with correct organizationId', () => {
      const org = rc.org(USERNAME);
      expect(org).toBeInstanceOf(OrgScope);
      expect(org.organizationId).toBe(USERNAME);
    });

    it('getProjects returns projects list', async () => {
      const org = rc.org(USERNAME);
      const projects = await org.getProjects({ first: 100 });
      expect(projects.totalCount).toBeGreaterThan(0);
      expect(projects.edges.some((e) => e.node.name === projectName)).toBe(
        true,
      );
    });

    it('getUsers returns organization users', async () => {
      const org = rc.org(USERNAME);
      const users = await org.getUsers();
      expect(users.totalCount).toBeGreaterThan(0);
    });
  });

  describe('ProjectScope', () => {
    it('project().get() returns project info', async () => {
      const project = rc.org(USERNAME).project(projectName);
      const info = await project.get();
      expect(info.name).toBe(projectName);
      expect(info.organizationId).toBe(USERNAME);
    });

    it('getBranches returns branches', async () => {
      const project = rc.org(USERNAME).project(projectName);
      const branches = await project.getBranches();
      expect(branches.totalCount).toBeGreaterThanOrEqual(1);
      expect(branches.edges.some((e) => e.node.name === 'master')).toBe(true);
    });

    it('getRootBranch returns master branch', async () => {
      const project = rc.org(USERNAME).project(projectName);
      const rootBranch = await project.getRootBranch();
      expect(rootBranch.name).toBe('master');
      expect(rootBranch.isRoot).toBe(true);
    });

    it('getUsers returns project users list', async () => {
      const project = rc.org(USERNAME).project(projectName);
      const users = await project.getUsers();
      expect(users.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('branch() creates BranchScope', async () => {
      const project = rc.org(USERNAME).project(projectName);
      const bs = await project.branch();
      expect(bs).toBeInstanceOf(BranchScope);
      expect(bs.branchName).toBe('master');
      expect(bs.headRevisionId).toBeDefined();
      expect(bs.draftRevisionId).toBeDefined();
    });

    it('branch(name) creates BranchScope for specific branch', async () => {
      const project = rc.org(USERNAME).project(projectName);
      const bs = await project.branch('master');
      expect(bs.branchName).toBe('master');
    });
  });

  describe('BranchScope operations', () => {
    it('get() returns branch info', async () => {
      const bs = await rc.branch({ org: USERNAME, project: projectName });
      const info = await bs.get();
      expect(info.name).toBe('master');
    });

    it('getTouched() returns touched state', async () => {
      const bs = await rc.branch({ org: USERNAME, project: projectName });
      const touched = await bs.getTouched();
      expect(typeof touched.touched).toBe('boolean');
    });

    it('getRevisions() returns revision list', async () => {
      const bs = await rc.branch({ org: USERNAME, project: projectName });
      const revisions = await bs.getRevisions({ first: 10 });
      expect(revisions.totalCount).toBeGreaterThanOrEqual(1);
    });

    it('getStartRevision() returns first revision', async () => {
      const bs = await rc.branch({ org: USERNAME, project: projectName });
      const startRev = await bs.getStartRevision();
      expect(startRev.id).toBeDefined();
    });
  });

  describe('RevisionScope extended operations', () => {
    let draft: RevisionScope;

    beforeAll(async () => {
      const bs = await rc.branch({ org: USERNAME, project: projectName });
      draft = bs.draft();

      await draft.createTable('products', tableSchema);
      await draft.createRow('products', 'p1', { name: 'Product 1' });
      await draft.createRow('products', 'p2', { name: 'Product 2' });
    });

    afterAll(() => {
      draft.dispose();
    });

    it('getTableSchema returns JSON schema', async () => {
      const schema = await draft.getTableSchema('products');
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
    });

    it('getTableCountRows returns row count', async () => {
      const count = await draft.getTableCountRows('products');
      expect(count.count).toBe(2);
    });

    it('getTableForeignKeysBy returns empty for non-FK table', async () => {
      const result = await draft.getTableForeignKeysBy('products');
      expect(result.totalCount).toBe(0);
    });

    it('getTableForeignKeysTo returns empty for non-FK table', async () => {
      const result = await draft.getTableForeignKeysTo('products');
      expect(result.totalCount).toBe(0);
    });

    it('getTableCountForeignKeysBy returns zero', async () => {
      const result = await draft.getTableCountForeignKeysBy('products');
      expect(result.count).toBe(0);
    });

    it('getTableCountForeignKeysTo returns zero', async () => {
      const result = await draft.getTableCountForeignKeysTo('products');
      expect(result.count).toBe(0);
    });

    it('getRows with options', async () => {
      const rows = await draft.getRows('products', { first: 1 });
      expect(rows.edges).toHaveLength(1);
      expect(rows.pageInfo.hasNextPage).toBe(true);
    });

    it('patchRow updates partial data', async () => {
      await draft.patchRow('products', 'p1', [
        { op: 'replace', path: 'name', value: 'Patched' },
      ]);
      const row = await draft.getRow('products', 'p1');
      expect(row.data).toEqual({ name: 'Patched' });
    });

    it('renameRow changes row ID', async () => {
      await draft.renameRow('products', 'p2', 'p2-renamed');
      const row = await draft.getRow('products', 'p2-renamed');
      expect(row.id).toBe('p2-renamed');
      await draft.renameRow('products', 'p2-renamed', 'p2');
    });

    it('createRows bulk creates rows', async () => {
      const result = await draft.createRows('products', [
        { rowId: 'bulk-1', data: { name: 'Bulk 1' } },
        { rowId: 'bulk-2', data: { name: 'Bulk 2' } },
      ]);
      expect(result.rows).toHaveLength(2);
    });

    it('updateRows bulk updates rows', async () => {
      const result = await draft.updateRows('products', [
        { rowId: 'bulk-1', data: { name: 'Updated Bulk 1' } },
        { rowId: 'bulk-2', data: { name: 'Updated Bulk 2' } },
      ]);
      expect(result.rows).toHaveLength(2);
    });

    it('deleteRows removes multiple rows', async () => {
      await draft.deleteRows('products', ['bulk-1', 'bulk-2']);
      const count = await draft.getTableCountRows('products');
      expect(count.count).toBe(2);
    });

    it('getChanges returns revision changes', async () => {
      const changes = await draft.getChanges();
      expect(changes).toHaveProperty('totalChanges');
    });

    it('getTableChanges returns table-level changes', async () => {
      const changes = await draft.getTableChanges();
      expect(changes).toHaveProperty('totalCount');
    });

    it('getRowChanges returns row-level changes', async () => {
      const changes = await draft.getRowChanges({ tableId: 'products' });
      expect(changes).toHaveProperty('totalCount');
    });

    it('commit and revert cycle', async () => {
      await draft.commit('hierarchy test commit');

      await draft.createRow('products', 'temp-row', { name: 'Temp' });
      await draft.revertChanges();

      await expect(draft.getRow('products', 'temp-row')).rejects.toThrow();
    });

    it('renameTable changes table ID', async () => {
      await draft.createTable('to-rename', tableSchema);
      await draft.renameTable('to-rename', 'renamed-table');
      const table = await draft.getTable('renamed-table');
      expect(table.id).toBe('renamed-table');
      await draft.deleteTable('renamed-table');
    });

    it('updateTable applies JSON Patch to schema', async () => {
      const updateSchema = {
        type: 'object',
        properties: {
          title: { type: 'string', default: '' },
        },
        additionalProperties: false,
        required: ['title'],
      };
      await draft.createTable('to-update', updateSchema);
      await draft.updateTable('to-update', [
        {
          op: 'add',
          path: '/properties/age',
          value: { type: 'number', default: 0 },
        },
      ]);
      const schema = (await draft.getTableSchema('to-update')) as {
        properties: Record<string, unknown>;
      };
      expect(schema.properties).toHaveProperty('age');
      await draft.deleteTable('to-update');
    });

    it('deleteRow removes a single row', async () => {
      await draft.createRow('products', 'to-delete', { name: 'Delete me' });
      await draft.deleteRow('products', 'to-delete');
      await expect(draft.getRow('products', 'to-delete')).rejects.toThrow();
    });

    it('applyMigrationsWithStatus returns status per migration', async () => {
      const results = await draft.applyMigrationsWithStatus([
        {
          changeType: 'init',
          id: new Date().toISOString(),
          tableId: 'migrated-table',
          hash: 'abc123',
          schema: tableSchema,
        },
      ]);
      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('applied');

      await draft.deleteTable('migrated-table');
      await draft.commit('cleanup migration');
    });

    it('getMigrations returns migration list', async () => {
      const migrations = await draft.getMigrations();
      expect(Array.isArray(migrations)).toBe(true);
    });

    it('getEndpoints returns endpoints list', async () => {
      const endpoints = await draft.getEndpoints();
      expect(Array.isArray(endpoints)).toBe(true);
    });
  });

  describe('ProjectScope update and endpoint operations', () => {
    it('update changes project settings', async () => {
      const project = rc.org(USERNAME).project(projectName);
      await project.update({ isPublic: true });
      const info = await project.get();
      expect(info).toBeDefined();
      await project.update({ isPublic: false });
    });

    it('getEndpoints via ProjectScope', async () => {
      const project = rc.org(USERNAME).project(projectName);
      const endpoints = await project.getEndpoints();
      expect(Array.isArray(endpoints)).toBe(true);
    });
  });

  describe('OrgScope createProject', () => {
    const tempProject = `test-org-create-${Date.now()}`;

    afterAll(async () => {
      const testClient = createClient(
        createConfig({ baseUrl: BASE_URL, auth: rc.client.getConfig().auth }),
      );
      await sdk.deleteProject({
        client: testClient,
        path: { organizationId: USERNAME, projectName: tempProject },
      });
    });

    it('creates a project via OrgScope', async () => {
      const org = rc.org(USERNAME);
      const created = await org.createProject({
        projectName: tempProject,
        branchName: 'main',
      });
      expect(created.name).toBe(tempProject);
    });
  });

  describe('ProjectScope delete and branch lifecycle', () => {
    it('delete removes project via ProjectScope', async () => {
      const org = rc.org(USERNAME);
      const tempName = `test-proj-delete-${Date.now()}`;
      await org.createProject({ projectName: tempName, branchName: 'master' });

      const project = org.project(tempName);
      await project.delete();

      await expect(project.get()).rejects.toThrow();
    });

    it('createBranch and branch lifecycle', async () => {
      const org = rc.org(USERNAME);
      const tempName = `test-branch-life-${Date.now()}`;
      await org.createProject({ projectName: tempName, branchName: 'master' });

      const project = org.project(tempName);
      const masterBs = await project.branch('master');
      const created = await project.createBranch(
        'feature',
        masterBs.headRevisionId,
      );
      expect(created.name).toBe('feature');

      const featureBs = await project.branch('feature');
      expect(featureBs.client).toBeDefined();
      await featureBs.delete();

      const branches = await project.getBranches();
      const hasFeature = branches.edges.some((e) => e.node.name === 'feature');
      expect(hasFeature).toBe(false);

      await project.delete();
    });
  });

  describe('Foreign key operations', () => {
    let draft: RevisionScope;

    beforeAll(async () => {
      const bs = await rc.branch({ org: USERNAME, project: projectName });
      draft = bs.draft();

      await draft.createTable('fk-authors', {
        type: 'object',
        properties: {
          name: { type: 'string', default: '' },
        },
        additionalProperties: false,
        required: ['name'],
      });

      await draft.createTable('fk-posts', {
        type: 'object',
        properties: {
          title: { type: 'string', default: '' },
          author: { type: 'string', default: '', foreignKey: 'fk-authors' },
        },
        additionalProperties: false,
        required: ['title', 'author'],
      });

      await draft.createRow('fk-authors', 'author-1', { name: 'Alice' });
      await draft.createRow('fk-posts', 'post-1', {
        title: 'Post 1',
        author: 'author-1',
      });
      await draft.commit('fk setup');
    });

    afterAll(async () => {
      await draft.deleteTable('fk-posts');
      await draft.deleteTable('fk-authors');
      await draft.commit('fk cleanup');
      draft.dispose();
    });

    it('getRowForeignKeysBy returns FK references', async () => {
      const result = await draft.getRowForeignKeysBy(
        'fk-authors',
        'author-1',
        'fk-posts',
      );
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('getRowForeignKeysTo returns FK source', async () => {
      const result = await draft.getRowForeignKeysTo(
        'fk-posts',
        'post-1',
        'fk-authors',
      );
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('getRowCountForeignKeysBy returns count', async () => {
      const result = await draft.getRowCountForeignKeysBy(
        'fk-authors',
        'author-1',
      );
      expect(typeof result.count).toBe('number');
    });

    it('getRowCountForeignKeysTo returns count', async () => {
      const result = await draft.getRowCountForeignKeysTo('fk-posts', 'post-1');
      expect(typeof result.count).toBe('number');
    });
  });

  describe('Endpoint operations via ProjectScope', () => {
    it('deleteEndpoint and getEndpointRelatives via ProjectScope', async () => {
      const project = rc.org(USERNAME).project(projectName);
      expect(project.client).toBeDefined();
      expect(project.organizationId).toBe(USERNAME);
      expect(project.projectName).toBe(projectName);

      const bs = await project.branch();
      const draft = bs.draft();

      const endpoint = await draft.createEndpoint({ type: 'REST_API' });

      const relatives = await project.getEndpointRelatives(endpoint.id);
      expect(relatives).toBeDefined();

      await project.deleteEndpoint(endpoint.id);
      draft.dispose();
    });
  });

  describe('Scope getters', () => {
    it('OrgScope exposes client getter', () => {
      const org = rc.org(USERNAME);
      expect(org.client).toBeDefined();
    });
  });

  describe('Revision navigation', () => {
    it('getRevisions with before and inclusive options', async () => {
      const bs = await rc.branch({ org: USERNAME, project: projectName });
      const revisions = await bs.getRevisions({
        first: 5,
        before: bs.headRevisionId,
        inclusive: true,
      });
      expect(revisions.totalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Revision navigation operations', () => {
    it('patchRows batch patches rows', async () => {
      const bs = await rc.branch({ org: USERNAME, project: projectName });
      const draft = bs.draft();

      await draft.createTable('patch-batch', {
        type: 'object',
        properties: { val: { type: 'number', default: 0 } },
        additionalProperties: false,
        required: ['val'],
      });
      await draft.createRow('patch-batch', 'pb-1', { val: 1 });
      await draft.createRow('patch-batch', 'pb-2', { val: 2 });

      const result = await draft.patchRows('patch-batch', {
        rows: [
          {
            rowId: 'pb-1',
            patches: [{ op: 'replace', path: 'val', value: 10 }],
          },
          {
            rowId: 'pb-2',
            patches: [{ op: 'replace', path: 'val', value: 20 }],
          },
        ],
      });
      expect(result.rows).toHaveLength(2);

      await draft.deleteTable('patch-batch');
      draft.dispose();
    });

    it('createEndpoint and deleteEndpoint via RevisionScope', async () => {
      const bs = await rc.branch({ org: USERNAME, project: projectName });
      const draft = bs.draft();

      const endpoint = await draft.createEndpoint({ type: 'REST_API' });
      expect(endpoint.id).toBeDefined();

      const relatives = await draft.getEndpointRelatives(endpoint.id);
      expect(relatives).toBeDefined();

      await draft.deleteEndpoint(endpoint.id);

      draft.dispose();
    });
  });
});
