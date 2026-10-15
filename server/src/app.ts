import Fastify, { type FastifyInstance } from 'fastify';
import { createDefaultConfig } from '@nest/shared';
import { ConfigStore } from './config/store.ts';
import { basicAuth, rejectCrossSite, securityHeaders, type BasicAuthOptions } from './security.ts';
import { registerStatic } from './static.ts';

export interface AppOptions {
  configDir: string;
  /** Directory with the built web UI. Omit to serve the API only. */
  staticDir?: string;
  auth?: BasicAuthOptions;
  version?: string;
}

const BODY_LIMIT = 256 * 1024; // 256 KiB is far above any realistic dashboard config.

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const store = new ConfigStore(options.configDir);
  const startupState = await store.load();

  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT, trustProxy: false });
  app.decorate('configStore', store);

  app.addHook('onRequest', async (request, reply) => {
    securityHeaders(request, reply);
  });
  if (options.auth) {
    const check = basicAuth(options.auth);
    app.addHook('onRequest', async (request, reply) => check(request, reply));
  }

  app.setErrorHandler((rawError, _request, reply) => {
    const error = rawError as { statusCode?: number; code?: string; message?: string };
    const status = typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) console.error('[nest] request failed:', rawError);
    const message =
      status === 400 && error.code?.startsWith('FST_ERR_CTP')
        ? 'Request body must be valid JSON.'
        : status >= 500
          ? 'Internal server error.'
          : (error.message ?? 'Request failed.');
    reply.code(status).send({ error: error.code ?? 'error', message });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'not_found', message: 'Not found.' });
  });

  app.get('/api/health', async () => {
    const state = store.getState();
    return {
      status: 'ok',
      version: options.version ?? 'dev',
      config: state.status,
      uptime: Math.round(process.uptime()),
    };
  });

  app.get('/api/config', async (_request, reply) => {
    const state = store.getState();
    if (state.status === 'invalid') {
      return reply.code(500).send({ error: 'invalid_config', message: state.message });
    }
    reply.header('Cache-Control', 'no-store');
    return state.config;
  });

  app.put('/api/config', async (request, reply) => {
    if (rejectCrossSite(request, reply)) return reply;
    try {
      const saved = await store.save(request.body);
      reply.header('Cache-Control', 'no-store');
      return saved;
    } catch (error) {
      if ((error as { code?: string }).code === 'INVALID_CONFIG') {
        return reply.code(400).send({ error: 'invalid_config', message: (error as Error).message });
      }
      console.error('[nest] failed to save configuration:', error);
      return reply.code(500).send({ error: 'save_failed', message: 'Configuration could not be written to disk.' });
    }
  });

  app.get('/api/config/defaults', async () => createDefaultConfig());

  if (options.staticDir) registerStatic(app, options.staticDir);

  if (startupState.status === 'invalid') {
    console.error(`[nest] ${startupState.message}`);
    console.error('[nest] The file was left untouched. Fix it, or save a new configuration from the dashboard.');
  } else if (startupState.created) {
    console.log(`[nest] created default configuration at ${store.filePath}`);
  }

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    configStore: ConfigStore;
  }
}
