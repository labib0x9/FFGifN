import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';

const port = Number(process.env.PORT);
const host = String(process.env.ADDR);

const app = Fastify({logger: true});
// app.get('/', async () => ({ok: true}) );

await app.register(fastifyStatic, {
  root: path.join(import.meta.dirname, '..', 'public'),
  prefix: '/',
  extensions: ['html'],
});

app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api')) {
    return reply.code(404).send({ error: 'not found' });
  }
  return reply.code(404).type('text/html').sendFile('404.html');
});

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}