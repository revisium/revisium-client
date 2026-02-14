import type { RevisionScope } from './revision-scope.js';

export interface ScopeOwner {
  notifyBranchChanged(branchKey: string, excludeScope?: RevisionScope): void;
  unregisterScope(scope: RevisionScope): void;
  refreshRevisionIds(): Promise<void>;
}
