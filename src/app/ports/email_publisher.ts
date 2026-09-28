export interface EmailMessage {
  to: string;
  name: string;
  token: string;
  retries?: number;
}

export interface EmailPublisher {
  publishEmail(msg: EmailMessage): Promise<void>;
}
