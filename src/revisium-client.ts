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
  private _apiKeyAuth?: {
    key: string;
    transport: ApiKeyTransport;
    queryParamName: string;
  };
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
    const transport = options.transport ?? 'header';

    if (transport === 'query' && options.queryParamName === '') {
      throw new Error('API key query parameter name must not be empty.');
    }

    const queryParamName = options.queryParamName ?? 'api_key';

    this.clearApiKeyQueryInterceptor();
    this._apiKeyAuth = { key, transport, queryParamName };

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
    const result = await this.graphql<{
      createPersonalApiKey: ApiKeyWithSecret;
    }>(
      `mutation CreatePersonalApiKey($data: CreatePersonalApiKeyInput!) {
        createPersonalApiKey(data: $data) {
          secret
          apiKey { ${API_KEY_FIELDS} }
        }
      }`,
      { data },
    );
    return result.createPersonalApiKey;
  }

  async createServiceApiKey(
    data: CreateServiceApiKeyInput,
  ): Promise<ApiKeyWithSecret> {
    const result = await this.graphql<{
      createServiceApiKey: ApiKeyWithSecret;
    }>(
      `mutation CreateServiceApiKey($data: CreateServiceApiKeyInput!) {
        createServiceApiKey(data: $data) {
          secret
          apiKey { ${API_KEY_FIELDS} }
        }
      }`,
      { data },
    );
    return result.createServiceApiKey;
  }

  async rotateApiKey(id: string): Promise<ApiKeyWithSecret> {
    const result = await this.graphql<{ rotateApiKey: ApiKeyWithSecret }>(
      `mutation RotateApiKey($id: ID!) {
        rotateApiKey(id: $id) {
          secret
          apiKey { ${API_KEY_FIELDS} }
        }
      }`,
      { id },
    );
    return result.rotateApiKey;
  }

  async revokeApiKey(id: string): Promise<ApiKeyModel> {
    const result = await this.graphql<{ revokeApiKey: ApiKeyModel }>(
      `mutation RevokeApiKey($id: ID!) {
        revokeApiKey(id: $id) { ${API_KEY_FIELDS} }
      }`,
      { id },
    );
    return result.revokeApiKey;
  }

  async getMyApiKeys(): Promise<ApiKeyModel[]> {
    const result = await this.graphql<{ myApiKeys: ApiKeyModel[] }>(
      `query MyApiKeys {
        myApiKeys { ${API_KEY_FIELDS} }
      }`,
    );
    return result.myApiKeys;
  }

  async getServiceApiKeys(organizationId: string): Promise<ApiKeyModel[]> {
    const result = await this.graphql<{ serviceApiKeys: ApiKeyModel[] }>(
      `query ServiceApiKeys($organizationId: String!) {
        serviceApiKeys(organizationId: $organizationId) { ${API_KEY_FIELDS} }
      }`,
      { organizationId },
    );
    return result.serviceApiKeys;
  }

  async getApiKeyById(id: string): Promise<ApiKeyModel> {
    const result = await this.graphql<{ apiKeyById: ApiKeyModel }>(
      `query ApiKeyById($id: ID!) {
        apiKeyById(id: $id) { ${API_KEY_FIELDS} }
      }`,
      { id },
    );
    return result.apiKeyById;
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
    this._apiKeyAuth = undefined;
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

  private async graphql<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData> {
    const url = new URL('graphql', `${this._baseUrl}/`);
    if (this._apiKeyAuth?.transport === 'query') {
      url.searchParams.set(
        this._apiKeyAuth.queryParamName,
        this._apiKeyAuth.key,
      );
    }

    const config = this._client.getConfig();
    const response = await (config.fetch ?? globalThis.fetch)(url, {
      body: JSON.stringify({ query, variables }),
      credentials: config.credentials,
      headers: await this.createGraphqlHeaders(),
      method: 'POST',
      signal: config.signal,
    });

    const payload = await this.parseGraphqlResponse<TData>(response);
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join('; '));
    }
    if (payload.data === undefined) {
      throw new Error('GraphQL response did not include data.');
    }
    return payload.data;
  }

  private async createGraphqlHeaders(): Promise<Headers> {
    const config = this._client.getConfig();
    const headers = new Headers(config.headers as HeadersInit | undefined);
    headers.set('Content-Type', 'application/json');

    if (!headers.has('Authorization') && config.auth) {
      const token =
        typeof config.auth === 'function'
          ? await config.auth({ scheme: 'bearer', type: 'http' })
          : config.auth;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }

  private async parseGraphqlResponse<TData>(
    response: Response,
  ): Promise<GraphqlResponse<TData>> {
    const text = await response.text();
    let payload: unknown;

    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = text;
    }

    if (!response.ok) {
      throw new Error(this.formatHttpError(response.status, payload));
    }

    return payload as GraphqlResponse<TData>;
  }

  private formatHttpError(status: number, payload: unknown): string {
    if (typeof payload === 'object' && payload && 'message' in payload) {
      const { message } = payload;
      return Array.isArray(message)
        ? message.map((item) => this.stringifyErrorMessage(item)).join('; ')
        : this.stringifyErrorMessage(message, status);
    }
    if (typeof payload === 'string' && payload) {
      return payload;
    }
    return `HTTP ${status}`;
  }

  private stringifyErrorMessage(message: unknown, status?: number): string {
    if (message === null || message === undefined) {
      return status === undefined ? '' : `HTTP ${status}`;
    }
    if (typeof message === 'string') {
      return message;
    }
    if (typeof message === 'number' || typeof message === 'boolean') {
      return String(message);
    }
    return JSON.stringify(message) ?? '';
  }
}

const API_KEY_FIELDS = `
  id
  prefix
  type
  name
  organizationId
  projectIds
  branchNames
  tableIds
  readOnly
  allowedIps
  permissions
  expiresAt
  lastUsedAt
  createdAt
  revokedAt
`;

interface GraphqlResponse<TData> {
  data?: TData;
  errors?: Array<{ message: string }>;
}
