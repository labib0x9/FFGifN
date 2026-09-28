import { createContainer } from '../container.js';
import { EmailWorker } from './email_worker.js';

async function startWorkers() {
  const container = createContainer();
  const cnf = container.config;
  console.log(`[Workers] Starting auth email worker in ${cnf.environment} mode...`);

  const emailWorker = new EmailWorker(container.rabbitmq, container.mailer);
  await emailWorker.run('email-worker', 10);

  console.log('[Workers] Email worker running');

  const shutdown = async () => {
    console.log('[Workers] Shutting down workers...');
    await container.dispose();
    console.log('[Workers] Workers exited cleanly');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.env.NODE_ENV !== 'test') {
  startWorkers().catch((err) => {
    console.error('[Workers] Fatal error:', err);
    process.exit(1);
  });
}

export { startWorkers };
