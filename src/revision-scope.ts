import type { Client } from './generated/client/index.js';
import type {
  ApplyMigrationsResponse,
  CountModelDto,
  CreateEndpointDto,
  CreateRowResponse,
  CreateRowsResponse,
  CreateTableResponse,
  EndpointModel,
  GetEndpointResultDto,
  GetTableRowsDto,
  InitMigrationDto,
  MigrationsResponse,
  PatchRow,
  PatchRowResponse,
  PatchRowsDto,
  PatchRowsResponse,
  RemoveMigrationDto,
  RenameMigrationDto,
  RenameRowResponse,
  RenameTableResponse,
  RevisionChangesResponse,
  RevisionModel,
  RowChangesConnection,
  RowModel,
  RowsConnection,
  TableChangesConnection,
  TableModel,
  TablesConnection,
  UpdateMigrationDto,
  UpdateRowResponse,
  UpdateRowsResponse,
  UpdateTableResponse,
  UploadFileResponse,
} from './generated/types.gen.js';
import * as ops from './data-operations.js';
import type { BranchContext, ScopeContext } from './data-operations.js';
import type { ScopeOwner } from './scope-owner.js';

export interface RevisionScopeInit {
  client: Client;
  branch: BranchContext;
  revisionId: string;
  isDraft: boolean;
  revisionMode: 'draft' | 'head' | 'explicit';
  owner: ScopeOwner;
}

export class RevisionScope {
  private readonly _client: Client;
  private readonly _branch: BranchContext;
  private readonly _revisionMode: 'draft' | 'head' | 'explicit';
  private readonly _owner: ScopeOwner;
  private _revisionId: string;
  private readonly _isDraft: boolean;
  private _stale = false;
  private _disposed = false;
  private _refreshPromise: Promise<string> | null = null;

  constructor(init: RevisionScopeInit) {
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

  private get context(): ScopeContext {
    return {
      client: this._client,
      branch: this._branch,
      isDraft: this._isDraft,
      getRevisionId: () => this.getRevisionId(),
    };
  }

  // -------------------------------------------------------------------------
  // Tables
  // -------------------------------------------------------------------------

  async getTables(options?: {
    first?: number;
    after?: string;
  }): Promise<TablesConnection> {
    return ops.getTables(this.context, options);
  }

  async getTable(tableId: string): Promise<TableModel> {
    return ops.getTable(this.context, tableId);
  }

  async getTableSchema(tableId: string): Promise<object> {
    return ops.getTableSchema(this.context, tableId);
  }

  async getTableCountRows(tableId: string): Promise<CountModelDto> {
    return ops.getTableCountRows(this.context, tableId);
  }

  async getTableForeignKeysBy(
    tableId: string,
    options?: { first?: number; after?: string },
  ): Promise<TablesConnection> {
    return ops.getTableForeignKeysBy(this.context, tableId, options);
  }

  async getTableForeignKeysTo(
    tableId: string,
    options?: { first?: number; after?: string },
  ): Promise<TablesConnection> {
    return ops.getTableForeignKeysTo(this.context, tableId, options);
  }

  async getTableCountForeignKeysBy(tableId: string): Promise<CountModelDto> {
    return ops.getTableCountForeignKeysBy(this.context, tableId);
  }

  async getTableCountForeignKeysTo(tableId: string): Promise<CountModelDto> {
    return ops.getTableCountForeignKeysTo(this.context, tableId);
  }

  async createTable(
    tableId: string,
    schema: object,
  ): Promise<CreateTableResponse> {
    return ops.createTable(this.context, tableId, schema);
  }

  async updateTable(
    tableId: string,
    patches: object[],
  ): Promise<UpdateTableResponse> {
    return ops.updateTable(this.context, tableId, patches);
  }

  async deleteTable(tableId: string): Promise<void> {
    return ops.deleteTable(this.context, tableId);
  }

  async renameTable(
    tableId: string,
    nextTableId: string,
  ): Promise<RenameTableResponse> {
    return ops.renameTable(this.context, tableId, nextTableId);
  }

  // -------------------------------------------------------------------------
  // Rows
  // -------------------------------------------------------------------------

  async getRows(
    tableId: string,
    options?: GetTableRowsDto,
  ): Promise<RowsConnection> {
    return ops.getRows(this.context, tableId, options);
  }

  async getRow(tableId: string, rowId: string): Promise<RowModel> {
    return ops.getRow(this.context, tableId, rowId);
  }

  async getRowForeignKeysBy(
    tableId: string,
    rowId: string,
    foreignKeyByTableId: string,
    options?: { first?: number; after?: string },
  ): Promise<RowsConnection> {
    return ops.getRowForeignKeysBy(
      this.context,
      tableId,
      rowId,
      foreignKeyByTableId,
      options,
    );
  }

  async getRowForeignKeysTo(
    tableId: string,
    rowId: string,
    foreignKeyToTableId: string,
    options?: { first?: number; after?: string },
  ): Promise<RowsConnection> {
    return ops.getRowForeignKeysTo(
      this.context,
      tableId,
      rowId,
      foreignKeyToTableId,
      options,
    );
  }

  async getRowCountForeignKeysBy(
    tableId: string,
    rowId: string,
  ): Promise<CountModelDto> {
    return ops.getRowCountForeignKeysBy(this.context, tableId, rowId);
  }

  async getRowCountForeignKeysTo(
    tableId: string,
    rowId: string,
  ): Promise<CountModelDto> {
    return ops.getRowCountForeignKeysTo(this.context, tableId, rowId);
  }

  async createRow(
    tableId: string,
    rowId: string,
    data: object,
  ): Promise<CreateRowResponse> {
    return ops.createRow(this.context, tableId, rowId, data);
  }

  async createRows(
    tableId: string,
    rows: Array<{ rowId: string; data: object }>,
    options?: { isRestore?: boolean },
  ): Promise<CreateRowsResponse> {
    return ops.createRows(this.context, tableId, rows, options);
  }

  async updateRow(
    tableId: string,
    rowId: string,
    data: object,
  ): Promise<UpdateRowResponse> {
    return ops.updateRow(this.context, tableId, rowId, data);
  }

  async updateRows(
    tableId: string,
    rows: Array<{ rowId: string; data: object }>,
    options?: { isRestore?: boolean },
  ): Promise<UpdateRowsResponse> {
    return ops.updateRows(this.context, tableId, rows, options);
  }

  async patchRow(
    tableId: string,
    rowId: string,
    patches: PatchRow[],
  ): Promise<PatchRowResponse> {
    return ops.patchRow(this.context, tableId, rowId, patches);
  }

  async patchRows(
    tableId: string,
    body: PatchRowsDto,
  ): Promise<PatchRowsResponse> {
    return ops.patchRows(this.context, tableId, body);
  }

  async deleteRow(tableId: string, rowId: string): Promise<void> {
    return ops.deleteRow(this.context, tableId, rowId);
  }

  async deleteRows(tableId: string, rowIds: string[]): Promise<void> {
    return ops.deleteRows(this.context, tableId, rowIds);
  }

  async renameRow(
    tableId: string,
    rowId: string,
    nextRowId: string,
  ): Promise<RenameRowResponse> {
    return ops.renameRow(this.context, tableId, rowId, nextRowId);
  }

  // -------------------------------------------------------------------------
  // Changes
  // -------------------------------------------------------------------------

  async getChanges(): Promise<RevisionChangesResponse> {
    return ops.getChanges(this.context);
  }

  async getTableChanges(options?: {
    first?: number;
    after?: string;
    compareWithRevisionId?: string;
    changeTypes?: Array<
      'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED' | 'RENAMED_AND_MODIFIED'
    >;
    search?: string;
    withSchemaMigrations?: boolean;
    includeSystem?: boolean;
  }): Promise<TableChangesConnection> {
    return ops.getTableChanges(this.context, options);
  }

  async getRowChanges(options?: {
    first?: number;
    after?: string;
    compareWithRevisionId?: string;
    tableId?: string;
    changeTypes?: Array<
      'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED' | 'RENAMED_AND_MODIFIED'
    >;
    search?: string;
    includeSystem?: boolean;
  }): Promise<RowChangesConnection> {
    return ops.getRowChanges(this.context, options);
  }

  // -------------------------------------------------------------------------
  // Migrations
  // -------------------------------------------------------------------------

  async getMigrations(): Promise<MigrationsResponse> {
    return ops.getMigrations(this.context);
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
    await ops.applyMigrations(this.context, migrations);
    await this._owner.refreshRevisionIds();
    this._revisionId = await ops.fetchDraftRevisionId(
      this._client,
      this._branch,
    );
    this._stale = false;
    this._owner.notifyBranchChanged(this._branchKey, this);
  }

  async applyMigrationsWithStatus(
    migrations: Array<
      | InitMigrationDto
      | UpdateMigrationDto
      | RenameMigrationDto
      | RemoveMigrationDto
    >,
  ): Promise<ApplyMigrationsResponse> {
    this.assertNotDisposed();
    const result = await ops.applyMigrationsWithStatus(
      this.context,
      migrations,
    );
    await this._owner.refreshRevisionIds();
    this._revisionId = await ops.fetchDraftRevisionId(
      this._client,
      this._branch,
    );
    this._stale = false;
    this._owner.notifyBranchChanged(this._branchKey, this);
    return result;
  }

  // -------------------------------------------------------------------------
  // Commit / Revert
  // -------------------------------------------------------------------------

  async commit(comment?: string): Promise<RevisionModel> {
    this.assertNotDisposed();
    const data = await ops.commit(this.context, comment);
    await this._owner.refreshRevisionIds();
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
    await ops.revertChanges(this.context);
    await this._owner.refreshRevisionIds();
    this._revisionId = await ops.fetchDraftRevisionId(
      this._client,
      this._branch,
    );
    this._stale = false;
    this._owner.notifyBranchChanged(this._branchKey, this);
  }

  // -------------------------------------------------------------------------
  // Endpoints
  // -------------------------------------------------------------------------

  async getEndpoints(): Promise<EndpointModel[]> {
    return ops.getEndpoints(this.context);
  }

  async createEndpoint(body: CreateEndpointDto): Promise<EndpointModel> {
    return ops.createEndpoint(this.context, body);
  }

  async deleteEndpoint(endpointId: string): Promise<void> {
    this.assertNotDisposed();
    return ops.deleteEndpoint(this._client, endpointId);
  }

  async getEndpointRelatives(
    endpointId: string,
  ): Promise<GetEndpointResultDto> {
    this.assertNotDisposed();
    return ops.getEndpointRelatives(this._client, endpointId);
  }

  // -------------------------------------------------------------------------
  // File upload
  // -------------------------------------------------------------------------

  async uploadFile(
    tableId: string,
    rowId: string,
    fileId: string,
    file: Blob | File,
  ): Promise<UploadFileResponse> {
    return ops.uploadFile(this.context, tableId, rowId, fileId, file);
  }
}
