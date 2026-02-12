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
  PatchRow,
  PatchRowResponse,
  RenameRowResponse,
  RenameTableResponse,
  RevisionChangesResponse,
  RevisionModel,
  RowModel,
  RowsConnection,
  TableModel,
  TablesConnection,
  UpdateRowResponse,
  UpdateRowsResponse,
  UpdateTableResponse,
} from './generated/types.gen.js';

export interface RevisiumClientOptions {
  baseUrl: string;
}

export interface SetContextOptions {
  organizationId: string;
  projectName: string;
  branchName?: string;
  revision?: string;
}

export class RevisiumClient {
  private readonly _client: Client;
  private readonly _baseUrl: string;
  private _organizationId: string | null = null;
  private _projectName: string | null = null;
  private _branchName: string | null = null;
  private _revisionId: string | null = null;
  private _isDraft = false;
  private _isAuthenticated = false;

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
    const data = this.unwrap(result);
    this._client.setConfig({ auth: data.accessToken });
    this._isAuthenticated = true;
  }

  loginWithToken(token: string): void {
    this._client.setConfig({ auth: token });
    this._isAuthenticated = true;
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

    const branchPath = { organizationId, projectName, branchName };

    if (revision === 'draft') {
      const result = await sdk.draftRevision({
        client: this._client,
        path: branchPath,
      });
      const data = this.unwrap(result);
      this._revisionId = data.id;
      this._isDraft = true;
    } else if (revision === 'head') {
      const result = await sdk.headRevision({
        client: this._client,
        path: branchPath,
      });
      const data = this.unwrap(result);
      this._revisionId = data.id;
      this._isDraft = false;
    } else {
      const result = await sdk.revision({
        client: this._client,
        path: { revisionId: revision },
      });
      this.unwrap(result);
      this._revisionId = revision;
      this._isDraft = false;
    }
  }

  async getTables(options?: {
    first?: number;
    after?: string;
  }): Promise<TablesConnection> {
    this.assertContext();
    const result = await sdk.tables({
      client: this._client,
      path: { revisionId: this._revisionId! },
      query: { first: options?.first ?? 100, after: options?.after },
    });
    return this.unwrap(result);
  }

  async getTable(tableId: string): Promise<TableModel> {
    this.assertContext();
    const result = await sdk.table({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
    });
    return this.unwrap(result);
  }

  async getTableSchema(tableId: string): Promise<object> {
    this.assertContext();
    const result = await sdk.tableSchema({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
    });
    return this.unwrap(result);
  }

  async getRows(
    tableId: string,
    options?: GetTableRowsDto,
  ): Promise<RowsConnection> {
    this.assertContext();
    const result = await sdk.rows({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
      body: options ?? { first: 100 },
    });
    return this.unwrap(result);
  }

  async getRow(tableId: string, rowId: string): Promise<RowModel> {
    this.assertContext();
    const result = await sdk.row({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId, rowId },
    });
    return this.unwrap(result);
  }

  async getChanges(): Promise<RevisionChangesResponse> {
    this.assertContext();
    const result = await sdk.revisionChanges({
      client: this._client,
      path: { revisionId: this._revisionId! },
    });
    return this.unwrap(result);
  }

  async createTable(
    tableId: string,
    schema: object,
  ): Promise<CreateTableResponse> {
    this.assertDraft();
    const result = await sdk.createTable({
      client: this._client,
      path: { revisionId: this._revisionId! },
      body: {
        tableId,
        schema: schema as { [key: string]: unknown },
      },
    });
    return this.unwrap(result);
  }

  async updateTable(
    tableId: string,
    patches: object[],
  ): Promise<UpdateTableResponse> {
    this.assertDraft();
    const result = await sdk.updateTable({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
      body: {
        patches: patches as Array<{ [key: string]: unknown }>,
      },
    });
    return this.unwrap(result);
  }

  async deleteTable(tableId: string): Promise<void> {
    this.assertDraft();
    const result = await sdk.deleteTable({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
    });
    this.unwrap(result);
  }

  async renameTable(
    tableId: string,
    nextTableId: string,
  ): Promise<RenameTableResponse> {
    this.assertDraft();
    const result = await sdk.renameTable({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
      body: { nextTableId },
    });
    return this.unwrap(result);
  }

  async createRow(
    tableId: string,
    rowId: string,
    data: object,
  ): Promise<CreateRowResponse> {
    this.assertDraft();
    const result = await sdk.createRow({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
      body: { rowId, data: data as { [key: string]: unknown } },
    });
    return this.unwrap(result);
  }

  async createRows(
    tableId: string,
    rows: Array<{ rowId: string; data: object }>,
  ): Promise<CreateRowsResponse> {
    this.assertDraft();
    const result = await sdk.createRows({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
      body: {
        rows: rows.map((r) => ({
          rowId: r.rowId,
          data: r.data as { [key: string]: unknown },
        })),
      },
    });
    return this.unwrap(result);
  }

  async updateRow(
    tableId: string,
    rowId: string,
    data: object,
  ): Promise<UpdateRowResponse> {
    this.assertDraft();
    const result = await sdk.updateRow({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId, rowId },
      body: { data: data as { [key: string]: unknown } },
    });
    return this.unwrap(result);
  }

  async updateRows(
    tableId: string,
    rows: Array<{ rowId: string; data: object }>,
  ): Promise<UpdateRowsResponse> {
    this.assertDraft();
    const result = await sdk.updateRows({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
      body: {
        rows: rows.map((r) => ({
          rowId: r.rowId,
          data: r.data as { [key: string]: unknown },
        })),
      },
    });
    return this.unwrap(result);
  }

  async patchRow(
    tableId: string,
    rowId: string,
    patches: PatchRow[],
  ): Promise<PatchRowResponse> {
    this.assertDraft();
    const result = await sdk.patchRow({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId, rowId },
      body: { patches },
    });
    return this.unwrap(result);
  }

  async deleteRow(tableId: string, rowId: string): Promise<void> {
    this.assertDraft();
    const result = await sdk.deleteRow({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId, rowId },
    });
    this.unwrap(result);
  }

  async deleteRows(tableId: string, rowIds: string[]): Promise<void> {
    this.assertDraft();
    const result = await sdk.deleteRows({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId },
      body: { rowIds },
    });
    this.unwrap(result);
  }

  async renameRow(
    tableId: string,
    rowId: string,
    nextRowId: string,
  ): Promise<RenameRowResponse> {
    this.assertDraft();
    const result = await sdk.renameRow({
      client: this._client,
      path: { revisionId: this._revisionId!, tableId, rowId },
      body: { nextRowId },
    });
    return this.unwrap(result);
  }

  async commit(comment?: string): Promise<RevisionModel> {
    this.assertDraft();
    const result = await sdk.createRevision({
      client: this._client,
      path: {
        organizationId: this._organizationId!,
        projectName: this._projectName!,
        branchName: this._branchName!,
      },
      body: { comment },
    });
    const data = this.unwrap(result);
    await this.refreshDraftRevisionId();
    return data;
  }

  async revertChanges(): Promise<void> {
    this.assertDraft();
    await sdk.revertChanges({
      client: this._client,
      path: {
        organizationId: this._organizationId!,
        projectName: this._projectName!,
        branchName: this._branchName!,
      },
    });
    await this.refreshDraftRevisionId();
  }

  private assertDraft(): void {
    this.assertContext();
    if (!this._isDraft) {
      throw new Error(
        'Mutations are only allowed in draft revision. Use setContext({ revision: "draft" }).',
      );
    }
  }

  private assertContext(): void {
    if (this._revisionId === null) {
      throw new Error('Context not set. Call setContext() first.');
    }
  }

  private async refreshDraftRevisionId(): Promise<void> {
    const result = await sdk.draftRevision({
      client: this._client,
      path: {
        organizationId: this._organizationId!,
        projectName: this._projectName!,
        branchName: this._branchName!,
      },
    });
    const data = this.unwrap(result);
    this._revisionId = data.id;
  }

  private unwrap<T>(result: { data?: T; error?: unknown }): T {
    if (result.error) {
      const err = result.error as { statusCode?: number; message?: string };
      throw new Error(
        err.message ?? `API error: ${JSON.stringify(result.error)}`,
      );
    }
    return result.data as T;
  }
}
