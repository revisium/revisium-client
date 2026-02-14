import type { Client } from './generated/client/index.js';
import type {
  BranchModel,
  RevisionsConnection,
  RevisionModel,
  TouchedModelDto,
} from './generated/types.gen.js';
import * as ops from './data-operations.js';
import type { BranchContext } from './data-operations.js';
import { RevisionScope } from './revision-scope.js';
import type { ScopeOwner } from './scope-owner.js';

export class BranchScope implements ScopeOwner {
  private _headRevisionId: string;
  private _draftRevisionId: string;
  private readonly _scopes = new Set<RevisionScope>();

  private constructor(
    private readonly _client: Client,
    private readonly _branch: BranchContext,
    headRevisionId: string,
    draftRevisionId: string,
  ) {
    this._headRevisionId = headRevisionId;
    this._draftRevisionId = draftRevisionId;
  }

  static async create(
    client: Client,
    branch: BranchContext,
  ): Promise<BranchScope> {
    const [headId, draftId] = await Promise.all([
      ops.fetchHeadRevisionId(client, branch),
      ops.fetchDraftRevisionId(client, branch),
    ]);
    return new BranchScope(client, branch, headId, draftId);
  }

  public get organizationId(): string {
    return this._branch.organizationId;
  }

  public get projectName(): string {
    return this._branch.projectName;
  }

  public get branchName(): string {
    return this._branch.branchName;
  }

  public get headRevisionId(): string {
    return this._headRevisionId;
  }

  public get draftRevisionId(): string {
    return this._draftRevisionId;
  }

  public get client(): Client {
    return this._client;
  }

  draft(): RevisionScope {
    const scope = new RevisionScope({
      client: this._client,
      branch: this._branch,
      revisionId: this._draftRevisionId,
      isDraft: true,
      revisionMode: 'draft',
      owner: this,
    });
    this._scopes.add(scope);
    return scope;
  }

  head(): RevisionScope {
    const scope = new RevisionScope({
      client: this._client,
      branch: this._branch,
      revisionId: this._headRevisionId,
      isDraft: false,
      revisionMode: 'head',
      owner: this,
    });
    this._scopes.add(scope);
    return scope;
  }

  async revision(revisionId: string): Promise<RevisionScope> {
    await ops.validateRevisionId(this._client, revisionId);
    const scope = new RevisionScope({
      client: this._client,
      branch: this._branch,
      revisionId,
      isDraft: false,
      revisionMode: 'explicit',
      owner: this,
    });
    this._scopes.add(scope);
    return scope;
  }

  // -------------------------------------------------------------------------
  // Branch-level operations
  // -------------------------------------------------------------------------

  async get(): Promise<BranchModel> {
    return ops.getBranch(this._client, this._branch);
  }

  async delete(): Promise<void> {
    return ops.deleteBranch(this._client, this._branch);
  }

  async getTouched(): Promise<TouchedModelDto> {
    return ops.getBranchTouched(this._client, this._branch);
  }

  async getRevisions(options?: {
    first?: number;
    after?: string;
    before?: string;
    inclusive?: boolean;
  }): Promise<RevisionsConnection> {
    return ops.getRevisions(this._client, this._branch, options);
  }

  async getStartRevision(): Promise<RevisionModel> {
    return ops.getStartRevision(this._client, this._branch);
  }

  // -------------------------------------------------------------------------
  // ScopeOwner implementation
  // -------------------------------------------------------------------------

  notifyBranchChanged(branchKey: string, excludeScope?: RevisionScope): void {
    const myKey = `${this._branch.organizationId}/${this._branch.projectName}/${this._branch.branchName}`;
    if (branchKey !== myKey) {
      return;
    }
    for (const scope of this._scopes) {
      if (scope !== excludeScope) {
        scope.markStale();
      }
    }
  }

  unregisterScope(scope: RevisionScope): void {
    this._scopes.delete(scope);
  }

  async refreshRevisionIds(): Promise<void> {
    const [headId, draftId] = await Promise.all([
      ops.fetchHeadRevisionId(this._client, this._branch),
      ops.fetchDraftRevisionId(this._client, this._branch),
    ]);
    this._headRevisionId = headId;
    this._draftRevisionId = draftId;
  }
}
