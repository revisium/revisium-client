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
