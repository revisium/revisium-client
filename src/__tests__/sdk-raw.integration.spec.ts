import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createClient, createConfig } from '../generated/client/index.js';
import * as sdk from '../generated/sdk.gen.js';

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
