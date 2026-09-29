import { describe, it, expect, vi } from 'vitest';
import { buildContactMessage, sendContactEmail, WEBMAIL_URL, type MailerEnv } from './mailer';

const env: MailerEnv = {
  SMTP_HOST: 'smtp.migadu.com',
  SMTP_PORT: '465',
  SMTP_USER: 'contact@rre.org.uk',
  SMTP_PASS: 'secret',
  CONTACT_TO: 'steve@rre.org.uk',
};

const input = { name: 'Ada', email: 'ada@example.com', message: 'Hello there' };

describe('buildContactMessage', () => {
  it('sends from the SMTP user to CONTACT_TO with visitor reply-to', () => {
    const msg = buildContactMessage(input, env);
    expect(msg.from).toContain('contact@rre.org.uk');
    expect(msg.to).toBe('steve@rre.org.uk');
    expect(msg.replyTo).toBe('ada@example.com');
    expect(msg.subject).toContain('Ada');
    expect(msg.text).toContain('Hello there');
    expect(msg.text).toContain('ada@example.com');
  });

  it('tells Steve to reply from webmail as the rre mailbox', () => {
    const msg = buildContactMessage(input, env);
    expect(msg.text).toContain(WEBMAIL_URL);
    expect(msg.text).toContain('steve@rre.org.uk');
  });
});

describe('sendContactEmail', () => {
  it('passes the built message to the transport', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: '1' });
    await sendContactEmail({ sendMail }, input, env);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0][0].to).toBe('steve@rre.org.uk');
  });
});
