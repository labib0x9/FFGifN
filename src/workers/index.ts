import { getConfig } from '../config/env.js';
import { getRabbitMQClient } from '../infra/rabbitmq/client.js';
import { SmtpMailer } from '../infra/mailer/smtp.js';
import { EmailWorker } from './email_worker.js';

async function startWorkers() {
  const cnf = getConfig();
  console.log(`[Workers] Starting auth email worker in ${cnf.environment} mode...`);

  const rabbitmq = getRabbitMQClient();
  const mailer = new SmtpMailer();

  const emailWorker = new EmailWorker(rabbitmq, mailer);
  await emailWorker.run('email-worker', 10);

  console.log('[Workers] Email worker running');

  const shutdown = async () => {
    console.log('[Workers] Shutting down workers...');
    await rabbitmq.close().catch(() => {});
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
