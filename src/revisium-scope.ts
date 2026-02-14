import type { Client } from './generated/client/index.js';
import type {
  CreateRowResponse,
  CreateRowsResponse,
  CreateTableResponse,
  GetTableRowsDto,
  InitMigrationDto,
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
import type { BranchContext, ScopeContext } from './data-operations.js';
import type { ScopeOwner } from './revisium-client.js';

export interface WithContextOptions {
  organizationId: string;
  projectName: string;
  branchName?: string;
  revision?: string;
}

export interface RevisiumScopeInit {
  client: Client;
  branch: BranchContext;
  revisionId: string;
  isDraft: boolean;
  revisionMode: 'draft' | 'head' | 'explicit';
  owner: ScopeOwner;
}

export class RevisiumScope {
  private readonly _client: Client;
  private readonly _branch: BranchContext;
  private readonly _revisionMode: 'draft' | 'head' | 'explicit';
  private readonly _owner: ScopeOwner;
  private _revisionId: string;
  private readonly _isDraft: boolean;
  private _stale = false;
  private _disposed = false;
  private _refreshPromise: Promise<string> | null = null;

  constructor(init: RevisiumScopeInit) {
    this._client = init.client;
    this._branch = init.branch;
    this._revisionId = init.revisionId;
    this._isDraft = init.isDraft;
    this._revisionMode = init.revisionMode;
    this._owner = init.owner;
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

  public get revisionId(): string {
    return this._revisionId;
  }

  public get isDraft(): boolean {
    return this._isDraft;
  }

  public get isStale(): boolean {
    return this._stale;
  }

  public get isDisposed(): boolean {
    return this._disposed;
  }

  public get client(): Client {
    return this._client;
  }

  markStale(): void {
    if (this._revisionMode === 'explicit') {
      return;
    }
    this._stale = true;
  }

  async refresh(): Promise<void> {
    this.assertNotDisposed();
    if (this._revisionMode === 'explicit') {
      return;
    }
    this._revisionId = await this.fetchRevisionId();
    this._stale = false;
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._owner.unregisterScope(this);
  }

  private assertNotDisposed(): void {
    if (this._disposed) {
      throw new Error('Scope has been disposed.');
    }
  }

  private get _branchKey(): string {
    return `${this._branch.organizationId}/${this._branch.projectName}/${this._branch.branchName}`;
  }

  private async fetchRevisionId(): Promise<string> {
    if (this._revisionMode === 'draft') {
      return ops.fetchDraftRevisionId(this._client, this._branch);
    }
    return ops.fetchHeadRevisionId(this._client, this._branch);
  }

  private async getRevisionId(): Promise<string> {
    this.assertNotDisposed();
    if (this._stale) {
      this._refreshPromise ??= this.fetchRevisionId().then(
        (id) => {
          this._revisionId = id;
          this._stale = false;
          this._refreshPromise = null;
          return id;
        },
        (err) => {
          this._refreshPromise = null;
          throw err;
        },
      );
      return this._refreshPromise;
    }
    return this._revisionId;
  }

  private get _scopeContext(): ScopeContext {
    return {
      client: this._client,
      branch: this._branch,
      isDraft: this._isDraft,
      getRevisionId: () => this.getRevisionId(),
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
    this.assertNotDisposed();
    await ops.applyMigrations(this._scopeContext, migrations);
    this._revisionId = await ops.fetchDraftRevisionId(
      this._client,
      this._branch,
    );
    this._stale = false;
    this._owner.notifyBranchChanged(this._branchKey, this);
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
    this.assertNotDisposed();
    const data = await ops.commit(this._scopeContext, comment);
    this._revisionId = await ops.fetchDraftRevisionId(
      this._client,
      this._branch,
    );
    this._stale = false;
    this._owner.notifyBranchChanged(this._branchKey, this);
    return data;
  }

  async revertChanges(): Promise<void> {
    this.assertNotDisposed();
    await ops.revertChanges(this._scopeContext);
    this._revisionId = await ops.fetchDraftRevisionId(
      this._client,
      this._branch,
    );
    this._stale = false;
    this._owner.notifyBranchChanged(this._branchKey, this);
  }
}
