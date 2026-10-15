import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDefaultConfig, type NestConfig } from '@nest/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { tempDir } from './helpers.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await tempDir());
});
afterEach(async () => {
  await cleanup();
});

const configPath = () => path.join(dir, 'config.json');

describe('configuration initialisation', () => {
  it('creates a default configuration on first start', async () => {
    const app = await buildApp({ configDir: dir });
    const onDisk = JSON.parse(await readFile(configPath(), 'utf8'));
    expect(onDisk).toEqual(createDefaultConfig());

    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(createDefaultConfig());
    await app.close();
  });

  it('reports a health status without touching services', async () => {
    const app = await buildApp({ configDir: dir, version: '1.2.3' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', version: '1.2.3', config: 'ok' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    await app.close();
  });

  it('exposes the defaults for resetting', async () => {
    const app = await buildApp({ configDir: dir });
    const res = await app.inject({ method: 'GET', url: '/api/config/defaults' });
    expect(res.json()).toEqual(createDefaultConfig());
    await app.close();
  });
});

describe('invalid configuration on disk', () => {
  it('does not overwrite invalid JSON and reports the problem', async () => {
    await writeFile(configPath(), '{ not json', 'utf8');
    const app = await buildApp({ configDir: dir });
    expect(await readFile(configPath(), 'utf8')).toBe('{ not json');

    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('invalid_config');
    expect(res.json().message).toContain('not valid JSON');

    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.json().config).toBe('invalid');
    await app.close();
  });

  it('reports schema violations in an existing file', async () => {
    const broken = { ...createDefaultConfig(), dashboard: { title: 'x' } };
    await writeFile(configPath(), JSON.stringify(broken), 'utf8');
    const app = await buildApp({ configDir: dir });
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(500);
    expect(res.json().message).toContain('dashboard');
    await app.close();
  });

  it('moves the invalid file aside when a new configuration is saved', async () => {
    await writeFile(configPath(), '{ not json', 'utf8');
    const app = await buildApp({ configDir: dir });
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: createDefaultConfig() });
    expect(res.statusCode).toBe(200);

    const files = await readdir(dir);
    expect(files).toContain('config.json');
    const preserved = files.find((f) => f.startsWith('config.json.invalid-'));
    expect(preserved).toBeDefined();
    expect(await readFile(path.join(dir, preserved!), 'utf8')).toBe('{ not json');
    await app.close();
  });
});

describe('saving configuration', () => {
  it('persists valid changes and survives a restart', async () => {
    const app = await buildApp({ configDir: dir });
    const config = createDefaultConfig();
    config.dashboard.title = 'Lab';
    config.groups.push({ id: 'media', name: 'Media' });
    config.services = [
      ...config.services.filter((s) => s.id !== 'pi-hole'),
      {
        id: 'jellyfin',
        name: 'Jellyfin',
        url: 'https://media.local',
        description: '',
        icon: 'Play',
        iconUrl: '',
        groupId: 'media',
        enabled: false,
        openInNewTab: true,
      },
    ];
    config.services[0]!.name = 'HA';

    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: config });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(config);
    await app.close();

    const restarted = await buildApp({ configDir: dir });
    const reloaded = await restarted.inject({ method: 'GET', url: '/api/config' });
    expect(reloaded.json()).toEqual(config);
    await restarted.close();

    const files = await readdir(dir);
    expect(files).toContain('config.json.bak');
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('rejects malformed JSON bodies', async () => {
    const app = await buildApp({ configDir: dir });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { 'content-type': 'application/json' },
      payload: '{"version": 1,',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('valid JSON');
    await app.close();
  });

  it('rejects oversized bodies', async () => {
    const app = await buildApp({ configDir: dir });
    const config = createDefaultConfig() as NestConfig & { padding?: string };
    config.padding = 'x'.repeat(300 * 1024);
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: config });
    expect(res.statusCode).toBe(413);
    await app.close();
  });

  it.each([
    ['unknown top-level key', { ...createDefaultConfig(), extra: true }, 'extra'],
    ['missing dashboard title', (() => { const c = createDefaultConfig(); c.dashboard.title = ''; return c; })(), 'title'],
    ['javascript: URL', (() => { const c = createDefaultConfig(); c.services[0]!.url = 'javascript:alert(1)'; return c; })(), 'url'],
    ['relative URL', (() => { const c = createDefaultConfig(); c.services[0]!.url = '/admin'; return c; })(), 'url'],
    ['bad accent color', (() => { const c = createDefaultConfig(); c.dashboard.accentColor = 'lime'; return c; })(), 'accentColor'],
    ['unknown icon', (() => { const c = createDefaultConfig(); (c.services[0] as { icon: string }).icon = 'Nope'; return c; })(), 'icon'],
    ['unknown group reference', (() => { const c = createDefaultConfig(); c.services[0]!.groupId = 'missing'; return c; })(), 'unknown group'],
    ['duplicate service id', (() => { const c = createDefaultConfig(); c.services[1]!.id = c.services[0]!.id; return c; })(), 'duplicate service id'],
    ['duplicate group id', (() => { const c = createDefaultConfig(); c.groups[1]!.id = c.groups[0]!.id; return c; })(), 'duplicate group id'],
    ['wrong version', { ...createDefaultConfig(), version: 2 }, 'version'],
    ['non-object body', [1, 2, 3], 'config'],
    ['ftp icon URL', (() => { const c = createDefaultConfig(); c.services[0]!.iconUrl = 'ftp://x/y.png'; return c; })(), 'iconUrl'],
  ])('rejects %s', async (_label, payload, expectedFragment) => {
    const app = await buildApp({ configDir: dir });
    const before = await readFile(configPath(), 'utf8');
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_config');
    expect(res.json().message).toContain(expectedFragment);
    expect(await readFile(configPath(), 'utf8')).toBe(before);
    await app.close();
  });

  it('rejects cross-site write attempts', async () => {
    const app = await buildApp({ configDir: dir });
    const byOrigin = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { origin: 'http://evil.example', host: 'nest.local:8080' },
      payload: createDefaultConfig(),
    });
    expect(byOrigin.statusCode).toBe(403);

    const byFetchSite = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { 'sec-fetch-site': 'cross-site' },
      payload: createDefaultConfig(),
    });
    expect(byFetchSite.statusCode).toBe(403);

    const sameOrigin = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { origin: 'http://nest.local:8080', host: 'nest.local:8080', 'sec-fetch-site': 'same-origin' },
      payload: createDefaultConfig(),
    });
    expect(sameOrigin.statusCode).toBe(200);
    await app.close();
  });

  it('returns 404 for unknown API routes', async () => {
    const app = await buildApp({ configDir: dir });
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found', message: 'Not found.' });
    await app.close();
  });
});

describe('basic authentication', () => {
  it('requires credentials when configured', async () => {
    const app = await buildApp({ configDir: dir, auth: { user: 'pi', password: 'secret' } });
    const anonymous = await app.inject({ method: 'GET', url: '/api/config' });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.headers['www-authenticate']).toContain('Basic');

    const wrong = await app.inject({
      method: 'GET',
      url: '/api/config',
      headers: { authorization: `Basic ${Buffer.from('pi:nope').toString('base64')}` },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await app.inject({
      method: 'GET',
      url: '/api/config',
      headers: { authorization: `Basic ${Buffer.from('pi:secret').toString('base64')}` },
    });
    expect(ok.statusCode).toBe(200);
    await app.close();
  });
});
