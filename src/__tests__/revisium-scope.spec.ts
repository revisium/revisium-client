import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { RevisiumScope } from '../revisium-scope.js';
import type { ScopeOwner } from '../revisium-client.js';
import type { BranchContext } from '../data-operations.js';

const mockOwner: ScopeOwner = {
  notifyBranchChanged: jest.fn(),
  unregisterScope: jest.fn(),
};

const branch: BranchContext = {
  organizationId: 'org',
  projectName: 'proj',
  branchName: 'master',
};

function createScope(
  overrides: Partial<{
    revisionId: string;
    isDraft: boolean;
    revisionMode: 'draft' | 'head' | 'explicit';
    owner: ScopeOwner;
  }> = {},
): RevisiumScope {
  return new RevisiumScope({
    client: {} as never,
    branch,
    revisionId: overrides.revisionId ?? 'rev-1',
    isDraft: overrides.isDraft ?? true,
    revisionMode: overrides.revisionMode ?? 'draft',
    owner: overrides.owner ?? mockOwner,
  });
}

describe('RevisiumScope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('properties', () => {
    it('exposes organizationId', () => {
      const scope = createScope();
      expect(scope.organizationId).toBe('org');
    });

    it('exposes projectName', () => {
      const scope = createScope();
      expect(scope.projectName).toBe('proj');
    });

    it('exposes branchName', () => {
      const scope = createScope();
      expect(scope.branchName).toBe('master');
    });

    it('exposes revisionId', () => {
      const scope = createScope({ revisionId: 'rev-42' });
      expect(scope.revisionId).toBe('rev-42');
    });

    it('exposes isDraft', () => {
      expect(createScope({ isDraft: true }).isDraft).toBe(true);
      expect(createScope({ isDraft: false }).isDraft).toBe(false);
    });

    it('exposes client', () => {
      const client = { fake: true } as never;
      const scope = new RevisiumScope({
        client,
        branch,
        revisionId: 'rev-1',
        isDraft: true,
        revisionMode: 'draft',
        owner: mockOwner,
      });
      expect(scope.client).toBe(client);
    });

    it('is not stale initially', () => {
      const scope = createScope();
      expect(scope.isStale).toBe(false);
    });

    it('is not disposed initially', () => {
      const scope = createScope();
      expect(scope.isDisposed).toBe(false);
    });
  });

  describe('markStale', () => {
    it('marks draft scope as stale', () => {
      const scope = createScope({ revisionMode: 'draft' });
      scope.markStale();
      expect(scope.isStale).toBe(true);
    });

    it('marks head scope as stale', () => {
      const scope = createScope({ revisionMode: 'head', isDraft: false });
      scope.markStale();
      expect(scope.isStale).toBe(true);
    });

    it('ignores markStale for explicit revisionId scope', () => {
      const scope = createScope({
        revisionMode: 'explicit',
        isDraft: false,
      });
      scope.markStale();
      expect(scope.isStale).toBe(false);
    });
  });

  describe('dispose', () => {
    it('sets isDisposed to true', () => {
      const scope = createScope();
      scope.dispose();
      expect(scope.isDisposed).toBe(true);
    });

    it('calls owner.unregisterScope', () => {
      const owner: ScopeOwner = {
        notifyBranchChanged: jest.fn(),
        unregisterScope: jest.fn(),
      };
      const scope = createScope({ owner });
      scope.dispose();
      expect(owner.unregisterScope).toHaveBeenCalledWith(scope);
    });

    it('is idempotent — second dispose does not call unregister again', () => {
      const owner: ScopeOwner = {
        notifyBranchChanged: jest.fn(),
        unregisterScope: jest.fn(),
      };
      const scope = createScope({ owner });
      scope.dispose();
      scope.dispose();
      expect(owner.unregisterScope).toHaveBeenCalledTimes(1);
    });
  });

  describe('disposed scope rejects operations', () => {
    it('getTables throws after dispose', async () => {
      const scope = createScope();
      scope.dispose();
      await expect(scope.getTables()).rejects.toThrow(
        'Scope has been disposed.',
      );
    });

    it('getRow throws after dispose', async () => {
      const scope = createScope();
      scope.dispose();
      await expect(scope.getRow('t', 'r')).rejects.toThrow(
        'Scope has been disposed.',
      );
    });

    it('createTable throws after dispose', async () => {
      const scope = createScope();
      scope.dispose();
      await expect(scope.createTable('t', {})).rejects.toThrow(
        'Scope has been disposed.',
      );
    });

    it('commit throws after dispose', async () => {
      const scope = createScope();
      scope.dispose();
      await expect(scope.commit()).rejects.toThrow('Scope has been disposed.');
    });

    it('refresh throws after dispose', async () => {
      const scope = createScope();
      scope.dispose();
      await expect(scope.refresh()).rejects.toThrow('Scope has been disposed.');
    });

    it('getMigrations throws after dispose', async () => {
      const scope = createScope();
      scope.dispose();
      await expect(scope.getMigrations()).rejects.toThrow(
        'Scope has been disposed.',
      );
    });

    it('applyMigrations throws after dispose', async () => {
      const scope = createScope();
      scope.dispose();
      await expect(scope.applyMigrations([])).rejects.toThrow(
        'Scope has been disposed.',
      );
    });
  });

  describe('non-draft scope rejects mutations', () => {
    it('createTable throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.createTable('t', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('createRow throws for explicit scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'explicit' });
      await expect(scope.createRow('t', 'r', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('commit throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.commit()).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('deleteTable throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.deleteTable('t')).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('updateRow throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.updateRow('t', 'r', {})).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('patchRow throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.patchRow('t', 'r', [])).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('deleteRow throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.deleteRow('t', 'r')).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('deleteRows throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.deleteRows('t', ['r'])).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('renameRow throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.renameRow('t', 'r', 'r2')).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('renameTable throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.renameTable('t', 't2')).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('updateTable throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.updateTable('t', [])).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('revertChanges throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.revertChanges()).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('createRows throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.createRows('t', [])).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('updateRows throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.updateRows('t', [])).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });

    it('applyMigrations throws for head scope', async () => {
      const scope = createScope({ isDraft: false, revisionMode: 'head' });
      await expect(scope.applyMigrations([])).rejects.toThrow(
        'Mutations are only allowed in draft revision',
      );
    });
  });

  describe('refresh', () => {
    it('is a no-op for explicit revisionId scope', async () => {
      const scope = createScope({
        revisionMode: 'explicit',
        isDraft: false,
        revisionId: 'explicit-rev',
      });
      await scope.refresh();
      expect(scope.revisionId).toBe('explicit-rev');
    });
  });
});
