import { describe, expect, it } from '@jest/globals';
import { RevisiumClient } from '../revisium-client.js';
import { OrgScope } from '../org-scope.js';

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
      client.loginWithApiKey('rev_test_key_123');
      expect(client.isAuthenticated()).toBe(true);
    });

    it('sets X-Api-Key header in config', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      client.loginWithApiKey('rev_test_key_123');
      const config = client.client.getConfig();
      expect((config.headers as Headers).get('X-Api-Key')).toBe(
        'rev_test_key_123',
      );
    });

    it('clears auth config to avoid Bearer header', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      client.loginWithToken('old-jwt');
      client.loginWithApiKey('rev_test_key_123');
      const config = client.client.getConfig();
      expect(config.auth).toBeUndefined();
    });

    it('throws for key without rev_ prefix', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      expect(() => client.loginWithApiKey('invalid_key')).toThrow(
        'Invalid API key format: key must start with "rev_" prefix',
      );
      expect(client.isAuthenticated()).toBe(false);
    });

    it('throws for empty string', () => {
      const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
      expect(() => client.loginWithApiKey('')).toThrow(
        'Invalid API key format: key must start with "rev_" prefix',
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
