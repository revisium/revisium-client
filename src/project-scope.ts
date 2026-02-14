import type { Client } from './generated/client/index.js';
import type {
  BranchesConnection,
  BranchModel,
  CreateEndpointDto,
  EndpointModel,
  GetEndpointResultDto,
  ProjectModel,
  UpdateProjectDto,
  UsersProjectConnection,
} from './generated/types.gen.js';
import * as ops from './data-operations.js';
import type { ProjectContext } from './data-operations.js';
import { BranchScope } from './branch-scope.js';

export class ProjectScope {
  constructor(
    private readonly _client: Client,
    private readonly _organizationId: string,
    private readonly _projectName: string,
  ) {}

  public get organizationId(): string {
    return this._organizationId;
  }

  public get projectName(): string {
    return this._projectName;
  }

  public get client(): Client {
    return this._client;
  }

  async branch(branchName?: string): Promise<BranchScope> {
    return BranchScope.create(this._client, {
      client: this._client,
      organizationId: this._organizationId,
      projectName: this._projectName,
      branchName: branchName ?? 'master',
    });
  }

  private get projectContext(): ProjectContext {
    return {
      client: this._client,
      organizationId: this._organizationId,
      projectName: this._projectName,
    };
  }

  async get(): Promise<ProjectModel> {
    return ops.getProject(this.projectContext);
  }

  async update(body: UpdateProjectDto): Promise<void> {
    return ops.updateProject(this.projectContext, body);
  }

  async delete(): Promise<void> {
    return ops.deleteProject(this.projectContext);
  }

  async getBranches(options?: {
    first?: number;
    after?: string;
  }): Promise<BranchesConnection> {
    return ops.getBranches(this.projectContext, options);
  }

  async getRootBranch(): Promise<BranchModel> {
    return ops.getRootBranch(this.projectContext);
  }

  async createBranch(
    branchName: string,
    revisionId: string,
  ): Promise<BranchModel> {
    return ops.createBranch(this._client, revisionId, branchName);
  }

  async getUsers(options?: {
    first?: number;
    after?: string;
  }): Promise<UsersProjectConnection> {
    return ops.getProjectUsers(this.projectContext, options);
  }

  async addUser(
    userId: string,
    roleId: 'developer' | 'editor' | 'reader',
  ): Promise<void> {
    return ops.addProjectUser(this.projectContext, userId, roleId);
  }

  async removeUser(userId: string): Promise<void> {
    return ops.removeProjectUser(this.projectContext, userId);
  }

  async getEndpoints(): Promise<EndpointModel[]> {
    const branch = await this.branch();
    return branch.draft().getEndpoints();
  }

  async createEndpoint(body: CreateEndpointDto): Promise<EndpointModel> {
    const branch = await this.branch();
    return branch.draft().createEndpoint(body);
  }

  async deleteEndpoint(endpointId: string): Promise<void> {
    return ops.deleteEndpoint(this._client, endpointId);
  }

  async getEndpointRelatives(
    endpointId: string,
  ): Promise<GetEndpointResultDto> {
    return ops.getEndpointRelatives(this._client, endpointId);
  }
}
