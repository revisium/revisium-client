import { describe, expect, it } from '@jest/globals';
import { RevisiumClient } from '../revisium-client.js';

describe('RevisiumClient', () => {
  it('should create instance with baseUrl', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    expect(client).toBeDefined();
    expect(client.baseUrl).toBe('http://localhost:8080');
  });

  it('should trim trailing slash from baseUrl', () => {
    const client = new RevisiumClient({
      baseUrl: 'http://localhost:8080/',
    });
    expect(client.baseUrl).toBe('http://localhost:8080');
  });

  it('should not be authenticated initially', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    expect(client.isAuthenticated()).toBe(false);
  });

  it('should have null context initially', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    expect(client.organizationId).toBeNull();
    expect(client.projectName).toBeNull();
    expect(client.branchName).toBeNull();
    expect(client.revisionId).toBeNull();
    expect(client.isDraft).toBe(false);
  });

  it('should set authenticated via loginWithToken', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    client.loginWithToken('test-token');
    expect(client.isAuthenticated()).toBe(true);
  });

  it('should expose underlying client', () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    expect(client.client).toBeDefined();
  });

  it('should throw on getTables without context', async () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    await expect(client.getTables()).rejects.toThrow(
      'Context not set. Call setContext() first.',
    );
  });

  it('should throw on createTable without context', async () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    await expect(client.createTable('test', {})).rejects.toThrow(
      'Context not set. Call setContext() first.',
    );
  });

  it('should throw on commit without context', async () => {
    const client = new RevisiumClient({ baseUrl: 'http://localhost:8080' });
    await expect(client.commit()).rejects.toThrow(
      'Context not set. Call setContext() first.',
    );
  });
});
