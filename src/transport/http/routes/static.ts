import fp from 'fastify-plugin';
import fastifyStatic from '@fastify/static';
import path from 'node:path';

// Pages that share a path with an API route, plus the Next.js export's
// "preview" shells for dynamic routes.
const PAGES: Array<[RegExp, string]> = [
  [/^\/friends\/?$/, 'friends.html'],
  [/^\/auth\/verify\/?$/, 'auth/verify.html'],
  [/^\/auth\/reset\/?$/, 'auth/reset.html'],
  [/^\/s\/?$/, 's.html'],
  [/^\/s\/[^/]+\/?$/, 's/preview.html'],
  [/^\/user\/[^/]+\/?$/, 'user/preview.html'],
];

// fp() keeps the hook and reply.sendFile global instead of scoped to this plugin.
// Register this BEFORE the API routes.
// /login -> login.html
export const staticRoutes = fp(async (app) => {
  await app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), 'public'),
    extensions: ['html'], 
  });

  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return;
    if (!(req.headers.accept ?? '').includes('text/html')) return;

    const pathname = req.url.split('?')[0];
    const page = PAGES.find(([re]) => re.test(pathname));
    if (!page) return;

    reply.header('vary', 'accept');
    return reply.sendFile(page[1]);
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error_code: 'NOT_FOUND', message: 'resource not found', status: 404 }),
  );
});