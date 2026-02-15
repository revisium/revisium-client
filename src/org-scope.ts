import type { Client } from './generated/client/index.js';
import type {
  CreateProjectDto,
  ProjectModel,
  ProjectsConnection,
  UsersOrganizationConnection,
} from './generated/types.gen.js';
import * as ops from './data-operations.js';
import type { OrgContext } from './data-operations.js';
import { ProjectScope } from './project-scope.js';

export class OrgScope {
  constructor(
    private readonly _client: Client,
    private readonly _organizationId: string,
  ) {}

  public get organizationId(): string {
    return this._organizationId;
  }

  public get client(): Client {
    return this._client;
  }

  project(projectName: string): ProjectScope {
    return new ProjectScope(this._client, this._organizationId, projectName);
  }

  private get orgContext(): OrgContext {
    return { client: this._client, organizationId: this._organizationId };
  }

  async getProjects(options?: {
    first?: number;
    after?: string;
  }): Promise<ProjectsConnection> {
    return ops.getProjects(this.orgContext, options);
  }

  async createProject(body: CreateProjectDto): Promise<ProjectModel> {
    return ops.createProject(this.orgContext, body);
  }

  async getUsers(options?: {
    first?: number;
    after?: string;
  }): Promise<UsersOrganizationConnection> {
    return ops.getOrgUsers(this.orgContext, options);
  }

  async addUser(
    userId: string,
    roleId:
      | 'organizationOwner'
      | 'organizationAdmin'
      | 'developer'
      | 'editor'
      | 'reader',
  ): Promise<void> {
    return ops.addOrgUser(this.orgContext, userId, roleId);
  }

  async removeUser(userId: string): Promise<void> {
    return ops.removeOrgUser(this.orgContext, userId);
  }
}
