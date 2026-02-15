import type { Client } from './generated/client/index.js';
import * as sdk from './generated/sdk.gen.js';
import type {
  ApplyMigrationsResponse,
  BranchesConnection,
  BranchModel,
  CountModelDto,
  CreateEndpointDto,
  CreateProjectDto,
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
  ProjectModel,
  ProjectsConnection,
  RemoveMigrationDto,
  RenameMigrationDto,
  RenameRowResponse,
  RenameTableResponse,
  RevisionChangesResponse,
  RevisionModel,
  RevisionsConnection,
  RowChangesConnection,
  RowModel,
  RowsConnection,
  TableChangesConnection,
  TableModel,
  TablesConnection,
  TouchedModelDto,
  UpdateMigrationDto,
  UpdateProjectDto,
  UpdateRowResponse,
  UpdateRowsResponse,
  UpdateTableResponse,
  UploadFileResponse,
  UsersOrganizationConnection,
  UsersProjectConnection,
  MeModel,
} from './generated/types.gen.js';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export interface OrgContext {
  readonly client: Client;
  readonly organizationId: string;
}

export interface ProjectContext extends OrgContext {
  readonly projectName: string;
}

export interface BranchContext extends ProjectContext {
  readonly branchName: string;
}

export interface ScopeContext {
  readonly client: Client;
  readonly branch: BranchContext;
  readonly isDraft: boolean;
  getRevisionId(): Promise<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    throw new Error('Mutations are only allowed in draft revision.');
  }
}

export function assertContext(ctx: ScopeContext): void {
  if (!ctx.branch.organizationId) {
    throw new Error('Context not set. Call setContext() first.');
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function me(client: Client): Promise<MeModel> {
  return unwrap(await sdk.me({ client }));
}

// ---------------------------------------------------------------------------
// Organization operations
// ---------------------------------------------------------------------------

export async function getProjects(
  ctx: OrgContext,
  options?: { first?: number; after?: string },
): Promise<ProjectsConnection> {
  const result = await sdk.projects({
    client: ctx.client,
    path: { organizationId: ctx.organizationId },
    query: { first: options?.first ?? 100, after: options?.after },
  });
  return unwrap(result);
}

export async function createProject(
  ctx: OrgContext,
  body: CreateProjectDto,
): Promise<ProjectModel> {
  const result = await sdk.createProject({
    client: ctx.client,
    path: { organizationId: ctx.organizationId },
    body,
  });
  return unwrap(result);
}

export async function getOrgUsers(
  ctx: OrgContext,
  options?: { first?: number; after?: string },
): Promise<UsersOrganizationConnection> {
  const result = await sdk.usersOrganization({
    client: ctx.client,
    path: { organizationId: ctx.organizationId },
    query: { first: options?.first ?? 100, after: options?.after },
  });
  return unwrap(result);
}

export async function addOrgUser(
  ctx: OrgContext,
  userId: string,
  roleId:
    | 'organizationOwner'
    | 'organizationAdmin'
    | 'developer'
    | 'editor'
    | 'reader',
): Promise<void> {
  const result = await sdk.addUserToOrganization({
    client: ctx.client,
    path: { organizationId: ctx.organizationId },
    body: { userId, roleId },
  });
  unwrap(result);
}

export async function removeOrgUser(
  ctx: OrgContext,
  userId: string,
): Promise<void> {
  const result = await sdk.removeUserFromOrganization({
    client: ctx.client,
    path: { organizationId: ctx.organizationId },
    body: { userId },
  });
  unwrap(result);
}

// ---------------------------------------------------------------------------
// Project operations
// ---------------------------------------------------------------------------

export async function getProject(ctx: ProjectContext): Promise<ProjectModel> {
  const result = await sdk.project({
    client: ctx.client,
    path: {
      organizationId: ctx.organizationId,
      projectName: ctx.projectName,
    },
  });
  return unwrap(result);
}

export async function updateProject(
  ctx: ProjectContext,
  body: UpdateProjectDto,
): Promise<void> {
  const result = await sdk.updateProject({
    client: ctx.client,
    path: {
      organizationId: ctx.organizationId,
      projectName: ctx.projectName,
    },
    body,
  });
  unwrap(result);
}

export async function deleteProject(ctx: ProjectContext): Promise<void> {
  const result = await sdk.deleteProject({
    client: ctx.client,
    path: {
      organizationId: ctx.organizationId,
      projectName: ctx.projectName,
    },
  });
  unwrap(result);
}

export async function getBranches(
  ctx: ProjectContext,
  options?: { first?: number; after?: string },
): Promise<BranchesConnection> {
  const result = await sdk.branches({
    client: ctx.client,
    path: {
      organizationId: ctx.organizationId,
      projectName: ctx.projectName,
    },
    query: { first: options?.first ?? 100, after: options?.after },
  });
  return unwrap(result);
}

export async function getRootBranch(ctx: ProjectContext): Promise<BranchModel> {
  const result = await sdk.rootBranch({
    client: ctx.client,
    path: {
      organizationId: ctx.organizationId,
      projectName: ctx.projectName,
    },
  });
  return unwrap(result);
}

export async function getProjectUsers(
  ctx: ProjectContext,
  options?: { first?: number; after?: string },
): Promise<UsersProjectConnection> {
  const result = await sdk.usersProject({
    client: ctx.client,
    path: {
      organizationId: ctx.organizationId,
      projectName: ctx.projectName,
    },
    query: { first: options?.first ?? 100, after: options?.after },
  });
  return unwrap(result);
}

export async function addProjectUser(
  ctx: ProjectContext,
  userId: string,
  roleId: 'developer' | 'editor' | 'reader',
): Promise<void> {
  const result = await sdk.addUserToProject({
    client: ctx.client,
    path: {
      organizationId: ctx.organizationId,
      projectName: ctx.projectName,
    },
    body: { userId, roleId },
  });
  unwrap(result);
}

export async function removeProjectUser(
  ctx: ProjectContext,
  userId: string,
): Promise<void> {
  const result = await sdk.removeUserFromProject({
    client: ctx.client,
    path: {
      organizationId: ctx.organizationId,
      projectName: ctx.projectName,
      userId,
    },
  });
  unwrap(result);
}

// ---------------------------------------------------------------------------
// Branch operations
// ---------------------------------------------------------------------------

export async function getBranch(
  client: Client,
  branch: BranchContext,
): Promise<BranchModel> {
  const result = await sdk.branch({
    client,
    path: {
      organizationId: branch.organizationId,
      projectName: branch.projectName,
      branchName: branch.branchName,
    },
  });
  return unwrap(result);
}

export async function createBranch(
  client: Client,
  revisionId: string,
  branchName: string,
): Promise<BranchModel> {
  const result = await sdk.createBranch({
    client,
    path: { revisionId },
    body: { branchName },
  });
  return unwrap(result);
}

export async function deleteBranch(
  client: Client,
  branch: BranchContext,
): Promise<void> {
  const result = await sdk.deleteBranch({
    client,
    path: {
      organizationId: branch.organizationId,
      projectName: branch.projectName,
      branchName: branch.branchName,
    },
  });
  unwrap(result);
}

export async function getBranchTouched(
  client: Client,
  branch: BranchContext,
): Promise<TouchedModelDto> {
  const result = await sdk.branchTouched({
    client,
    path: {
      organizationId: branch.organizationId,
      projectName: branch.projectName,
      branchName: branch.branchName,
    },
  });
  return unwrap(result);
}

// ---------------------------------------------------------------------------
// Revision navigation
// ---------------------------------------------------------------------------

export async function getRevisions(
  client: Client,
  branch: BranchContext,
  options?: {
    first?: number;
    after?: string;
    before?: string;
    inclusive?: boolean;
  },
): Promise<RevisionsConnection> {
  const result = await sdk.revisions({
    client,
    path: {
      organizationId: branch.organizationId,
      projectName: branch.projectName,
      branchName: branch.branchName,
    },
    query: { ...options, first: options?.first ?? 100 },
  });
  return unwrap(result);
}

export async function getRevision(
  client: Client,
  revisionId: string,
): Promise<RevisionModel> {
  const result = await sdk.revision({
    client,
    path: { revisionId },
  });
  return unwrap(result);
}

export async function getParentRevision(
  client: Client,
  revisionId: string,
): Promise<RevisionModel> {
  const result = await sdk.parentRevision({
    client,
    path: { revisionId },
  });
  return unwrap(result);
}

export async function getChildRevision(
  client: Client,
  revisionId: string,
): Promise<RevisionModel> {
  const result = await sdk.childRevision({
    client,
    path: { revisionId },
  });
  return unwrap(result);
}

export async function getStartRevision(
  client: Client,
  branch: BranchContext,
): Promise<RevisionModel> {
  const result = await sdk.startRevision({
    client,
    path: {
      organizationId: branch.organizationId,
      projectName: branch.projectName,
      branchName: branch.branchName,
    },
  });
  return unwrap(result);
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

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

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

export async function applyMigrationsWithStatus(
  ctx: ScopeContext,
  migrations: Array<
    | InitMigrationDto
    | UpdateMigrationDto
    | RenameMigrationDto
    | RemoveMigrationDto
  >,
): Promise<ApplyMigrationsResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.applyMigrations({
    client: ctx.client,
    path: { revisionId },
    body: migrations,
  });
  return unwrap(result);
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

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

export async function getTableCountRows(
  ctx: ScopeContext,
  tableId: string,
): Promise<CountModelDto> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.tableCountRows({
    client: ctx.client,
    path: { revisionId, tableId },
  });
  return unwrap(result);
}

export async function getTableForeignKeysBy(
  ctx: ScopeContext,
  tableId: string,
  options?: { first?: number; after?: string },
): Promise<TablesConnection> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.tableForeignKeysBy({
    client: ctx.client,
    path: { revisionId, tableId },
    query: { first: options?.first ?? 100, after: options?.after },
  });
  return unwrap(result);
}

export async function getTableForeignKeysTo(
  ctx: ScopeContext,
  tableId: string,
  options?: { first?: number; after?: string },
): Promise<TablesConnection> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.tableForeignKeysTo({
    client: ctx.client,
    path: { revisionId, tableId },
    query: { first: options?.first ?? 100, after: options?.after },
  });
  return unwrap(result);
}

export async function getTableCountForeignKeysBy(
  ctx: ScopeContext,
  tableId: string,
): Promise<CountModelDto> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.tableCountForeignKeysBy({
    client: ctx.client,
    path: { revisionId, tableId },
  });
  return unwrap(result);
}

export async function getTableCountForeignKeysTo(
  ctx: ScopeContext,
  tableId: string,
): Promise<CountModelDto> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.tableCountForeignKeysTo({
    client: ctx.client,
    path: { revisionId, tableId },
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

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

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

export async function getRowForeignKeysBy(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
  foreignKeyByTableId: string,
  options?: { first?: number; after?: string },
): Promise<RowsConnection> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.rowForeignKeysBy({
    client: ctx.client,
    path: { revisionId, tableId, rowId },
    query: {
      foreignKeyByTableId,
      first: options?.first ?? 100,
      after: options?.after,
    },
  });
  return unwrap(result);
}

export async function getRowForeignKeysTo(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
  foreignKeyToTableId: string,
  options?: { first?: number; after?: string },
): Promise<RowsConnection> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.rowForeignKeysTo({
    client: ctx.client,
    path: { revisionId, tableId, rowId },
    query: {
      foreignKeyToTableId,
      first: options?.first ?? 100,
      after: options?.after,
    },
  });
  return unwrap(result);
}

export async function getRowCountForeignKeysBy(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
): Promise<CountModelDto> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.rowCountForeignKeysBy({
    client: ctx.client,
    path: { revisionId, tableId, rowId },
  });
  return unwrap(result);
}

export async function getRowCountForeignKeysTo(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
): Promise<CountModelDto> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.rowCountForeignKeysTo({
    client: ctx.client,
    path: { revisionId, tableId, rowId },
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

export async function patchRows(
  ctx: ScopeContext,
  tableId: string,
  body: PatchRowsDto,
): Promise<PatchRowsResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.patchRows({
    client: ctx.client,
    path: { revisionId, tableId },
    body,
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

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

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

export async function getTableChanges(
  ctx: ScopeContext,
  options?: {
    first?: number;
    after?: string;
    compareWithRevisionId?: string;
    changeTypes?: Array<
      'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED' | 'RENAMED_AND_MODIFIED'
    >;
    search?: string;
    withSchemaMigrations?: boolean;
    includeSystem?: boolean;
  },
): Promise<TableChangesConnection> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.tableChanges({
    client: ctx.client,
    path: { revisionId },
    query: { ...options, first: options?.first ?? 100 },
  });
  return unwrap(result);
}

export async function getRowChanges(
  ctx: ScopeContext,
  options?: {
    first?: number;
    after?: string;
    compareWithRevisionId?: string;
    tableId?: string;
    changeTypes?: Array<
      'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED' | 'RENAMED_AND_MODIFIED'
    >;
    search?: string;
    includeSystem?: boolean;
  },
): Promise<RowChangesConnection> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.rowChanges({
    client: ctx.client,
    path: { revisionId },
    query: { ...options, first: options?.first ?? 100 },
  });
  return unwrap(result);
}

// ---------------------------------------------------------------------------
// Commit / Revert
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function getEndpoints(
  ctx: ScopeContext,
): Promise<EndpointModel[]> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.endpoints({
    client: ctx.client,
    path: { revisionId },
  });
  return unwrap(result);
}

export async function createEndpoint(
  ctx: ScopeContext,
  body: CreateEndpointDto,
): Promise<EndpointModel> {
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.createEndpoint({
    client: ctx.client,
    path: { revisionId },
    body,
  });
  return unwrap(result);
}

export async function deleteEndpoint(
  client: Client,
  endpointId: string,
): Promise<void> {
  const result = await sdk.deleteEndpoint({
    client,
    path: { endpointId },
  });
  unwrap(result);
}

export async function getEndpointRelatives(
  client: Client,
  endpointId: string,
): Promise<GetEndpointResultDto> {
  const result = await sdk.endpointRelatives({
    client,
    path: { endpointId },
  });
  return unwrap(result);
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

export async function uploadFile(
  ctx: ScopeContext,
  tableId: string,
  rowId: string,
  fileId: string,
  file: Blob | File,
): Promise<UploadFileResponse> {
  assertDraft(ctx);
  const revisionId = await ctx.getRevisionId();
  const result = await sdk.uploadFile({
    client: ctx.client,
    path: { revisionId, tableId, rowId, fileId },
    body: { file },
  });
  return unwrap(result);
}

export type { MeModel };
