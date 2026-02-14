import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockDraftRevisionFn = jest.fn<(...args: any[]) => any>();
const mockHeadRevisionFn = jest.fn<(...args: any[]) => any>();
const mockRevisionFn = jest.fn<(...args: any[]) => any>();

jest.unstable_mockModule('../generated/sdk.gen.js', () => ({
  draftRevision: mockDraftRevisionFn,
  headRevision: mockHeadRevisionFn,
  revision: mockRevisionFn,
}));

const { BranchScope } = await import('../branch-scope.js');
const { RevisionScope } = await import('../revision-scope.js');

type BranchContext = {
  organizationId: string;
  projectName: string;
  branchName: string;
};

const BRANCH: BranchContext = {
  organizationId: 'org',
  projectName: 'proj',
  branchName: 'master',
};

function mockDraftRevision(id: string): void {
  mockDraftRevisionFn.mockResolvedValueOnce({ data: { id } });
}

function mockHeadRevision(id: string): void {
  mockHeadRevisionFn.mockResolvedValueOnce({ data: { id } });
}

async function createBranch(branchCtx: BranchContext = BRANCH) {
  mockHeadRevision('head-1');
  mockDraftRevision('draft-1');
  return BranchScope.create({} as never, {
    ...branchCtx,
    client: {} as never,
  });
}

describe('Scope stale notification (BranchScope)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BranchScope.create fetches both IDs', () => {
    it('fetches head and draft revision IDs', async () => {
      mockHeadRevision('head-42');
      mockDraftRevision('draft-42');
      const bs = await BranchScope.create({} as never, {
        ...BRANCH,
        client: {} as never,
      });
      expect(bs.headRevisionId).toBe('head-42');
      expect(bs.draftRevisionId).toBe('draft-42');
    });
  });

  describe('draft() and head() return RevisionScopes', () => {
    it('draft() returns draft RevisionScope', async () => {
      const bs = await createBranch();
      const scope = bs.draft();
      expect(scope).toBeInstanceOf(RevisionScope);
      expect(scope.isDraft).toBe(true);
      expect(scope.revisionId).toBe('draft-1');
    });

    it('head() returns head RevisionScope', async () => {
      const bs = await createBranch();
      const scope = bs.head();
      expect(scope).toBeInstanceOf(RevisionScope);
      expect(scope.isDraft).toBe(false);
      expect(scope.revisionId).toBe('head-1');
    });

    it('revision() validates and returns explicit RevisionScope', async () => {
      const bs = await createBranch();
      mockRevisionFn.mockResolvedValueOnce({ data: { id: 'explicit-1' } });
      const scope = await bs.revision('explicit-1');
      expect(scope).toBeInstanceOf(RevisionScope);
      expect(scope.isDraft).toBe(false);
      expect(scope.revisionId).toBe('explicit-1');
    });
  });

  describe('sibling notification', () => {
    it('marks sibling scopes stale when notifyBranchChanged is called', async () => {
      const bs = await createBranch();
      const scopeA = bs.draft();
      const scopeB = bs.draft();

      expect(scopeA.isStale).toBe(false);
      expect(scopeB.isStale).toBe(false);

      bs.notifyBranchChanged(
        `${BRANCH.organizationId}/${BRANCH.projectName}/${BRANCH.branchName}`,
        scopeA,
      );

      expect(scopeA.isStale).toBe(false);
      expect(scopeB.isStale).toBe(true);
    });

    it('does not mark explicit scope as stale', async () => {
      const bs = await createBranch();
      mockRevisionFn.mockResolvedValueOnce({ data: { id: 'explicit-rev' } });
      const explicitScope = await bs.revision('explicit-rev');
      const draftScope = bs.draft();

      bs.notifyBranchChanged(
        `${BRANCH.organizationId}/${BRANCH.projectName}/${BRANCH.branchName}`,
        draftScope,
      );

      expect(explicitScope.isStale).toBe(false);
    });

    it('ignores notifications for different branch keys', async () => {
      const bs = await createBranch();
      const scope = bs.draft();

      bs.notifyBranchChanged('other/branch/key');
      expect(scope.isStale).toBe(false);
    });
  });

  describe('dispose and unregister', () => {
    it('unregisters scope on dispose — not affected by future notifications', async () => {
      const bs = await createBranch();
      const scopeA = bs.draft();
      const scopeB = bs.draft();

      scopeA.dispose();
      expect(scopeA.isDisposed).toBe(true);

      bs.notifyBranchChanged(
        `${BRANCH.organizationId}/${BRANCH.projectName}/${BRANCH.branchName}`,
        scopeB,
      );

      expect(scopeA.isStale).toBe(false);
    });
  });

  describe('refreshRevisionIds', () => {
    it('updates stored head and draft IDs', async () => {
      const bs = await createBranch();
      expect(bs.headRevisionId).toBe('head-1');
      expect(bs.draftRevisionId).toBe('draft-1');

      mockHeadRevision('head-2');
      mockDraftRevision('draft-2');
      await bs.refreshRevisionIds();

      expect(bs.headRevisionId).toBe('head-2');
      expect(bs.draftRevisionId).toBe('draft-2');
    });
  });

  describe('stale auto-refresh via getRevisionId', () => {
    it('refreshes revisionId when scope is stale and refresh is called', async () => {
      const bs = await createBranch();
      const scope = bs.draft();

      expect(scope.revisionId).toBe('draft-1');

      scope.markStale();
      expect(scope.isStale).toBe(true);

      mockDraftRevision('draft-new');

      await scope.refresh();

      expect(scope.revisionId).toBe('draft-new');
      expect(scope.isStale).toBe(false);
    });
  });
});
