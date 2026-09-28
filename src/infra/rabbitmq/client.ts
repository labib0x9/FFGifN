import amqplib from 'amqplib';
import { QUEUES } from './constants.js';
import { setupRabbitMQTopology } from './setup.js';
import { getConfig, Config } from '../../config/env.js';
import type { EmailPublisher, EmailMessage } from '../../app/ports/email_publisher.js';

export type { EmailMessage };

export interface VideoMessage {
  user_id: string;
  job_id: string;
  upload_key: string;
  start_time: number;
  end_time: number;
  width: number;
  fps: number;
  loop: boolean;
  retries?: number;
}

export interface SaveVideoMessage {
  key: string;
  user_id: string;
  filename: string;
  retries?: number;
}

export class RabbitMQClient implements EmailPublisher {
  private connection: amqplib.ChannelModel | null = null;
  private connectingPromise: Promise<amqplib.ChannelModel> | null = null;
  private publishChannel: amqplib.ConfirmChannel | null = null;
  private consumerChannels: Map<string, amqplib.Channel> = new Map();

  constructor(
    private readonly rmqConfig?: Config['rabbitmq'],
    private readonly minioConfig?: Config['minio']
  ) {}

  async connect(): Promise<amqplib.ChannelModel> {
    if (this.connection) {
      return this.connection;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    const cnf = this.rmqConfig || getConfig().rabbitmq;
    const minioCnf = this.minioConfig || getConfig().minio;

    this.connectingPromise = (async () => {
      try {
        const conn = await amqplib.connect(cnf.url);
        this.connection = conn;

        conn.on('error', (err) => {
          console.error('[RabbitMQ] Connection error:', err);
          this.handleDisconnect();
        });

        conn.on('close', () => {
          console.warn('[RabbitMQ] Connection closed');
          this.handleDisconnect();
        });

        console.log('[RabbitMQ] Connection complete');

        // Run topology setup
        const setupChannel = await conn.createChannel();
        try {
          await setupRabbitMQTopology(setupChannel, minioCnf);
        } finally {
          await setupChannel.close().catch(() => {});
        }

        // Initialize reusable confirm channel for publishing
        this.publishChannel = await conn.createConfirmChannel();

        return conn;
      } catch (err) {
        this.handleDisconnect();
        throw new Error(`[RabbitMQ Panic] Failed to connect to RabbitMQ at ${cnf.addr}: ${(err as Error).message}`);
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  private handleDisconnect(): void {
    this.connection = null;
    this.publishChannel = null;
    this.consumerChannels.clear();
  }

  private async getPublishChannel(): Promise<amqplib.ConfirmChannel> {
    await this.connect();
    if (!this.publishChannel) {
      if (!this.connection) {
        await this.connect();
      }
      this.publishChannel = await this.connection!.createConfirmChannel();
    }
    return this.publishChannel;
  }

  async publish(queue: string, payload: unknown): Promise<void> {
    const ch = await this.getPublishChannel();
    const content = Buffer.from(JSON.stringify(payload));

    await new Promise<void>((resolve, reject) => {
      ch.sendToQueue(
        queue,
        content,
        {
          contentType: 'application/json',
          persistent: true,
          timestamp: Date.now(),
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    console.log(`[RabbitMQ] publish() message confirmed to ${queue}`);
  }

  async publishEmail(msg: EmailMessage): Promise<void> {
    return this.publish(QUEUES.EMAIL, msg);
  }

  async publishRetryEmail(msg: EmailMessage): Promise<void> {
    return this.publish(QUEUES.EMAIL_RETRY, msg);
  }

  async publishVideo(msg: VideoMessage): Promise<void> {
    return this.publish(QUEUES.PROCESS, msg);
  }

  async publishSaveVideo(msg: SaveVideoMessage): Promise<void> {
    return this.publish(QUEUES.SAVE, msg);
  }

  async publishRetrySaveVideo(msg: SaveVideoMessage): Promise<void> {
    return this.publish(QUEUES.SAVE_RETRY, msg);
  }

  async consume(
    queue: string,
    consumerName: string,
    concurrency: number,
    onMessage: (msg: amqplib.ConsumeMessage, channel: amqplib.Channel) => Promise<void>
  ): Promise<void> {
    const conn = await this.connect();
    const ch = await conn.createChannel();
    this.consumerChannels.set(consumerName, ch);

    await ch.prefetch(concurrency);

    await ch.consume(
      queue,
      async (msg) => {
        if (!msg) return;
        try {
          await onMessage(msg, ch);
        } catch (err) {
          console.error(`[RabbitMQ] Uncaught error in consumer on ${queue}:`, err);
          try {
            ch.nack(msg, false, false);
          } catch (nackErr) {
            console.error(`[RabbitMQ] Failed to nack message:`, nackErr);
          }
        }
      },
      { noAck: false }
    );
  }

  async closeConsumerChannel(name: string): Promise<void> {
    const ch = this.consumerChannels.get(name);
    if (ch) {
      await ch.close().catch(() => {});
      this.consumerChannels.delete(name);
    }
  }

  async close(): Promise<void> {
    for (const [, ch] of this.consumerChannels) {
      try {
        await ch.close();
      } catch {
        // Ignore close errors during teardown
      }
    }
    this.consumerChannels.clear();

    if (this.publishChannel) {
      try {
        await this.publishChannel.close();
      } catch {
        // Ignore close errors during teardown
      }
      this.publishChannel = null;
    }

    if (this.connection) {
      try {
        await this.connection.close();
      } catch {
        // Ignore close errors during teardown
      }
      this.connection = null;
    }
  }
}

let rabbitMQInstance: RabbitMQClient | null = null;

export function getRabbitMQClient(
  rmqConfig?: Config['rabbitmq'],
  minioConfig?: Config['minio']
): RabbitMQClient {
  if (!rabbitMQInstance) {
    rabbitMQInstance = new RabbitMQClient(rmqConfig, minioConfig);
  }
  return rabbitMQInstance;
}

export async function disconnectRabbitMQ(): Promise<void> {
  if (rabbitMQInstance) {
    await rabbitMQInstance.close().catch(() => {});
    rabbitMQInstance = null;
  }
}
