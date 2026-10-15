import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');

const port = Number.parseInt(process.env.NEST_PORT ?? '8080', 10);
const host = process.env.NEST_HOST ?? '127.0.0.1';
const configDir = process.env.NEST_CONFIG_DIR ?? path.join(projectRoot, 'data');
const staticDir = process.env.NEST_STATIC_DIR ?? path.join(projectRoot, 'web', 'dist');
const version = process.env.NEST_VERSION ?? process.env.npm_package_version ?? 'dev';

const authUser = process.env.NEST_AUTH_USER;
const authPassword = process.env.NEST_AUTH_PASSWORD;
if ((authUser && !authPassword) || (!authUser && authPassword)) {
  console.error('[nest] NEST_AUTH_USER and NEST_AUTH_PASSWORD must be set together.');
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[nest] invalid NEST_PORT "${process.env.NEST_PORT}"`);
  process.exit(1);
}

const app = await buildApp({
  configDir,
  staticDir,
  version,
  auth: authUser && authPassword ? { user: authUser, password: authPassword } : undefined,
});

const shutdown = async (signal: string) => {
  console.log(`[nest] received ${signal}, shutting down`);
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port, host });
  console.log(`[nest] v${version} listening on http://${host}:${port} (config: ${configDir})`);
} catch (error) {
  console.error('[nest] failed to start:', error);
  process.exit(1);
}
