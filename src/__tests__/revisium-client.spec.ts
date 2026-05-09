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

  it('loginWithToken sets auth config for Bearer header', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    client.loginWithToken('jwt-token-123');
    const config = client.client.getConfig();
    expect(config.auth).toBe('jwt-token-123');
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
      expect(config.auth).toBe('jwt-token-123');
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
    it('creates a personal API key over GraphQL', async () => {
      const fetchMock = graphqlFetch({
        createPersonalApiKey: {
          secret: VALID_API_KEY,
          apiKey: createApiKeyModel(),
        },
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
      expect(fetchMock.lastRequest?.headers.get('Authorization')).toBe(
        'Bearer jwt-token-123',
      );
      expect(fetchMock.lastBody?.query).toContain('createPersonalApiKey');
      expect(fetchMock.lastBody?.variables).toEqual({
        data: {
          name: 'CI/CD',
          organizationId: 'admin',
          projectIds: ['project-1'],
          branchNames: ['master'],
          readOnly: true,
        },
      });
    });

    it('creates a service API key over GraphQL', async () => {
      const serviceKey = {
        ...createApiKeyModel(),
        permissions: {
          rules: [{ action: ['read'], subject: ['Row'] }],
        },
        type: 'SERVICE' as const,
      };
      const fetchMock = graphqlFetch({
        createServiceApiKey: {
          secret: VALID_API_KEY,
          apiKey: serviceKey,
        },
      });
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock.fetch,
      });
      client.loginWithApiKey(VALID_API_KEY);

      const result = await client.createServiceApiKey({
        name: 'Endpoint worker',
        organizationId: 'admin',
        permissions: {
          rules: [{ action: ['read'], subject: ['Row'] }],
        },
      });

      expect(result.apiKey.type).toBe('SERVICE');
      expect(result.apiKey.permissions?.rules[0]?.action).toEqual(['read']);
      expect(fetchMock.lastRequest?.headers.get('X-Api-Key')).toBe(
        VALID_API_KEY,
      );
      expect(fetchMock.lastBody?.query).toContain('createServiceApiKey');
    });

    it('preserves a path prefix in GraphQL URLs', async () => {
      const fetchMock = graphqlFetch({ myApiKeys: [] });
      const client = new RevisiumClient({
        baseUrl: 'https://example.com/revisium',
        fetch: fetchMock.fetch,
      });
      client.loginWithApiKey(VALID_API_KEY, { transport: 'query' });

      await client.getMyApiKeys();

      expect(fetchMock.lastRequest?.url).toBe(
        `https://example.com/revisium/graphql?api_key=${VALID_API_KEY}`,
      );
    });

    it('preserves custom Headers config for GraphQL requests', async () => {
      const fetchMock = graphqlFetch({ myApiKeys: [] });
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock.fetch,
      });
      client.loginWithToken('jwt-token-123');
      client.client.setConfig({
        headers: new Headers([['X-Trace-Id', 'trace-1']]),
      });

      await client.getMyApiKeys();

      expect(fetchMock.lastRequest?.headers.get('Authorization')).toBe(
        'Bearer jwt-token-123',
      );
      expect(fetchMock.lastRequest?.headers.get('X-Trace-Id')).toBe('trace-1');
    });

    it('uses an auth callback for GraphQL bearer headers', async () => {
      const fetchMock = graphqlFetch({ myApiKeys: [] });
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock.fetch,
      });
      client.client.setConfig({
        auth: () => 'callback-token',
      });

      await client.getMyApiKeys();

      expect(fetchMock.lastRequest?.headers.get('Authorization')).toBe(
        'Bearer callback-token',
      );
    });

    it('lists, reads, revokes, and rotates API keys over GraphQL', async () => {
      const key = createApiKeyModel();
      const fetchMock = graphqlFetchQueue([
        { myApiKeys: [key] },
        { serviceApiKeys: [{ ...key, type: 'SERVICE' as const }] },
        { apiKeyById: key },
        { revokeApiKey: { ...key, revokedAt: '2026-05-09T01:00:00.000Z' } },
        { rotateApiKey: { secret: VALID_API_KEY, apiKey: key } },
      ]);
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock.fetch,
      });
      client.loginWithToken('jwt-token-123');

      await expect(client.getMyApiKeys()).resolves.toHaveLength(1);
      await expect(client.getServiceApiKeys('admin')).resolves.toHaveLength(1);
      await expect(client.getApiKeyById('key-1')).resolves.toEqual(key);
      await expect(client.revokeApiKey('key-1')).resolves.toMatchObject({
        revokedAt: '2026-05-09T01:00:00.000Z',
      });
      await expect(client.rotateApiKey('key-1')).resolves.toMatchObject({
        secret: VALID_API_KEY,
      });
    });

    it('throws GraphQL errors', async () => {
      const fetchMock: typeof fetch = () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ errors: [{ message: 'Permission denied' }] }),
            { headers: { 'Content-Type': 'application/json' }, status: 200 },
          ),
        );
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock,
      });

      await expect(client.getMyApiKeys()).rejects.toThrow('Permission denied');
    });

    it('throws when GraphQL data is missing', async () => {
      const fetchMock: typeof fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }),
        );
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock,
      });

      await expect(client.getMyApiKeys()).rejects.toThrow(
        'GraphQL response did not include data.',
      );
    });

    it('throws non-OK GraphQL HTTP errors', async () => {
      const fetchMock: typeof fetch = () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              message: ['Forbidden', 'Missing manage-api-key'],
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 403 },
          ),
        );
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock,
      });

      await expect(client.getServiceApiKeys('admin')).rejects.toThrow(
        'Forbidden; Missing manage-api-key',
      );
    });

    it('throws plain-text non-OK GraphQL HTTP errors', async () => {
      const fetchMock: typeof fetch = () =>
        Promise.resolve(new Response('upstream unavailable', { status: 503 }));
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock,
      });

      await expect(client.getMyApiKeys()).rejects.toThrow(
        'upstream unavailable',
      );
    });

    it('falls back to HTTP status for empty non-OK GraphQL responses', async () => {
      const fetchMock: typeof fetch = () =>
        Promise.resolve(new Response('', { status: 502 }));
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock,
      });

      await expect(client.getMyApiKeys()).rejects.toThrow('HTTP 502');
    });

    it('formats scalar and object GraphQL HTTP error messages', async () => {
      const responses = [
        new Response(JSON.stringify({ message: null }), { status: 401 }),
        new Response(JSON.stringify({ message: false }), { status: 400 }),
        new Response(JSON.stringify({ message: { code: 'BAD_REQUEST' } }), {
          status: 400,
        }),
      ];
      let index = 0;
      const fetchMock: typeof fetch = () => {
        const next = responses[index];
        if (!next) {
          throw new Error('Unexpected fetch call');
        }
        index += 1;
        return Promise.resolve(next);
      };
      const client = new RevisiumClient({
        baseUrl: 'http://localhost:8080',
        fetch: fetchMock,
      });

      await expect(client.getMyApiKeys()).rejects.toThrow('HTTP 401');
      await expect(client.getMyApiKeys()).rejects.toThrow('false');
      await expect(client.getMyApiKeys()).rejects.toThrow(
        '{"code":"BAD_REQUEST"}',
      );
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

function graphqlFetch(data: unknown) {
  let lastRequest: Request | undefined;
  let lastBody:
    | { query?: string; variables?: Record<string, unknown> }
    | undefined;

  const fetchMock: typeof fetch = (input, init) => {
    lastRequest = new Request(input, init);
    lastBody = JSON.parse(getStringBody(init?.body)) as {
      query?: string;
      variables?: Record<string, unknown>;
    };
    return Promise.resolve(
      new Response(JSON.stringify({ data }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
  };

  return {
    fetch: fetchMock,
    get lastBody() {
      return lastBody;
    },
    get lastRequest() {
      return lastRequest;
    },
  };
}

function graphqlFetchQueue(data: unknown[]) {
  let index = 0;
  const fetchMock: typeof fetch = () => {
    const next = data[index];
    index += 1;
    return Promise.resolve(
      new Response(JSON.stringify({ data: next }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
  };

  return { fetch: fetchMock };
}

function getStringBody(body: BodyInit | null | undefined): string {
  if (typeof body !== 'string') {
    throw new Error('Expected string request body');
  }
  return body;
}
