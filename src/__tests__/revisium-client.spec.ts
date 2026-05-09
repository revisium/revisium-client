import { describe, expect, it } from '@jest/globals';
import { RevisiumClient } from '../revisium-client.js';
import { OrgScope } from '../org-scope.js';
import { isValidApiKey } from '../api-keys.js';

const VALID_API_KEY = 'rev_1234567890123456789012';

const createMeResponse = () =>
  new Response(
    JSON.stringify({
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      hasPassword: true,
    }),
    { headers: { 'Content-Type': 'application/json' }, status: 200 },
  );

const createApiKeyModel = () => ({
  id: 'key-1',
  prefix: 'rev_1234...9012',
  type: 'PERSONAL' as const,
  name: 'CI/CD',
  organizationId: 'admin',
  projectIds: ['project-1'],
  branchNames: ['master'],
  tableIds: [],
  readOnly: true,
  allowedIps: [],
  permissions: null,
  expiresAt: null,
  lastUsedAt: null,
  createdAt: '2026-05-09T00:00:00.000Z',
  revokedAt: null,
});

describe('RevisiumClient', () => {
  it('creates instance with baseUrl', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    expect(client).toBeDefined();
    expect(client.baseUrl).toBe('http://localhost:8080');
  });

  it('trims trailing slash from baseUrl', () => {
    const client = new RevisiumClient({
      baseUrl: 'http://localhost:8080/',
    });
    expect(client.baseUrl).toBe('http://localhost:8080');
  });

  it('is not authenticated initially', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    expect(client.isAuthenticated()).toBe(false);
  });

  it('sets authenticated via loginWithToken', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    client.loginWithToken('test-token');
    expect(client.isAuthenticated()).toBe(true);
  });

  it('loginWithToken routes JWT to bearer scheme only', async () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    client.loginWithToken('jwt-token-123');
    const config = client.client.getConfig();
    expect(typeof config.auth).toBe('function');
    const authFn = config.auth as (auth: {
      scheme?: string;
    }) => string | undefined | Promise<string | undefined>;
    expect(await authFn({ scheme: 'bearer' })).toBe('jwt-token-123');
    expect(await authFn({ scheme: 'apiKey' })).toBeUndefined();
  });

  describe('loginWithApiKey', () => {
    it('sets authenticated after loginWithApiKey', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      client.loginWithApiKey(VALID_API_KEY);
      expect(client.isAuthenticated()).toBe(true);
    });

    it('sets X-Api-Key header in config', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      client.loginWithApiKey(VALID_API_KEY);
      const config = client.client.getConfig();
      expect((config.headers as Headers).get('X-Api-Key')).toBe(VALID_API_KEY);
    });

    it('clears auth config to avoid generated Bearer header', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      client.loginWithToken('old-jwt');
      client.loginWithApiKey(VALID_API_KEY);
      const config = client.client.getConfig();
      expect(config.auth).toBeUndefined();
      expect((config.headers as Headers).get('Authorization')).toBeNull();
    });

    it('clears API key headers when switching back to JWT auth', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      client.loginWithApiKey(VALID_API_KEY);
      client.loginWithToken('jwt-token-123');
      const config = client.client.getConfig();
      expect(typeof config.auth).toBe('function');
      expect((config.headers as Headers).get('X-Api-Key')).toBeNull();
    });

    it('can send an API key as Authorization bearer', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      client.loginWithApiKey(VALID_API_KEY, { transport: 'bearer' });
      const config = client.client.getConfig();
      expect((config.headers as Headers).get('X-Api-Key')).toBeNull();
      expect((config.headers as Headers).get('Authorization')).toBe(
        `Bearer ${VALID_API_KEY}`,
      );
    });

    it('can send an API key as query parameter', async () => {
      let requestUrl = '';
      const fetchMock: typeof fetch = (input) => {
        requestUrl = input instanceof Request ? input.url : input.toString();
        return Promise.resolve(createMeResponse());
      };

      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock,
      });
      client.loginWithApiKey(VALID_API_KEY, { transport: 'query' });

      await client.me();

      const url = new URL(requestUrl);
      expect(url.searchParams.get('api_key')).toBe(VALID_API_KEY);
      expect(
        (client.client.getConfig().headers as Headers).get('X-Api-Key'),
      ).toBeNull();
    });

    it('throws for empty query parameter name', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      expect(() =>
        client.loginWithApiKey(VALID_API_KEY, {
          queryParamName: '',
          transport: 'query',
        }),
      ).toThrow('API key query parameter name must not be empty.');
    });

    it('removes query API key auth when switching to JWT auth', async () => {
      let capturedRequest: Request | undefined;
      const fetchMock: typeof fetch = (input) => {
        capturedRequest = input instanceof Request ? input : new Request(input);
        return Promise.resolve(createMeResponse());
      };

      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock,
      });
      client.loginWithApiKey(VALID_API_KEY, { transport: 'query' });
      client.loginWithToken('jwt-token-123');

      await client.me();

      expect(capturedRequest).toBeDefined();
      const url = new URL(capturedRequest!.url);
      expect(url.searchParams.has('api_key')).toBe(false);
      expect(capturedRequest!.headers.get('Authorization')).toBe(
        'Bearer jwt-token-123',
      );
    });

    it('throws for key without rev_ prefix', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      expect(() => client.loginWithApiKey('invalid_key')).toThrow(
        'Invalid API key format: key must match /^rev_[A-Za-z0-9_-]{22}$/',
      );
      expect(client.isAuthenticated()).toBe(false);
    });

    it('throws for malformed rev_ key', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      expect(() => client.loginWithApiKey('rev_test_key_123')).toThrow(
        'Invalid API key format: key must match /^rev_[A-Za-z0-9_-]{22}$/',
      );
    });

    it('validates API key format with the exported helper', () => {
      expect(isValidApiKey(VALID_API_KEY)).toBe(true);
      expect(isValidApiKey('rev_short')).toBe(false);
    });
  });

  describe('API key management', () => {
    it('creates a personal API key over REST', async () => {
      const fetchMock = restFetch({
        body: { secret: VALID_API_KEY, apiKey: createApiKeyModel() },
        status: 201,
      });
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock.fetch,
      });
      client.loginWithToken('jwt-token-123');

      const result = await client.createPersonalApiKey({
        name: 'CI/CD',
        organizationId: 'admin',
        projectIds: ['project-1'],
        branchNames: ['master'],
        readOnly: true,
      });

      expect(result.secret).toBe(VALID_API_KEY);
      expect(result.apiKey.readOnly).toBe(true);
      expect(fetchMock.lastRequest?.method).toBe('POST');
      expect(fetchMock.lastRequest?.url).toBe(
        'http://localhost:8080/api/api-keys/personal',
      );
      expect(fetchMock.lastRequest?.headers.get('Authorization')).toBe(
        'Bearer jwt-token-123',
      );
      expect(await fetchMock.lastBody).toEqual({
        name: 'CI/CD',
        organizationId: 'admin',
        projectIds: ['project-1'],
        branchNames: ['master'],
        readOnly: true,
      });
    });

    it('serializes Date expiresAt to ISO string', async () => {
      const fetchMock = restFetch({
        body: { secret: VALID_API_KEY, apiKey: createApiKeyModel() },
        status: 201,
      });
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock.fetch,
      });
      client.loginWithToken('jwt-token-123');

      await client.createPersonalApiKey({
        name: 'CI/CD',
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      });

      expect(await fetchMock.lastBody).toEqual({
        name: 'CI/CD',
        expiresAt: '2026-12-31T00:00:00.000Z',
      });
    });

    it('creates a service API key over REST scoped by organizationId path', async () => {
      const serviceKey = {
        ...createApiKeyModel(),
        permissions: { rules: [{ action: ['read'], subject: ['Row'] }] },
        type: 'SERVICE' as const,
      };
      const fetchMock = restFetch({
        body: { secret: VALID_API_KEY, apiKey: serviceKey },
        status: 201,
      });
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock.fetch,
      });
      client.loginWithApiKey(VALID_API_KEY);

      const result = await client.createServiceApiKey({
        name: 'Endpoint worker',
        organizationId: 'admin',
        permissions: { rules: [{ action: ['read'], subject: ['Row'] }] },
      });

      expect(result.apiKey.type).toBe('SERVICE');
      expect(result.apiKey.permissions?.rules[0]?.action).toEqual(['read']);
      expect(fetchMock.lastRequest?.url).toBe(
        'http://localhost:8080/api/organization/admin/api-keys/service',
      );
      expect(fetchMock.lastRequest?.headers.get('X-Api-Key')).toBe(
        VALID_API_KEY,
      );
      expect(await fetchMock.lastBody).toEqual({
        name: 'Endpoint worker',
        permissions: { rules: [{ action: ['read'], subject: ['Row'] }] },
      });
    });

    it('appends api_key query parameter on REST calls', async () => {
      const fetchMock = restFetch({ body: [], status: 200 });
      const client = new RevisiumClient({
        baseUrl: 'https://example.com/revisium',
        fetch: fetchMock.fetch,
      });
      client.loginWithApiKey(VALID_API_KEY, { transport: 'query' });

      await client.getMyApiKeys();

      expect(fetchMock.lastRequest?.url).toBe(
        `https://example.com/revisium/api/api-keys/personal?api_key=${VALID_API_KEY}`,
      );
    });

    it('lists, reads, revokes, and rotates API keys over REST', async () => {
      const key = createApiKeyModel();
      const fetchMock = restFetchQueue([
        { body: [key], status: 200 },
        { body: [{ ...key, type: 'SERVICE' as const }], status: 200 },
        { body: key, status: 200 },
        {
          body: { ...key, revokedAt: '2026-05-09T01:00:00.000Z' },
          status: 200,
        },
        { body: { secret: VALID_API_KEY, apiKey: key }, status: 201 },
      ]);
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock.fetch,
      });
      client.loginWithToken('jwt-token-123');

      await expect(client.getMyApiKeys()).resolves.toHaveLength(1);
      expect(fetchMock.requests[0]?.method).toBe('GET');
      expect(fetchMock.requests[0]?.url).toBe(
        'http://localhost:8080/api/api-keys/personal',
      );

      await expect(client.getServiceApiKeys('admin')).resolves.toHaveLength(1);
      expect(fetchMock.requests[1]?.url).toBe(
        'http://localhost:8080/api/organization/admin/api-keys/service',
      );

      await expect(client.getApiKeyById('key-1')).resolves.toEqual(key);
      expect(fetchMock.requests[2]?.url).toBe(
        'http://localhost:8080/api/api-keys/key-1',
      );

      await expect(client.revokeApiKey('key-1')).resolves.toMatchObject({
        revokedAt: '2026-05-09T01:00:00.000Z',
      });
      expect(fetchMock.requests[3]?.method).toBe('POST');
      expect(fetchMock.requests[3]?.url).toBe(
        'http://localhost:8080/api/api-keys/key-1/revoke',
      );

      await expect(client.rotateApiKey('key-1')).resolves.toMatchObject({
        secret: VALID_API_KEY,
      });
      expect(fetchMock.requests[4]?.method).toBe('POST');
      expect(fetchMock.requests[4]?.url).toBe(
        'http://localhost:8080/api/api-keys/key-1/rotate',
      );
    });

    it('throws on REST error responses', async () => {
      const fetchMock: typeof fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Permission denied' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 403,
          }),
        );
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock,
      });

      await expect(client.getMyApiKeys()).rejects.toThrow('Permission denied');
    });
  });

  it('exposes underlying client', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    expect(client.client).toBeDefined();
  });

  it('returns OrgScope from org()', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    const orgScope = client.org('my-org');
    expect(orgScope).toBeInstanceOf(OrgScope);
    expect(orgScope.organizationId).toBe('my-org');
  });
});

interface RestResponse {
  body: unknown;
  status: number;
}

function restFetch(response: RestResponse) {
  let lastRequest: Request | undefined;
  let lastBodyPromise: Promise<unknown> | undefined;

  const fetchMock: typeof fetch = (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    lastRequest = request;
    lastBodyPromise = readJsonBody(request, init);
    return Promise.resolve(
      new Response(JSON.stringify(response.body), {
        headers: { 'Content-Type': 'application/json' },
        status: response.status,
      }),
    );
  };

  return {
    fetch: fetchMock,
    get lastRequest() {
      return lastRequest;
    },
    get lastBody() {
      return lastBodyPromise;
    },
  };
}

async function readJsonBody(
  request: Request,
  init: RequestInit | undefined,
): Promise<unknown> {
  if (typeof init?.body === 'string' && init.body) {
    return JSON.parse(init.body);
  }
  const text = await request.clone().text();
  return text ? JSON.parse(text) : undefined;
}

function restFetchQueue(responses: RestResponse[]) {
  const requests: Request[] = [];
  let index = 0;
  const fetchMock: typeof fetch = (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request);
    const next = responses[index];
    index += 1;
    if (!next) {
      throw new Error('Unexpected fetch call');
    }
    return Promise.resolve(
      new Response(JSON.stringify(next.body), {
        headers: { 'Content-Type': 'application/json' },
        status: next.status,
      }),
    );
  };

  return { fetch: fetchMock, requests };
}
