import amqplib from 'amqplib';
import { RabbitMQClient } from '../infra/rabbitmq/client.js';
import { QUEUES } from '../infra/rabbitmq/constants.js';
import { EmailSender } from '../infra/mailer/smtp.js';
import type { EmailMessage } from '../app/ports/email_publisher.js';

export class EmailWorker {
  private readonly maxRetries = 3;

  constructor(
    private readonly rabbitmq: RabbitMQClient,
    private readonly mailer: EmailSender
  ) {}

  async run(name = 'email-worker', concurrency = 10): Promise<void> {
    console.log(`[EmailWorker] Started with concurrency ${concurrency}`);
    await this.rabbitmq.consume(QUEUES.EMAIL, name, concurrency, async (msg, ch) => {
      await this.handle(msg, ch);
    });
  }

  async handle(d: amqplib.ConsumeMessage, ch: amqplib.Channel): Promise<void> {
    let msg: EmailMessage;
    try {
      msg = JSON.parse(d.content.toString()) as EmailMessage;
    } catch (err) {
      console.error('[EmailWorker] Invalid email message JSON:', err);
      ch.nack(d, false, false);
      return;
    }

    console.log(`[EmailWorker] Processing email type=${msg.name} to=${msg.to} (retries=${msg.retries || 0})`);

    try {
      switch (msg.name) {
        case 'signup':
          await this.mailer.sendVerificationToken(msg.to, msg.token);
          break;
        case 'forgot-password':
          await this.mailer.sendResetPassword(msg.to, msg.token);
          break;
        case 'resend-verify':
          await this.mailer.sendVerificationToken(msg.to, msg.token);
          break;
        case 'reset-password':
          await this.mailer.sendResetNotification(msg.to);
          break;
        case 'share':
          await this.mailer.sendShareNotification(msg.to, msg.token);
          break;
        default:
          console.error(`[EmailWorker] Unknown email job type=${msg.name} to=${msg.to}`);
          ch.nack(d, false, false);
          return;
      }

      ch.ack(d, false);
      console.log(`[EmailWorker] Email processed successfully to=${msg.to}`);
    } catch (err) {
      console.error(`[EmailWorker] Email sending failed to=${msg.to}:`, err);
      const currentRetries = (msg.retries || 0) + 1;
      if (currentRetries <= this.maxRetries) {
        console.warn(`[EmailWorker] Scheduling retry #${currentRetries} via retry queue for ${msg.to}`);
        try {
          await this.rabbitmq.publishRetryEmail({
            ...msg,
            retries: currentRetries,
          });
          ch.ack(d, false);
        } catch (pubErr) {
          console.error('[EmailWorker] Failed to publish retry message:', pubErr);
          ch.nack(d, false, false);
        }
      } else {
        console.error(`[EmailWorker] Max retries (${this.maxRetries}) exceeded for email to=${msg.to}, sending to dead letter queue`);
        ch.nack(d, false, false);
      }
    }
  }
}
