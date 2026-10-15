import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { tempDir } from './helpers.ts';

let dir: string;
let cleanup: () => Promise<void>;
let staticDir: string;

beforeEach(async () => {
  ({ dir, cleanup } = await tempDir());
  staticDir = path.join(dir, 'web');
  await mkdir(path.join(staticDir, 'assets'), { recursive: true });
  await writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>NEST</title>');
  await writeFile(path.join(staticDir, 'assets', 'app.js'), 'console.log(1)');
  await writeFile(path.join(dir, 'secret.txt'), 'top secret');
});
afterEach(async () => {
  await cleanup();
});

describe('static file serving', () => {
  it('serves the UI and hashed assets with proper caching', async () => {
    const app = await buildApp({ configDir: path.join(dir, 'config'), staticDir });
    const index = await app.inject({ method: 'GET', url: '/' });
    expect(index.statusCode).toBe(200);
    expect(index.headers['content-type']).toContain('text/html');
    expect(index.headers['cache-control']).toBe('no-cache');
    expect(index.body).toContain('NEST');

    const asset = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['content-type']).toContain('text/javascript');
    expect(asset.headers['cache-control']).toContain('immutable');

    const deepLink = await app.inject({ method: 'GET', url: '/settings' });
    expect(deepLink.statusCode).toBe(200);
    expect(deepLink.body).toContain('NEST');

    const missing = await app.inject({ method: 'GET', url: '/assets/missing.js' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('never serves files outside the web directory', async () => {
    const app = await buildApp({ configDir: path.join(dir, 'config'), staticDir });
    for (const url of ['/../secret.txt', '/assets/../../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(404);
      expect(res.body, url).not.toContain('top secret');
    }
    await app.close();
  });
});
