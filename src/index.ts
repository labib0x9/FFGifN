import { createContainer } from './container.js';
import { newServer } from './transport/http/server.js';

const container = createContainer();
const cfg = container.config;
const srv = newServer(container);

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[HTTP] Received ${signal}, initiating graceful shutdown...`);

  try {
    await srv.close();
    console.log('[HTTP] Fastify server closed');
    await container.dispose();
    console.log('[HTTP] Infrastructure connections closed cleanly');
    process.exit(0);
  } catch (err) {
    console.error('[HTTP] Error during graceful shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  const address = await srv.listen({
    port: cfg.port,
    host: cfg.addr,
  });
  console.log(`[HTTP] Server listening at ${address}`);
} catch (err) {
  srv.log.error(err);
  process.exit(1);
}