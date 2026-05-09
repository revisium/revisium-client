import type {
  ApiKeyModel as GeneratedApiKeyModel,
  ApiKeyType as GeneratedApiKeyType,
  CaslPermissionsDto,
  CaslRuleDto,
  CreatePersonalApiKeyDto,
  CreateServiceApiKeyDto,
} from './generated/types.gen.js';

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

export type ApiKeyType = GeneratedApiKeyType;
export type CaslRule = CaslRuleDto;
export type CaslPermissions = CaslPermissionsDto;

/**
 * API-key model returned by the REST API.
 *
 * Mirrors the generated `ApiKeyModel` but narrows `permissions` from a loose
 * `{ [key: string]: unknown }` to the structured `CaslPermissions` shape that
 * core actually emits. The OpenAPI spec types it as a free-form object because
 * the column is JSON, but the runtime value always conforms to `CaslPermissions`.
 */
export type ApiKeyModel = Omit<GeneratedApiKeyModel, 'permissions'> & {
  permissions: CaslPermissions | null;
};

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

export interface CreateServiceApiKeyInput extends BaseApiKeyScopeInput {
  name: string;
  organizationId: string;
  permissions: CaslPermissions;
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

export function toCreatePersonalApiKeyDto(
  input: CreatePersonalApiKeyInput,
): CreatePersonalApiKeyDto {
  const dto: CreatePersonalApiKeyDto = { name: input.name };
  applyScope(dto, input);
  if (input.organizationId !== undefined) {
    dto.organizationId = input.organizationId;
  }
  return dto;
}

export function toCreateServiceApiKeyDto(
  input: Omit<CreateServiceApiKeyInput, 'organizationId'>,
): CreateServiceApiKeyDto {
  const dto: CreateServiceApiKeyDto = {
    name: input.name,
    permissions: input.permissions,
  };
  applyScope(dto, input);
  return dto;
}

function applyScope(
  dto: CreatePersonalApiKeyDto | CreateServiceApiKeyDto,
  input: BaseApiKeyScopeInput,
): void {
  if (input.projectIds !== undefined) dto.projectIds = input.projectIds;
  if (input.branchNames !== undefined) dto.branchNames = input.branchNames;
  if (input.tableIds !== undefined) dto.tableIds = input.tableIds;
  if (input.readOnly !== undefined) dto.readOnly = input.readOnly;
  if (input.allowedIps !== undefined) dto.allowedIps = input.allowedIps;
  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    dto.expiresAt =
      input.expiresAt instanceof Date
        ? input.expiresAt.toISOString()
        : input.expiresAt;
  }
}
