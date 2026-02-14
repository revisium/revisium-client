import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockDraftRevisionFn = jest.fn<(...args: any[]) => any>();
const mockHeadRevisionFn = jest.fn<(...args: any[]) => any>();
const mockRevisionFn = jest.fn<(...args: any[]) => any>();

jest.unstable_mockModule('../generated/sdk.gen.js', () => ({
  draftRevision: mockDraftRevisionFn,
  headRevision: mockHeadRevisionFn,
  revision: mockRevisionFn,
}));

const { RevisiumClient } = await import('../revisium-client.js');
const { RevisiumScope } = await import('../revisium-scope.js');

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

describe('Scope stale notification', () => {
  let client: InstanceType<typeof RevisiumClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
  });

  describe('withContext creates scopes', () => {
    it('creates draft scope', async () => {
      mockDraftRevision('draft-1');
      const scope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'draft',
      });
      expect(scope).toBeInstanceOf(RevisiumScope);
      expect(scope.revisionId).toBe('draft-1');
      expect(scope.isDraft).toBe(true);
    });

    it('creates head scope', async () => {
      mockHeadRevision('head-1');
      const scope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'head',
      });
      expect(scope.revisionId).toBe('head-1');
      expect(scope.isDraft).toBe(false);
    });

    it('creates explicit scope', async () => {
      mockRevisionFn.mockResolvedValueOnce({
        data: { id: 'explicit-1' },
      });
      const scope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'explicit-1',
      });
      expect(scope.revisionId).toBe('explicit-1');
      expect(scope.isDraft).toBe(false);
    });

    it('defaults to draft and master', async () => {
      mockDraftRevision('draft-2');
      const scope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
      });
      expect(scope.branchName).toBe('master');
      expect(scope.isDraft).toBe(true);
    });
  });

  describe('sibling notification on commit', () => {
    it('marks sibling scopes stale when one scope commits', async () => {
      mockDraftRevision('draft-a');
      const scopeA = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'draft',
      });

      mockDraftRevision('draft-b');
      const scopeB = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'draft',
      });

      expect(scopeA.isStale).toBe(false);
      expect(scopeB.isStale).toBe(false);

      client.notifyBranchChanged(
        `${BRANCH.organizationId}/${BRANCH.projectName}/${BRANCH.branchName}`,
        scopeA,
      );

      expect(scopeA.isStale).toBe(false);
      expect(scopeB.isStale).toBe(true);
    });

    it('does not mark explicit scope as stale', async () => {
      mockRevisionFn.mockResolvedValueOnce({
        data: { id: 'explicit-rev' },
      });
      const explicitScope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'explicit-rev',
      });

      mockDraftRevision('draft-c');
      const draftScope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'draft',
      });

      client.notifyBranchChanged(
        `${BRANCH.organizationId}/${BRANCH.projectName}/${BRANCH.branchName}`,
        draftScope,
      );

      expect(explicitScope.isStale).toBe(false);
    });

    it('does not mark scopes on different branches stale', async () => {
      mockDraftRevision('draft-master');
      const masterScope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: 'master',
        revision: 'draft',
      });

      mockDraftRevision('draft-feature');
      const featureScope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: 'feature',
        revision: 'draft',
      });

      client.notifyBranchChanged(
        `${BRANCH.organizationId}/${BRANCH.projectName}/master`,
        masterScope,
      );

      expect(featureScope.isStale).toBe(false);
    });
  });

  describe('dispose and unregister', () => {
    it('unregisters scope on dispose', async () => {
      mockDraftRevision('draft-d');
      const scope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'draft',
      });

      scope.dispose();
      expect(scope.isDisposed).toBe(true);

      mockDraftRevision('draft-e');
      const scopeB = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'draft',
      });

      client.notifyBranchChanged(
        `${BRANCH.organizationId}/${BRANCH.projectName}/${BRANCH.branchName}`,
        scopeB,
      );
      expect(scope.isStale).toBe(false);
    });

    it('notifyBranchChanged is no-op for unknown branch key', () => {
      expect(() => {
        client.notifyBranchChanged('unknown/branch/key', {} as never);
      }).not.toThrow();
    });
  });

  describe('stale auto-refresh via getRevisionId', () => {
    it('refreshes revisionId when scope is stale and refresh is called', async () => {
      mockDraftRevision('draft-old');
      const scope = await client.withContext({
        organizationId: BRANCH.organizationId,
        projectName: BRANCH.projectName,
        branchName: BRANCH.branchName,
        revision: 'draft',
      });

      expect(scope.revisionId).toBe('draft-old');

      scope.markStale();
      expect(scope.isStale).toBe(true);

      mockDraftRevision('draft-new');

      await scope.refresh();

      expect(scope.revisionId).toBe('draft-new');
      expect(scope.isStale).toBe(false);
    });
  });
});
