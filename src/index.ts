export { RevisiumClient } from './revisium-client.js';
export type {
  RevisiumClientOptions,
  BranchShortcut,
  RevisionShortcut,
} from './revisium-client.js';

export { OrgScope } from './org-scope.js';
export { ProjectScope } from './project-scope.js';
export { BranchScope } from './branch-scope.js';
export { RevisionScope } from './revision-scope.js';
export type { ScopeOwner } from './scope-owner.js';

export { client } from './generated/client.gen.js';
export type { Client } from './generated/client/index.js';
export * as sdk from './generated/sdk.gen.js';
export type * from './generated/types.gen.js';
