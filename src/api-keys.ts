export const API_KEY_PATTERN = /^rev_[A-Za-z0-9_-]{22}$/;

export type ApiKeyTransport = 'header' | 'bearer' | 'query';

export interface ApiKeyAuthOptions {
  /**
   * `header` sends `X-Api-Key`, `bearer` sends `Authorization: Bearer rev_...`,
   * and `query` appends `api_key=rev_...`.
   */
  transport?: ApiKeyTransport;
  queryParamName?: string;
}

export type ApiKeyType = 'PERSONAL' | 'SERVICE' | 'INTERNAL';

export interface ApiKeyModel {
  id: string;
  prefix: string;
  type: ApiKeyType;
  name: string;
  organizationId?: string | null;
  projectIds: string[];
  branchNames: string[];
  tableIds: string[];
  readOnly: boolean;
  allowedIps: string[];
  permissions?: CaslPermissions | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  revokedAt?: string | null;
}

export interface ApiKeyWithSecret {
  apiKey: ApiKeyModel;
  secret: string;
}

export interface BaseApiKeyScopeInput {
  projectIds?: string[];
  branchNames?: string[];
  tableIds?: string[];
  readOnly?: boolean;
  allowedIps?: string[];
  expiresAt?: Date | string | null;
}

export interface CreatePersonalApiKeyInput extends BaseApiKeyScopeInput {
  name: string;
  organizationId?: string;
}

export interface CaslRule {
  action: string[];
  subject: string[];
  conditions?: Record<string, unknown>;
  fields?: string[];
  inverted?: boolean;
}

export interface CaslPermissions {
  rules: CaslRule[];
}

export type CaslRuleInput = CaslRule;
export type CaslPermissionsInput = CaslPermissions;

export interface CreateServiceApiKeyInput extends BaseApiKeyScopeInput {
  name: string;
  organizationId: string;
  permissions: CaslPermissionsInput;
}

export function isValidApiKey(key: string): boolean {
  return API_KEY_PATTERN.test(key);
}

export function assertValidApiKey(key: string): void {
  if (!isValidApiKey(key)) {
    throw new Error(
      'Invalid API key format: key must match /^rev_[A-Za-z0-9_-]{22}$/',
    );
  }
}

export function appendApiKeyQueryParam(
  request: Request,
  paramName: string,
  key: string,
): Request {
  const url = new URL(request.url);
  url.searchParams.set(paramName, key);
  return new Request(url, request);
}
