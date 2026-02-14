import type { Client } from './generated/client/index.js';
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

export interface BranchContext {
  readonly organizationId: string;
  readonly projectName: string;
  readonly branchName: string;
}

export interface ScopeContext {
  readonly client: Client;
  readonly branch: BranchContext;
  readonly isDraft: boolean;
  getRevisionId(): Promise<string>;
}

export function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error) {
    const err = result.error as { statusCode?: number; message?: string };
    throw new Error(
      err.message ?? `API error: ${JSON.stringify(result.error)}`,
    );
  }
  return result.data as T;
}

export function assertDraft(ctx: ScopeContext): void {
  assertContext(ctx);
  if (!ctx.isDraft) {
    throw new Error(
      'Mutations are only allowed in draft revision. Use setContext({ revision: "draft" }).',
    );
  }
}

export function assertContext(ctx: ScopeContext): void {
  if (!ctx.branch.organizationId) {
    throw new Error('Context not set. Call setContext() first.');
  }
}

export async function me(client: Client): Promise<MeModel> {
  return unwrap(await sdk.me({ client }));
}

export async function getMigrations(
  ctx: ScopeContext,
): Promise<MigrationsResponse> {
  assertContext(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.migrations({
    client: ctx.client,
    path: { revisionId },
  });
  return unwrap(result);
}

export async function applyMigrations(
  ctx: ScopeContext,
  migrations: Array<
    | InitMigrationDto
    | UpdateMigrationDto
    | RenameMigrationDto
    | RemoveMigrationDto
  >,
): Promise<void> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.applyMigrations({
    client: ctx.client,
    path: { revisionId },
    body: migrations,
  });
  unwrap(result);
}

export async function getTables(
  ctx: ScopeContext,
  options?: { first?: number; after?: string },
): Promise<TablesConnection> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.tables({
    client: ctx.client,
    path: { revisionId },
    query: { first: options?.first ?? 100, after: options?.after },
  });
  return unwrap(result);
}

export async function getTable(
  ctx: ScopeContext,
  tableId: string,
): Promise<TableModel> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.table({
    client: ctx.client,
    path: { revisionId, tableId },
  });
  return unwrap(result);
}

export async function getTableSchema(
  ctx: ScopeContext,
  tableId: string,
): Promise<object> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.tableSchema({
    client: ctx.client,
    path: { revisionId, tableId },
  });
  return unwrap(result);
}

export async function getRows(
  ctx: ScopeContext,
  tableId: string,
  options?: GetTableRowsDto,
): Promise<RowsConnection> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.rows({
    client: ctx.client,
    path: { revisionId, tableId },
    body: options ?? { first: 100 },
  });
  return unwrap(result);
}

export async function getRow(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
): Promise<RowModel> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.row({
    client: ctx.client,
    path: { revisionId, tableId, rowId },
  });
  return unwrap(result);
}

export async function getChanges(
  ctx: ScopeContext,
): Promise<RevisionChangesResponse> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.revisionChanges({
    client: ctx.client,
    path: { revisionId },
  });
  return unwrap(result);
}

export async function createTable(
  ctx: ScopeContext,
  tableId: string,
  schema: object,
): Promise<CreateTableResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.createTable({
    client: ctx.client,
    path: { revisionId },
    body: {
      tableId,
      schema: schema as { [key: string]: unknown },
    },
  });
  return unwrap(result);
}

export async function updateTable(
  ctx: ScopeContext,
  tableId: string,
  patches: object[],
): Promise<UpdateTableResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.updateTable({
    client: ctx.client,
    path: { revisionId, tableId },
    body: {
      patches: patches as Array<{ [key: string]: unknown }>,
    },
  });
  return unwrap(result);
}

export async function deleteTable(
  ctx: ScopeContext,
  tableId: string,
): Promise<void> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.deleteTable({
    client: ctx.client,
    path: { revisionId, tableId },
  });
  unwrap(result);
}

export async function renameTable(
  ctx: ScopeContext,
  tableId: string,
  nextTableId: string,
): Promise<RenameTableResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.renameTable({
    client: ctx.client,
    path: { revisionId, tableId },
    body: { nextTableId },
  });
  return unwrap(result);
}

export async function createRow(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
  data: object,
): Promise<CreateRowResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.createRow({
    client: ctx.client,
    path: { revisionId, tableId },
    body: { rowId, data: data as { [key: string]: unknown } },
  });
  return unwrap(result);
}

export async function createRows(
  ctx: ScopeContext,
  tableId: string,
  rows: Array<{ rowId: string; data: object }>,
  options?: { isRestore?: boolean },
): Promise<CreateRowsResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.createRows({
    client: ctx.client,
    path: { revisionId, tableId },
    body: {
      rows: rows.map((r) => ({
        rowId: r.rowId,
        data: r.data as { [key: string]: unknown },
      })),
      isRestore: options?.isRestore,
    },
  });
  return unwrap(result);
}

export async function updateRow(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
  data: object,
): Promise<UpdateRowResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.updateRow({
    client: ctx.client,
    path: { revisionId, tableId, rowId },
    body: { data: data as { [key: string]: unknown } },
  });
  return unwrap(result);
}

export async function updateRows(
  ctx: ScopeContext,
  tableId: string,
  rows: Array<{ rowId: string; data: object }>,
  options?: { isRestore?: boolean },
): Promise<UpdateRowsResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.updateRows({
    client: ctx.client,
    path: { revisionId, tableId },
    body: {
      rows: rows.map((r) => ({
        rowId: r.rowId,
        data: r.data as { [key: string]: unknown },
      })),
      isRestore: options?.isRestore,
    },
  });
  return unwrap(result);
}

export async function patchRow(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
  patches: PatchRow[],
): Promise<PatchRowResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.patchRow({
    client: ctx.client,
    path: { revisionId, tableId, rowId },
    body: { patches },
  });
  return unwrap(result);
}

export async function deleteRow(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
): Promise<void> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.deleteRow({
    client: ctx.client,
    path: { revisionId, tableId, rowId },
  });
  unwrap(result);
}

export async function deleteRows(
  ctx: ScopeContext,
  tableId: string,
  rowIds: string[],
): Promise<void> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.deleteRows({
    client: ctx.client,
    path: { revisionId, tableId },
    body: { rowIds },
  });
  unwrap(result);
}

export async function renameRow(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
  nextRowId: string,
): Promise<RenameRowResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.renameRow({
    client: ctx.client,
    path: { revisionId, tableId, rowId },
    body: { nextRowId },
  });
  return unwrap(result);
}

export async function commit(
  ctx: ScopeContext,
  comment?: string,
): Promise<RevisionModel> {
  assertDraft(ctx);
  const result = await sdk.createRevision({
    client: ctx.client,
    path: {
      organizationId: ctx.branch.organizationId,
      projectName: ctx.branch.projectName,
      branchName: ctx.branch.branchName,
    },
    body: { comment },
  });
  return unwrap(result);
}

export async function revertChanges(ctx: ScopeContext): Promise<void> {
  assertDraft(ctx);
  const result = await sdk.revertChanges({
    client: ctx.client,
    path: {
      organizationId: ctx.branch.organizationId,
      projectName: ctx.branch.projectName,
      branchName: ctx.branch.branchName,
    },
  });
  unwrap(result);
}

export async function fetchDraftRevisionId(
  client: Client,
  branch: BranchContext,
): Promise<string> {
  const result = await sdk.draftRevision({
    client,
    path: {
      organizationId: branch.organizationId,
      projectName: branch.projectName,
      branchName: branch.branchName,
    },
  });
  return unwrap(result).id;
}

export async function fetchHeadRevisionId(
  client: Client,
  branch: BranchContext,
): Promise<string> {
  const result = await sdk.headRevision({
    client,
    path: {
      organizationId: branch.organizationId,
      projectName: branch.projectName,
      branchName: branch.branchName,
    },
  });
  return unwrap(result).id;
}

export async function validateRevisionId(
  client: Client,
  revisionId: string,
): Promise<void> {
  const result = await sdk.revision({
    client,
    path: { revisionId },
  });
  unwrap(result);
}
