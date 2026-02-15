import {
  type Client,
  createClient,
  createConfig,
} from './generated/client/index.js';
import * as sdk from './generated/sdk.gen.js';
import type { MeModel } from './generated/types.gen.js';
import * as ops from './data-operations.js';
import { OrgScope } from './org-scope.js';
import { BranchScope } from './branch-scope.js';
import { RevisionScope } from './revision-scope.js';

export interface RevisiumClientOptions {
  baseUrl: string;
}

export interface BranchShortcut {
  org: string;
  project: string;
  branch?: string;
}

export interface RevisionShortcut extends BranchShortcut {
  revision?: string;
}

export class RevisiumClient {
  private readonly _client: Client;
  private readonly _baseUrl: string;
  private _isAuthenticated = false;

  constructor(options: RevisiumClientOptions) {
    const url = options.baseUrl;
    this._baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this._client = createClient(createConfig({ baseUrl: this._baseUrl }));
  }

  public get baseUrl(): string {
    return this._baseUrl;
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

  org(organizationId: string): OrgScope {
    return new OrgScope(this._client, organizationId);
  }

  async branch(options: BranchShortcut): Promise<BranchScope> {
    return BranchScope.create(this._client, {
      client: this._client,
      organizationId: options.org,
      projectName: options.project,
      branchName: options.branch ?? 'master',
    });
  }

  async revision(options: RevisionShortcut): Promise<RevisionScope> {
    const bs = await this.branch(options);
    const rev = options.revision ?? 'draft';
    if (rev === 'draft') {
      return bs.draft();
    }
    if (rev === 'head') {
      return bs.head();
    }
    return bs.revision(rev);
  }
}
