import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createClient, createConfig } from '../generated/client/index.js';
import * as sdk from '../generated/sdk.gen.js';
import { RevisiumClient } from '../revisium-client.js';
import { RevisionScope } from '../revision-scope.js';

const BASE_URL = process.env.REVISIUM_URL || 'http://localhost:8080';
const USERNAME = process.env.REVISIUM_USERNAME || 'admin';
const PASSWORD = process.env.REVISIUM_PASSWORD || 'admin';

describe('BranchScope Stale Integration', () => {
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

  it('BranchScope returns RevisionScope via draft() and head()', async () => {
    const bs = await rc.branch({ org: USERNAME, project: projectName });

    const draftScope = bs.draft();
    expect(draftScope).toBeInstanceOf(RevisionScope);
    expect(draftScope.organizationId).toBe(USERNAME);
    expect(draftScope.projectName).toBe(projectName);
    expect(draftScope.branchName).toBe('master');
    expect(draftScope.isDraft).toBe(true);
    expect(draftScope.revisionId).toBeDefined();

    const headScope = bs.head();
    expect(headScope).toBeInstanceOf(RevisionScope);
    expect(headScope.isDraft).toBe(false);
    expect(headScope.revisionId).toBeDefined();

    draftScope.dispose();
    headScope.dispose();
  });

  it('scope CRUD operations work', async () => {
    const bs = await rc.branch({ org: USERNAME, project: projectName });
    const scope = bs.draft();

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
    const bs = await rc.branch({ org: USERNAME, project: projectName });
    const scopeA = bs.draft();
    const scopeB = bs.draft();

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
    const bs = await rc.branch({ org: USERNAME, project: projectName });
    const scopeA = bs.draft();
    const scopeB = bs.draft();

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
    const bs = await rc.branch({ org: USERNAME, project: projectName });
    const draftScope = bs.draft();
    const headScope = bs.head();
    const explicitScope = await bs.revision(headScope.revisionId);

    await draftScope.createTable('explicit-test', tableSchema);
    await draftScope.commit('explicit test');

    expect(headScope.isStale).toBe(true);
    expect(explicitScope.isStale).toBe(false);

    draftScope.dispose();
    headScope.dispose();
    explicitScope.dispose();
  });

  it('disposed scope throws on operations', async () => {
    const bs = await rc.branch({ org: USERNAME, project: projectName });
    const scope = bs.draft();

    scope.dispose();
    expect(scope.isDisposed).toBe(true);

    await expect(scope.getTables()).rejects.toThrow('Scope has been disposed.');
    await expect(scope.createTable('t', {})).rejects.toThrow(
      'Scope has been disposed.',
    );
  });

  it('head scope prevents mutations', async () => {
    const bs = await rc.branch({ org: USERNAME, project: projectName });
    const scope = bs.head();

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
