import type { APIRoute } from 'astro';
import { validateContact } from '../../lib/contact/validate';
import { isHoneypotTripped, isTooFast } from '../../lib/contact/antispam';
import { RateLimiter } from '../../lib/contact/rateLimit';
import { createTransport, sendContactEmail, type MailerEnv } from '../../lib/contact/mailer';

export const prerender = false;

const limiter = new RateLimiter(5, 10 * 60 * 1000);

function wantsJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const asJson = wantsJson(request);
  const contentType = request.headers.get('content-type') ?? '';

  let raw: Record<string, unknown> = {};
  try {
    if (contentType.includes('application/json')) {
      raw = (await request.json()) as Record<string, unknown>;
    } else {
      raw = Object.fromEntries((await request.formData()).entries());
    }
  } catch {
    raw = {};
  }

  // Silent spam drops: look successful to the client, send nothing.
  const renderedAt = typeof raw.ts === 'string' && raw.ts ? Number(raw.ts) : null;
  if (isHoneypotTripped(raw) || isTooFast(renderedAt, Date.now())) {
    return asJson ? json({ ok: true }, 200) : redirect('/contact?sent=1');
  }

  const ip = clientAddress ?? 'unknown';
  if (!limiter.allow(ip, Date.now())) {
    return asJson ? json({ ok: false, error: 'rate_limited' }, 429) : redirect('/contact?error=1');
  }

  const result = validateContact(raw);
  if (!result.valid || !result.data) {
    return asJson ? json({ ok: false, errors: result.errors }, 400) : redirect('/contact?error=1');
  }

  const env = process.env as unknown as MailerEnv;
  try {
    await sendContactEmail(createTransport(env), result.data, env);
  } catch (err) {
    console.error('[contact] send failed:', err);
    return asJson ? json({ ok: false, error: 'send_failed' }, 500) : redirect('/contact?error=1');
  }

  return asJson ? json({ ok: true }, 200) : redirect('/contact?sent=1');
};
