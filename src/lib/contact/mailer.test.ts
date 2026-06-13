import { describe, it, expect, vi } from 'vitest';
import { buildContactMessage, sendContactEmail, type MailerEnv } from './mailer';

const env: MailerEnv = {
  SMTP_HOST: 'smtp.migadu.com',
  SMTP_PORT: '465',
  SMTP_USER: 'contact@rre.org.uk',
  SMTP_PASS: 'secret',
  CONTACT_TO: 'steveatbts@gmail.com',
};

const input = { name: 'Ada', email: 'ada@example.com', message: 'Hello there' };

describe('buildContactMessage', () => {
  it('sends from the SMTP user to CONTACT_TO with visitor reply-to', () => {
    const msg = buildContactMessage(input, env);
    expect(msg.from).toContain('contact@rre.org.uk');
    expect(msg.to).toBe('steveatbts@gmail.com');
    expect(msg.replyTo).toBe('ada@example.com');
    expect(msg.subject).toContain('Ada');
    expect(msg.text).toContain('Hello there');
    expect(msg.text).toContain('ada@example.com');
  });
});

describe('sendContactEmail', () => {
  it('passes the built message to the transport', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: '1' });
    await sendContactEmail({ sendMail }, input, env);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0][0].to).toBe('steveatbts@gmail.com');
  });
});
