import {
  type Client,
  createClient,
  createConfig,
} from './generated/client/index.js';
import * as sdk from './generated/sdk.gen.js';
import type {
  CreateRowResponse,
  CreateRowsResponse,
  CreateTableResponse,
  GetTableRowsDto,
  InitMigrationDto,
  MeModel,
  MigrationsResponse,
  PatchRow,
  PatchRowResponse,
  RemoveMigrationDto,
  RenameMigrationDto,
  RenameRowResponse,
  RenameTableResponse,
  RevisionChangesResponse,
  RevisionModel,
  RowModel,
  RowsConnection,
  TableModel,
  TablesConnection,
  UpdateMigrationDto,
  UpdateRowResponse,
  UpdateRowsResponse,
  UpdateTableResponse,
} from './generated/types.gen.js';
import * as ops from './data-operations.js';
import type { ScopeContext, BranchContext } from './data-operations.js';
import { RevisiumScope } from './revisium-scope.js';
import type { WithContextOptions } from './revisium-scope.js';

export interface RevisiumClientOptions {
  baseUrl: string;
}

export interface SetContextOptions {
  organizationId: string;
  projectName: string;
  branchName?: string;
  revision?: string;
}

export interface ScopeOwner {
  notifyBranchChanged(branchKey: string, excludeScope?: RevisiumScope): void;
  unregisterScope(scope: RevisiumScope): void;
}

export class RevisiumClient implements ScopeOwner {
  private readonly _client: Client;
  private readonly _baseUrl: string;
  private _organizationId: string | null = null;
  private _projectName: string | null = null;
  private _branchName: string | null = null;
  private _revisionId: string | null = null;
  private _isDraft = false;
  private _isAuthenticated = false;
  private readonly _scopes = new Map<string, Set<RevisiumScope>>();

  constructor(options: RevisiumClientOptions) {
    const url = options.baseUrl;
    this._baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this._client = createClient(createConfig({ baseUrl: this._baseUrl }));
  }

  public get baseUrl(): string {
    return this._baseUrl;
  }

  public get organizationId(): string | null {
    return this._organizationId;
  }

  public get projectName(): string | null {
    return this._projectName;
  }

  public get branchName(): string | null {
    return this._branchName;
  }

  public get revisionId(): string | null {
    return this._revisionId;
  }

  public get isDraft(): boolean {
    return this._isDraft;
  }

  public get client(): Client {
    return this._client;
  }

  public isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  async login(username: string, password: string): Promise<void> {
    const result = await sdk.login({
      client: this._client,
      body: { emailOrUsername: username, password },
    });
    const data = ops.unwrap(result);
    this._client.setConfig({ auth: data.accessToken });
    this._isAuthenticated = true;
  }

  loginWithToken(token: string): void {
    this._client.setConfig({ auth: token });
    this._isAuthenticated = true;
  }

  async me(): Promise<MeModel> {
    return ops.me(this._client);
  }

  async setContext(options: SetContextOptions): Promise<void> {
    const {
      organizationId,
      projectName,
      branchName = 'master',
      revision = 'draft',
    } = options;

    this._organizationId = organizationId;
    this._projectName = projectName;
    this._branchName = branchName;

    const branch: BranchContext = { organizationId, projectName, branchName };

    if (revision === 'draft') {
      this._revisionId = await ops.fetchDraftRevisionId(this._client, branch);
      this._isDraft = true;
    } else if (revision === 'head') {
      this._revisionId = await ops.fetchHeadRevisionId(this._client, branch);
      this._isDraft = false;
    } else {
      await ops.validateRevisionId(this._client, revision);
      this._revisionId = revision;
      this._isDraft = false;
    }
  }

  async withContext(options: WithContextOptions): Promise<RevisiumScope> {
    const {
      organizationId,
      projectName,
      branchName = 'master',
      revision = 'draft',
    } = options;

    const branch: BranchContext = { organizationId, projectName, branchName };
    let revisionId: string;
    let isDraft: boolean;
    let revisionMode: 'draft' | 'head' | 'explicit';

    if (revision === 'draft') {
      revisionId = await ops.fetchDraftRevisionId(this._client, branch);
      isDraft = true;
      revisionMode = 'draft';
    } else if (revision === 'head') {
      revisionId = await ops.fetchHeadRevisionId(this._client, branch);
      isDraft = false;
      revisionMode = 'head';
    } else {
      await ops.validateRevisionId(this._client, revision);
      revisionId = revision;
      isDraft = false;
      revisionMode = 'explicit';
    }

    const scope = new RevisiumScope({
      client: this._client,
      branch,
      revisionId,
      isDraft,
      revisionMode,
      owner: this,
    });

    const branchKey = `${organizationId}/${projectName}/${branchName}`;
    let scopeSet = this._scopes.get(branchKey);
    if (!scopeSet) {
      scopeSet = new Set();
      this._scopes.set(branchKey, scopeSet);
    }
    scopeSet.add(scope);

    return scope;
  }

  notifyBranchChanged(branchKey: string, excludeScope?: RevisiumScope): void {
    const scopeSet = this._scopes.get(branchKey);
    if (!scopeSet) {
      return;
    }
    for (const scope of scopeSet) {
      if (scope !== excludeScope) {
        scope.markStale();
      }
    }
  }

  unregisterScope(scope: RevisiumScope): void {
    for (const [key, scopeSet] of this._scopes) {
      scopeSet.delete(scope);
      if (scopeSet.size === 0) {
        this._scopes.delete(key);
      }
    }
  }

  private get _scopeContext(): ScopeContext {
    return {
      client: this._client,
      branch: {
        organizationId: this._organizationId ?? '',
        projectName: this._projectName ?? '',
        branchName: this._branchName ?? '',
      },
      isDraft: this._isDraft,
      getRevisionId: () => {
        if (this._revisionId === null) {
          return Promise.reject(
            new Error('Context not set. Call setContext() first.'),
          );
        }
        return Promise.resolve(this._revisionId);
      },
    };
  }

  async getTables(options?: {
    first?: number;
    after?: string;
  }): Promise<TablesConnection> {
    return ops.getTables(this._scopeContext, options);
  }

  async getTable(tableId: string): Promise<TableModel> {
    return ops.getTable(this._scopeContext, tableId);
  }

  async getTableSchema(tableId: string): Promise<object> {
    return ops.getTableSchema(this._scopeContext, tableId);
  }

  async getRows(
    tableId: string,
    options?: GetTableRowsDto,
  ): Promise<RowsConnection> {
    return ops.getRows(this._scopeContext, tableId, options);
  }

  async getRow(tableId: string, rowId: string): Promise<RowModel> {
    return ops.getRow(this._scopeContext, tableId, rowId);
  }

  async getChanges(): Promise<RevisionChangesResponse> {
    return ops.getChanges(this._scopeContext);
  }

  async getMigrations(): Promise<MigrationsResponse> {
    return ops.getMigrations(this._scopeContext);
  }

  async applyMigrations(
    migrations: Array<
      | InitMigrationDto
      | UpdateMigrationDto
      | RenameMigrationDto
      | RemoveMigrationDto
    >,
  ): Promise<void> {
    await ops.applyMigrations(this._scopeContext, migrations);
    await this.refreshDraftRevisionId();
    this.notifyScopesOnCurrentBranch();
  }

  async createTable(
    tableId: string,
    schema: object,
  ): Promise<CreateTableResponse> {
    return ops.createTable(this._scopeContext, tableId, schema);
  }

  async updateTable(
    tableId: string,
    patches: object[],
  ): Promise<UpdateTableResponse> {
    return ops.updateTable(this._scopeContext, tableId, patches);
  }

  async deleteTable(tableId: string): Promise<void> {
    return ops.deleteTable(this._scopeContext, tableId);
  }

  async renameTable(
    tableId: string,
    nextTableId: string,
  ): Promise<RenameTableResponse> {
    return ops.renameTable(this._scopeContext, tableId, nextTableId);
  }

  async createRow(
    tableId: string,
    rowId: string,
    data: object,
  ): Promise<CreateRowResponse> {
    return ops.createRow(this._scopeContext, tableId, rowId, data);
  }

  async createRows(
    tableId: string,
    rows: Array<{ rowId: string; data: object }>,
    options?: { isRestore?: boolean },
  ): Promise<CreateRowsResponse> {
    return ops.createRows(this._scopeContext, tableId, rows, options);
  }

  async updateRow(
    tableId: string,
    rowId: string,
    data: object,
  ): Promise<UpdateRowResponse> {
    return ops.updateRow(this._scopeContext, tableId, rowId, data);
  }

  async updateRows(
    tableId: string,
    rows: Array<{ rowId: string; data: object }>,
    options?: { isRestore?: boolean },
  ): Promise<UpdateRowsResponse> {
    return ops.updateRows(this._scopeContext, tableId, rows, options);
  }

  async patchRow(
    tableId: string,
    rowId: string,
    patches: PatchRow[],
  ): Promise<PatchRowResponse> {
    return ops.patchRow(this._scopeContext, tableId, rowId, patches);
  }

  async deleteRow(tableId: string, rowId: string): Promise<void> {
    return ops.deleteRow(this._scopeContext, tableId, rowId);
  }

  async deleteRows(tableId: string, rowIds: string[]): Promise<void> {
    return ops.deleteRows(this._scopeContext, tableId, rowIds);
  }

  async renameRow(
    tableId: string,
    rowId: string,
    nextRowId: string,
  ): Promise<RenameRowResponse> {
    return ops.renameRow(this._scopeContext, tableId, rowId, nextRowId);
  }

  async commit(comment?: string): Promise<RevisionModel> {
    const data = await ops.commit(this._scopeContext, comment);
    await this.refreshDraftRevisionId();
    this.notifyScopesOnCurrentBranch();
    return data;
  }

  async revertChanges(): Promise<void> {
    await ops.revertChanges(this._scopeContext);
    await this.refreshDraftRevisionId();
    this.notifyScopesOnCurrentBranch();
  }

  private async refreshDraftRevisionId(): Promise<void> {
    this._revisionId = await ops.fetchDraftRevisionId(this._client, {
      organizationId: this._organizationId!,
      projectName: this._projectName!,
      branchName: this._branchName!,
    });
  }

  private notifyScopesOnCurrentBranch(): void {
    if (this._organizationId && this._projectName && this._branchName) {
      const branchKey = `${this._organizationId}/${this._projectName}/${this._branchName}`;
      this.notifyBranchChanged(branchKey);
    }
  }
}
