import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

type AnyFn = (...args: any[]) => any;

let ops: typeof import('../data-operations.js');

const sdkMock = {
  removeUserFromOrganization: jest.fn<AnyFn>(),
  addUserToProject: jest.fn<AnyFn>(),
  removeUserFromProject: jest.fn<AnyFn>(),
  revision: jest.fn<AnyFn>(),
  revisions: jest.fn<AnyFn>(),
  parentRevision: jest.fn<AnyFn>(),
  childRevision: jest.fn<AnyFn>(),
  uploadFile: jest.fn<AnyFn>(),
};

beforeAll(async () => {
  jest.unstable_mockModule('../generated/sdk.gen.js', () => sdkMock);
  ops = await import('../data-operations.js');
});

afterEach(() => {
  jest.clearAllMocks();
});

function orgCtx() {
  return { client: {} as never, organizationId: 'org1' };
}

function projectCtx() {
  return {
    client: {} as never,
    organizationId: 'org1',
    projectName: 'proj1',
  };
}

function scopeCtx(isDraft = true) {
  return {
    client: {} as never,
    branch: {
      client: {} as never,
      organizationId: 'org1',
      projectName: 'proj1',
      branchName: 'master',
    },
    isDraft,
    getRevisionId: () => Promise.resolve('rev-1'),
  };
}

describe('removeOrgUser', () => {
  it('calls removeUserFromOrganization and unwraps', async () => {
    sdkMock.removeUserFromOrganization.mockResolvedValue({
      data: { success: true },
    });

    await ops.removeOrgUser(orgCtx(), 'user-1');

    expect(sdkMock.removeUserFromOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { organizationId: 'org1' },
        body: { userId: 'user-1' },
      }),
    );
  });
});

describe('addProjectUser', () => {
  it('calls addUserToProject and unwraps', async () => {
    sdkMock.addUserToProject.mockResolvedValue({
      data: { success: true },
    });

    await ops.addProjectUser(projectCtx(), 'user-1', 'reader');

    expect(sdkMock.addUserToProject).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { organizationId: 'org1', projectName: 'proj1' },
        body: { userId: 'user-1', roleId: 'reader' },
      }),
    );
  });
});

describe('removeProjectUser', () => {
  it('calls removeUserFromProject and unwraps', async () => {
    sdkMock.removeUserFromProject.mockResolvedValue({
      data: { success: true },
    });

    await ops.removeProjectUser(projectCtx(), 'user-1');

    expect(sdkMock.removeUserFromProject).toHaveBeenCalledWith(
      expect.objectContaining({
        path: {
          organizationId: 'org1',
          projectName: 'proj1',
          userId: 'user-1',
        },
      }),
    );
  });
});

describe('getRevision', () => {
  it('calls revision SDK and unwraps', async () => {
    sdkMock.revision.mockResolvedValue({
      data: { id: 'rev-1', isDraft: false },
    });

    const result = await ops.getRevision({} as never, 'rev-1');
    expect(result).toEqual({ id: 'rev-1', isDraft: false });
  });
});

describe('getParentRevision', () => {
  it('calls parentRevision SDK and unwraps', async () => {
    sdkMock.parentRevision.mockResolvedValue({
      data: { id: 'parent-rev' },
    });

    const result = await ops.getParentRevision({} as never, 'rev-1');
    expect(result).toEqual({ id: 'parent-rev' });
  });
});

describe('getChildRevision', () => {
  it('calls childRevision SDK and unwraps', async () => {
    sdkMock.childRevision.mockResolvedValue({
      data: { id: 'child-rev' },
    });

    const result = await ops.getChildRevision({} as never, 'rev-1');
    expect(result).toEqual({ id: 'child-rev' });
  });
});

describe('uploadFile', () => {
  it('calls uploadFile SDK and unwraps', async () => {
    const fakeFile = new Blob(['hello']);
    sdkMock.uploadFile.mockResolvedValue({
      data: { url: 'https://cdn.example.com/file' },
    });

    const result = await ops.uploadFile(
      scopeCtx(),
      'posts',
      'post-1',
      'avatar',
      fakeFile,
    );
    expect(result).toEqual({ url: 'https://cdn.example.com/file' });

    expect(sdkMock.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: {
          revisionId: 'rev-1',
          tableId: 'posts',
          rowId: 'post-1',
          fileId: 'avatar',
        },
        body: { file: fakeFile },
      }),
    );
  });

  it('throws for non-draft context', async () => {
    await expect(
      ops.uploadFile(scopeCtx(false), 'posts', 'post-1', 'avatar', new Blob()),
    ).rejects.toThrow('Mutations are only allowed in draft revision');
  });
});

describe('getRevisions', () => {
  const branchCtx = {
    client: {} as never,
    organizationId: 'org1',
    projectName: 'proj1',
    branchName: 'master',
  };

  it('defaults first to 100 when not provided', async () => {
    sdkMock.revisions.mockResolvedValue({
      data: { edges: [], totalCount: 0 },
    });

    await ops.getRevisions({} as never, branchCtx, { before: 'rev-5' });

    expect(sdkMock.revisions).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ first: 100, before: 'rev-5' }),
      }),
    );
  });

  it('uses provided first value', async () => {
    sdkMock.revisions.mockResolvedValue({
      data: { edges: [], totalCount: 0 },
    });

    await ops.getRevisions({} as never, branchCtx, { first: 10 });

    expect(sdkMock.revisions).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ first: 10 }),
      }),
    );
  });
});

describe('assertContext', () => {
  it('throws when organizationId is empty', () => {
    const ctx = {
      client: {} as never,
      branch: {
        client: {} as never,
        organizationId: '',
        projectName: 'p',
        branchName: 'b',
      },
      isDraft: true,
      getRevisionId: () => Promise.resolve('rev'),
    };

    expect(() => ops.assertContext(ctx)).toThrow(
      'Context not set. Call setContext() first.',
    );
  });
});
