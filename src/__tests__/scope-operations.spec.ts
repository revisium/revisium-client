import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

type AnyFn = (...args: any[]) => any;

let OrgScope: typeof import('../org-scope.js').OrgScope;
let ProjectScope: typeof import('../project-scope.js').ProjectScope;
let RevisionScope: typeof import('../revision-scope.js').RevisionScope;

const opsMock = {
  addOrgUser: jest.fn<AnyFn>().mockResolvedValue(undefined),
  removeOrgUser: jest.fn<AnyFn>().mockResolvedValue(undefined),
  addProjectUser: jest.fn<AnyFn>().mockResolvedValue(undefined),
  removeProjectUser: jest.fn<AnyFn>().mockResolvedValue(undefined),
  deleteEndpoint: jest.fn<AnyFn>().mockResolvedValue(undefined),
  getEndpointRelatives: jest.fn<AnyFn>().mockResolvedValue({ data: {} }),
  getProject: jest.fn<AnyFn>().mockResolvedValue({ name: 'p' }),
  updateProject: jest.fn<AnyFn>().mockResolvedValue(undefined),
  deleteProject: jest.fn<AnyFn>().mockResolvedValue(undefined),
  getBranches: jest.fn<AnyFn>().mockResolvedValue({ edges: [], totalCount: 0 }),
  getRootBranch: jest.fn<AnyFn>().mockResolvedValue({ name: 'master' }),
  getProjectUsers: jest
    .fn<AnyFn>()
    .mockResolvedValue({ edges: [], totalCount: 0 }),
  getProjects: jest.fn<AnyFn>().mockResolvedValue({ edges: [], totalCount: 0 }),
  createProject: jest.fn<AnyFn>().mockResolvedValue({ name: 'p' }),
  getOrgUsers: jest.fn<AnyFn>().mockResolvedValue({ edges: [], totalCount: 0 }),
  fetchHeadRevisionId: jest.fn<AnyFn>().mockResolvedValue('head-id'),
  fetchDraftRevisionId: jest.fn<AnyFn>().mockResolvedValue('draft-id'),
  createBranch: jest.fn<AnyFn>().mockResolvedValue({ name: 'b' }),
  uploadFile: jest.fn<AnyFn>().mockResolvedValue({ url: 'https://cdn/file' }),
};

beforeAll(async () => {
  jest.unstable_mockModule('../data-operations.js', () => opsMock);

  const orgMod = await import('../org-scope.js');
  const projMod = await import('../project-scope.js');
  const revMod = await import('../revision-scope.js');

  OrgScope = orgMod.OrgScope;
  ProjectScope = projMod.ProjectScope;
  RevisionScope = revMod.RevisionScope;
});

afterEach(() => {
  jest.clearAllMocks();
});

const fakeClient = {} as never;

describe('OrgScope', () => {
  it('addUser delegates to addOrgUser', async () => {
    const org = new OrgScope(fakeClient, 'org1');
    await org.addUser('u1', 'reader');
    expect(opsMock.addOrgUser).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org1' }),
      'u1',
      'reader',
    );
  });

  it('removeUser delegates to removeOrgUser', async () => {
    const org = new OrgScope(fakeClient, 'org1');
    await org.removeUser('u1');
    expect(opsMock.removeOrgUser).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org1' }),
      'u1',
    );
  });
});

describe('ProjectScope', () => {
  it('addUser delegates to addProjectUser', async () => {
    const proj = new ProjectScope(fakeClient, 'org1', 'proj1');
    await proj.addUser('u1', 'editor');
    expect(opsMock.addProjectUser).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        projectName: 'proj1',
      }),
      'u1',
      'editor',
    );
  });

  it('removeUser delegates to removeProjectUser', async () => {
    const proj = new ProjectScope(fakeClient, 'org1', 'proj1');
    await proj.removeUser('u1');
    expect(opsMock.removeProjectUser).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        projectName: 'proj1',
      }),
      'u1',
    );
  });

  it('deleteEndpoint delegates to ops.deleteEndpoint', async () => {
    const proj = new ProjectScope(fakeClient, 'org1', 'proj1');
    await proj.deleteEndpoint('ep-1');
    expect(opsMock.deleteEndpoint).toHaveBeenCalledWith(fakeClient, 'ep-1');
  });

  it('getEndpointRelatives delegates to ops.getEndpointRelatives', async () => {
    const proj = new ProjectScope(fakeClient, 'org1', 'proj1');
    await proj.getEndpointRelatives('ep-1');
    expect(opsMock.getEndpointRelatives).toHaveBeenCalledWith(
      fakeClient,
      'ep-1',
    );
  });
});

describe('RevisionScope', () => {
  function createDraftScope() {
    return new RevisionScope({
      client: fakeClient,
      branch: {
        client: fakeClient,
        organizationId: 'org1',
        projectName: 'proj1',
        branchName: 'master',
      },
      revisionId: 'rev-1',
      isDraft: true,
      revisionMode: 'draft',
      owner: {
        notifyBranchChanged: jest.fn(),
        unregisterScope: jest.fn(),
        refreshRevisionIds: jest
          .fn<() => Promise<void>>()
          .mockResolvedValue(undefined),
      },
    });
  }

  it('uploadFile delegates to ops.uploadFile', async () => {
    const scope = createDraftScope();
    const blob = new Blob(['data']);
    await scope.uploadFile('tbl', 'row', 'fld', blob);
    expect(opsMock.uploadFile).toHaveBeenCalled();
    scope.dispose();
  });

  it('refresh fetches new revisionId for draft scope', async () => {
    const scope = createDraftScope();
    scope.markStale();
    expect(scope.isStale).toBe(true);
    await scope.refresh();
    expect(scope.isStale).toBe(false);
    scope.dispose();
  });
});
