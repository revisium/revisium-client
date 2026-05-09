import {
  type Client,
  createClient,
  createConfig,
} from './generated/client/index.js';
import * as sdk from './generated/sdk.gen.js';
import type { MeModel } from './generated/types.gen.js';
import {
  appendApiKeyQueryParam,
  assertValidApiKey,
  type ApiKeyAuthOptions,
  type ApiKeyModel,
  type ApiKeyTransport,
  type ApiKeyWithSecret,
  type CreatePersonalApiKeyInput,
  type CreateServiceApiKeyInput,
  toCreatePersonalApiKeyDto,
  toCreateServiceApiKeyDto,
} from './api-keys.js';
import * as ops from './data-operations.js';
import { OrgScope } from './org-scope.js';
import { BranchScope } from './branch-scope.js';
import { RevisionScope } from './revision-scope.js';

export interface RevisiumClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
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
  private _apiKeyQueryInterceptorId?: number;

  constructor(options: RevisiumClientOptions) {
    const url = options.baseUrl;
    this._baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this._client = createClient(
      createConfig({ baseUrl: this._baseUrl, fetch: options.fetch }),
    );
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
    this.setBearerToken(data.accessToken);
  }

  loginWithToken(token: string): void {
    this.setBearerToken(token);
  }

  loginWithApiKey(key: string, options: ApiKeyAuthOptions = {}): void {
    assertValidApiKey(key);
    const transport: ApiKeyTransport = options.transport ?? 'header';

    if (transport === 'query' && options.queryParamName === '') {
      throw new Error('API key query parameter name must not be empty.');
    }

    const queryParamName = options.queryParamName ?? 'api_key';

    this.clearApiKeyQueryInterceptor();

    if (transport === 'header') {
      this._client.setConfig({
        auth: undefined,
        headers: { 'X-Api-Key': key, Authorization: null },
      });
    } else if (transport === 'bearer') {
      this._client.setConfig({
        auth: undefined,
        headers: { 'X-Api-Key': null, Authorization: `Bearer ${key}` },
      });
    } else {
      this._client.setConfig({
        auth: undefined,
        headers: { 'X-Api-Key': null, Authorization: null },
      });
      this._apiKeyQueryInterceptorId = this._client.interceptors.request.use(
        (request) => appendApiKeyQueryParam(request, queryParamName, key),
      );
    }

    this._isAuthenticated = true;
  }

  async me(): Promise<MeModel> {
    return ops.me(this._client);
  }

  async createPersonalApiKey(
    data: CreatePersonalApiKeyInput,
  ): Promise<ApiKeyWithSecret> {
    const result = ops.unwrap(
      await sdk.createPersonalApiKey({
        client: this._client,
        body: toCreatePersonalApiKeyDto(data),
      }),
    );
    return result as unknown as ApiKeyWithSecret;
  }

  async createServiceApiKey(
    data: CreateServiceApiKeyInput,
  ): Promise<ApiKeyWithSecret> {
    const { organizationId, ...body } = data;
    const result = ops.unwrap(
      await sdk.createServiceApiKey({
        client: this._client,
        path: { organizationId },
        body: toCreateServiceApiKeyDto(body),
      }),
    );
    return result as unknown as ApiKeyWithSecret;
  }

  async rotateApiKey(id: string): Promise<ApiKeyWithSecret> {
    const result = ops.unwrap(
      await sdk.rotateApiKey({ client: this._client, path: { id } }),
    );
    return result as unknown as ApiKeyWithSecret;
  }

  async revokeApiKey(id: string): Promise<ApiKeyModel> {
    const result = ops.unwrap(
      await sdk.revokeApiKey({ client: this._client, path: { id } }),
    );
    return result as unknown as ApiKeyModel;
  }

  async getMyApiKeys(): Promise<ApiKeyModel[]> {
    const result = ops.unwrap(await sdk.myApiKeys({ client: this._client }));
    return result as unknown as ApiKeyModel[];
  }

  async getServiceApiKeys(organizationId: string): Promise<ApiKeyModel[]> {
    const result = ops.unwrap(
      await sdk.serviceApiKeys({
        client: this._client,
        path: { organizationId },
      }),
    );
    return result as unknown as ApiKeyModel[];
  }

  async getApiKeyById(id: string): Promise<ApiKeyModel> {
    const result = ops.unwrap(
      await sdk.apiKeyById({ client: this._client, path: { id } }),
    );
    return result as unknown as ApiKeyModel;
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

  private setBearerToken(token: string): void {
    this.clearApiKeyQueryInterceptor();
    this._client.setConfig({
      auth: token,
      headers: { 'X-Api-Key': null, Authorization: null },
    });
    this._isAuthenticated = true;
  }

  private clearApiKeyQueryInterceptor(): void {
    if (this._apiKeyQueryInterceptorId !== undefined) {
      this._client.interceptors.request.eject(this._apiKeyQueryInterceptorId);
      this._apiKeyQueryInterceptorId = undefined;
    }
  }
}
