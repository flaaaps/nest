import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

/**
 * Serves the built web UI from a directory. Paths are resolved strictly
 * inside `rootDir`; anything else is a 404. Unknown extension-less paths fall
 * back to index.html so deep links still load the single-page app.
 */
export function registerStatic(app: FastifyInstance, rootDir: string): void {
  const root = path.resolve(rootDir);

  app.get('/*', async (request, reply) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      return reply.code(400).send({ error: 'bad_request', message: 'Malformed path.' });
    }
    if (pathname.includes('\0')) return reply.code(404).send({ error: 'not_found', message: 'Not found.' });

    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let absolute = path.resolve(root, relative);
    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
      return reply.code(404).send({ error: 'not_found', message: 'Not found.' });
    }

    let fileStat = await statOrNull(absolute);
    if (!fileStat || !fileStat.isFile()) {
      if (path.extname(relative) === '') {
        absolute = path.join(root, 'index.html');
        fileStat = await statOrNull(absolute);
      }
      if (!fileStat || !fileStat.isFile()) {
        return reply.code(404).send({ error: 'not_found', message: 'Not found.' });
      }
    }

    const ext = path.extname(absolute).toLowerCase();
    reply.type(MIME_TYPES[ext] ?? 'application/octet-stream');
    reply.header('Content-Length', fileStat.size);
    if (relative.startsWith('assets/')) {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      reply.header('Cache-Control', 'no-cache');
    }
    return reply.send(createReadStream(absolute));
  });
}

async function statOrNull(file: string) {
  try {
    return await stat(file);
  } catch {
    return null;
  }
}
