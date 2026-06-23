import nodemailer, { type Transporter } from 'nodemailer';
import type { ContactInput } from './validate';

export interface MailerEnv {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  CONTACT_TO?: string;
}

/** Minimal transport surface we depend on, keeps the code testable. */
export interface MailTransport {
  sendMail(message: Record<string, unknown>): Promise<unknown>;
}

export function createTransport(env: MailerEnv): Transporter {
  const port = Number(env.SMTP_PORT ?? '465');
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

export function buildContactMessage(input: ContactInput, env: MailerEnv) {
  return {
    from: `"RRE Contact" <${env.SMTP_USER}>`,
    to: env.CONTACT_TO,
    replyTo: input.email,
    subject: `Contact form: ${input.name}`,
    text: `Name: ${input.name}\nEmail: ${input.email}\n\n${input.message}\n`,
  };
}

export async function sendContactEmail(
  transport: MailTransport,
  input: ContactInput,
  env: MailerEnv,
): Promise<void> {
  await transport.sendMail(buildContactMessage(input, env));
}
