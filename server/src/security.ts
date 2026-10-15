import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface BasicAuthOptions {
  user: string;
  password: string;
}

/**
 * Applies conservative security headers to every response. A strict CSP is
 * possible because the UI loads no third-party scripts, styles or fonts.
 * Images may come from anywhere so custom service icons and background
 * images work.
 */
export function securityHeaders(_request: FastifyRequest, reply: FastifyReply): void {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'SAMEORIGIN');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  reply.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' http: https: data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  );
}

/**
 * Rejects state-changing requests that originate from another site.
 * Browsers attach `Origin` and `Sec-Fetch-Site` to cross-site requests; a
 * same-origin page (the NEST UI) or a non-browser client (curl) passes.
 */
export function rejectCrossSite(request: FastifyRequest, reply: FastifyReply): FastifyReply | undefined {
  const fetchSite = request.headers['sec-fetch-site'];
  if (typeof fetchSite === 'string' && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return reply.code(403).send({ error: 'forbidden', message: 'Cross-site requests are not allowed.' });
  }

  const origin = request.headers.origin;
  if (typeof origin === 'string' && origin !== 'null') {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return reply.code(403).send({ error: 'forbidden', message: 'Invalid Origin header.' });
    }
    if (originHost !== request.headers.host) {
      return reply.code(403).send({ error: 'forbidden', message: 'Cross-site requests are not allowed.' });
    }
  } else if (origin === 'null') {
    return reply.code(403).send({ error: 'forbidden', message: 'Cross-site requests are not allowed.' });
  }
  return undefined;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Compare against itself to keep timing independent of the input, then fail.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Optional HTTP Basic authentication, enabled with NEST_AUTH_USER/PASSWORD. */
export function basicAuth(options: BasicAuthOptions) {
  return (request: FastifyRequest, reply: FastifyReply): FastifyReply | undefined => {
    const header = request.headers.authorization ?? '';
    const [scheme, encoded] = header.split(' ');
    if (scheme?.toLowerCase() === 'basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator > 0) {
        const user = decoded.slice(0, separator);
        const password = decoded.slice(separator + 1);
        const userOk = safeEqual(user, options.user);
        const passwordOk = safeEqual(password, options.password);
        if (userOk && passwordOk) return undefined;
      }
    }
    reply.header('WWW-Authenticate', 'Basic realm="NEST", charset="UTF-8"');
    return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required.' });
  };
}
