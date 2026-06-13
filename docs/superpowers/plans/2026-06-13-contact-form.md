# Contact Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working contact form to rre.org.uk that emails submissions to Steve via Migadu SMTP, with his address never exposed in client output.

**Architecture:** Convert the static Astro 5 site to *hybrid* rendering with the `@astrojs/node` adapter (standalone). All existing content pages stay prerendered; only the contact page and a `POST /api/contact` endpoint render on-demand. The endpoint validates input, applies honeypot/timing/rate-limit anti-spam, and sends mail with `nodemailer`. Pure logic lives in small testable modules under `src/lib/contact/`; the Astro route is a thin orchestrator. Secrets come from runtime env vars (`process.env`), never from source or client.

**Tech Stack:** Astro 5, `@astrojs/node`, `nodemailer`, `vitest` (new), TypeScript, Tailwind v4, Railway (railpack).

**Spec:** `docs/superpowers/specs/2026-06-13-contact-form-design.md`

**Branch:** `contact-form` (already checked out).

---

## File structure

| File | Responsibility |
| --- | --- |
| `astro.config.mjs` (modify) | Add node adapter (hybrid via per-route `prerender=false`) |
| `package.json` (modify) | Add deps + `test` script; change `start` to run node server |
| `railway.toml` (modify) | Change `startCommand` to the node server |
| `vitest.config.ts` (create) | Test runner config |
| `.env.example` (create) | Documents required env vars (committed; real `.env` is git-ignored) |
| `src/lib/contact/validate.ts` (create) | Pure input validation |
| `src/lib/contact/antispam.ts` (create) | Honeypot + timing checks (pure) |
| `src/lib/contact/rateLimit.ts` (create) | Best-effort in-memory per-IP limiter |
| `src/lib/contact/mailer.ts` (create) | Build + send the email via nodemailer |
| `src/pages/api/contact.ts` (create) | On-demand POST endpoint orchestrating the above |
| `src/pages/contact.astro` (replace) | On-demand contact page: form + no-JS banners + JS enhancement |
| `src/lib/contact/*.test.ts` (create) | Unit tests for the pure modules |

**Design note (refines spec):** The contact page is set to `prerender = false` (not static) so the no-JS success/error banner can be rendered server-side from the `?sent=1`/`?error=1` query param. The timing anti-spam field (`ts`) is populated client-side by the enhancement script, so the timing check only applies to JS submissions; the honeypot is the primary defence and covers no-JS too.

---

## Task 1: Project setup — adapter, deps, test runner

**Files:**
- Modify: `astro.config.mjs`
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime + dev dependencies**

Run (in `c:\Dev\Claude\Steve Laughton`, with system CA so npm's TLS works behind the proxy):

```bash
NODE_OPTIONS=--use-system-ca npm install @astrojs/node nodemailer
NODE_OPTIONS=--use-system-ca npm install -D @types/nodemailer @types/node vitest
```

Expected: `added N packages` for each, with no `UNABLE_TO_VERIFY_LEAF_SIGNATURE` error. (The `NODE_OPTIONS=--use-system-ca` prefix is required here — plain `npm install` fails TLS verification in this environment.)

- [ ] **Step 2: Add the node adapter to `astro.config.mjs`**

Replace the file with:

```js
// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://rre.org.uk',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  compressHTML: true,
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

(With an adapter installed, `output: 'static'` is hybrid: routes are prerendered unless they set `export const prerender = false`.)

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Update `package.json` scripts**

Change the `scripts` block to:

```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "start": "node ./dist/server/entry.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 5: Verify the build still produces the static pages**

Run: `NODE_OPTIONS=--use-system-ca npm run build`
Expected: build completes; output now includes `dist/server/entry.mjs` and `dist/client/`; the 7 existing pages still build. No errors.

- [ ] **Step 6: Commit**

```bash
git add astro.config.mjs package.json package-lock.json vitest.config.ts
git commit -m "build: add node adapter and vitest for contact form"
```

---

## Task 2: Contact input validation (TDD)

**Files:**
- Create: `src/lib/contact/validate.ts`
- Test: `src/lib/contact/validate.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/contact/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateContact } from './validate';

describe('validateContact', () => {
  it('accepts a well-formed submission and trims fields', () => {
    const r = validateContact({ name: '  Ada  ', email: 'ada@example.com', message: ' Hello ' });
    expect(r.valid).toBe(true);
    expect(r.data).toEqual({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
  });

  it('rejects missing name, bad email, and empty message', () => {
    const r = validateContact({ name: '', email: 'not-an-email', message: '' });
    expect(r.valid).toBe(false);
    expect(r.errors.name).toBeTruthy();
    expect(r.errors.email).toBeTruthy();
    expect(r.errors.message).toBeTruthy();
    expect(r.data).toBeUndefined();
  });

  it('rejects an over-long message', () => {
    const r = validateContact({ name: 'Ada', email: 'ada@example.com', message: 'x'.repeat(5001) });
    expect(r.valid).toBe(false);
    expect(r.errors.message).toBeTruthy();
  });

  it('handles non-string inputs without throwing', () => {
    const r = validateContact({ name: 123, email: null, message: undefined });
    expect(r.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- validate`
Expected: FAIL — cannot find module `./validate`.

- [ ] **Step 3: Write the implementation**

`src/lib/contact/validate.ts`:

```ts
export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof ContactInput, string>>;
  data?: ContactInput;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 200;
const MAX_MESSAGE = 5000;

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function validateContact(raw: Record<string, unknown>): ValidationResult {
  const errors: Partial<Record<keyof ContactInput, string>> = {};
  const name = asString(raw.name);
  const email = asString(raw.email);
  const message = asString(raw.message);

  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > MAX_NAME) errors.name = 'Name is too long.';

  if (!email) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';

  if (!message) errors.message = 'Please enter a message.';
  else if (message.length > MAX_MESSAGE) errors.message = 'Message is too long.';

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, errors, data: { name, email, message } };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- validate`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contact/validate.ts src/lib/contact/validate.test.ts
git commit -m "feat: add contact input validation"
```

---

## Task 3: Anti-spam — honeypot + timing (TDD)

**Files:**
- Create: `src/lib/contact/antispam.ts`
- Test: `src/lib/contact/antispam.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/contact/antispam.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isHoneypotTripped, isTooFast } from './antispam';

describe('isHoneypotTripped', () => {
  it('is true when the honeypot field has content', () => {
    expect(isHoneypotTripped({ company: 'Acme' })).toBe(true);
  });
  it('is false when empty or absent', () => {
    expect(isHoneypotTripped({ company: '   ' })).toBe(false);
    expect(isHoneypotTripped({})).toBe(false);
  });
});

describe('isTooFast', () => {
  it('is true when submitted under the threshold after render', () => {
    expect(isTooFast(1000, 1500, 2000)).toBe(true);
  });
  it('is false when enough time has passed', () => {
    expect(isTooFast(1000, 5000, 2000)).toBe(false);
  });
  it('skips the check (false) when no timestamp is present (no-JS)', () => {
    expect(isTooFast(null, 5000, 2000)).toBe(false);
    expect(isTooFast(Number.NaN, 5000, 2000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- antispam`
Expected: FAIL — cannot find module `./antispam`.

- [ ] **Step 3: Write the implementation**

`src/lib/contact/antispam.ts`:

```ts
/** True if the hidden honeypot field was filled (a real user never sees it). */
export function isHoneypotTripped(raw: Record<string, unknown>, field = 'company'): boolean {
  const v = raw[field];
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * True if the form was submitted suspiciously fast after render.
 * `renderedAt`/`now` are epoch ms. When `renderedAt` is missing/invalid
 * (e.g. a no-JS submission that never set the field) the check is skipped.
 */
export function isTooFast(renderedAt: number | null, now: number, minMs = 2000): boolean {
  if (renderedAt == null || !Number.isFinite(renderedAt) || renderedAt <= 0) return false;
  return now - renderedAt < minMs;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- antispam`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contact/antispam.ts src/lib/contact/antispam.test.ts
git commit -m "feat: add honeypot and timing anti-spam checks"
```

---

## Task 4: Best-effort rate limiter (TDD)

**Files:**
- Create: `src/lib/contact/rateLimit.ts`
- Test: `src/lib/contact/rateLimit.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/contact/rateLimit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rateLimit';

describe('RateLimiter', () => {
  it('allows up to the limit then blocks within the window', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.allow('ip1', 0)).toBe(true);
    expect(rl.allow('ip1', 100)).toBe(true);
    expect(rl.allow('ip1', 200)).toBe(false);
  });

  it('resets after the window elapses', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.allow('ip1', 0)).toBe(true);
    expect(rl.allow('ip1', 500)).toBe(false);
    expect(rl.allow('ip1', 1001)).toBe(true);
  });

  it('tracks keys independently', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.allow('ip1', 0)).toBe(true);
    expect(rl.allow('ip2', 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- rateLimit`
Expected: FAIL — cannot find module `./rateLimit`.

- [ ] **Step 3: Write the implementation**

`src/lib/contact/rateLimit.ts`:

```ts
interface Hit {
  count: number;
  resetAt: number;
}

/**
 * In-memory per-key rate limiter. Best effort only: state lives in the single
 * Railway instance's memory and is not durable. Used to blunt abuse, not for
 * correctness.
 */
export class RateLimiter {
  private hits = new Map<string, Hit>();

  constructor(private limit = 5, private windowMs = 10 * 60 * 1000) {}

  /** Returns true if the request is allowed; false if `key` is over the limit. */
  allow(key: string, now: number): boolean {
    const hit = this.hits.get(key);
    if (!hit || now >= hit.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (hit.count >= this.limit) return false;
    hit.count += 1;
    return true;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- rateLimit`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contact/rateLimit.ts src/lib/contact/rateLimit.test.ts
git commit -m "feat: add best-effort per-IP rate limiter"
```

---

## Task 5: Mailer (TDD)

**Files:**
- Create: `src/lib/contact/mailer.ts`
- Test: `src/lib/contact/mailer.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/contact/mailer.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- mailer`
Expected: FAIL — cannot find module `./mailer`.

- [ ] **Step 3: Write the implementation**

`src/lib/contact/mailer.ts`:

```ts
import nodemailer, { type Transporter } from 'nodemailer';
import type { ContactInput } from './validate';

export interface MailerEnv {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  CONTACT_TO?: string;
}

/** Minimal transport surface we depend on — keeps the code testable. */
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- mailer`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full unit suite + commit**

Run: `npm test`
Expected: all suites pass (validate, antispam, rateLimit, mailer).

```bash
git add src/lib/contact/mailer.ts src/lib/contact/mailer.test.ts
git commit -m "feat: add nodemailer contact mailer"
```

---

## Task 6: API endpoint `POST /api/contact`

**Files:**
- Create: `src/pages/api/contact.ts`

This route wires the tested modules together. It is verified via build + a live `dev` request rather than a unit test (mocking Astro's `APIContext` adds more complexity than value; all branching logic is already unit-tested in Tasks 2–5).

- [ ] **Step 1: Write the endpoint**

`src/pages/api/contact.ts`:

```ts
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
```

- [ ] **Step 2: Verify it builds as a server route**

Run: `NODE_OPTIONS=--use-system-ca npm run build`
Expected: build succeeds; log shows `λ src/pages/api/contact.ts` (or similar on-demand marker) rather than a prerendered `/api/contact/index.html`.

- [ ] **Step 3: Verify spam/validation branches live (no SMTP needed)**

Start dev: `npm run dev` (in a background terminal), then:

```bash
# Honeypot tripped → looks successful, no send attempted
curl -s -i -X POST localhost:4321/api/contact -H 'Accept: application/json' \
  --data 'name=Bot&email=bot@x.com&message=hi&company=Acme'
# Expected: HTTP/1.1 200 with {"ok":true}

# Invalid input → 400
curl -s -i -X POST localhost:4321/api/contact -H 'Accept: application/json' \
  --data 'name=&email=bad&message='
# Expected: HTTP/1.1 400 with {"ok":false,"errors":{...}}
```

Expected: the 200 (honeypot) and 400 (validation) responses as described. A *valid* submission will attempt SMTP and return 500 until env vars are set — that is expected at this stage; full send is verified in Task 9.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/contact.ts
git commit -m "feat: add on-demand contact API endpoint"
```

---

## Task 7: Contact page — form, no-JS banners, JS enhancement

**Files:**
- Replace: `src/pages/contact.astro`

- [ ] **Step 1: Replace the page**

`src/pages/contact.astro`:

```astro
---
export const prerender = false;
import BaseLayout from '../layouts/BaseLayout.astro';

const params = Astro.url.searchParams;
const status = params.get('sent') === '1' ? 'sent' : params.get('error') === '1' ? 'error' : null;
---

<BaseLayout title="Contact" description="Get in touch with Stephen Laughton.">
  <h1>Contact</h1>

  {status === 'sent' && (
    <p data-banner="sent" class="mt-6 rounded border border-green-700/40 bg-green-50 px-4 py-3 text-sm text-green-900">
      Thank you — your message has been sent. Steve will get back to you.
    </p>
  )}
  {status === 'error' && (
    <p data-banner="error" class="mt-6 rounded border border-red-700/40 bg-red-50 px-4 py-3 text-sm text-red-900">
      Sorry, something went wrong and your message wasn’t sent. Please try again.
    </p>
  )}

  <p class="mt-6 text-lg text-[color:var(--color-charcoal)]">
    Have a question or comment about <em>The Money Sham</em> or Real Resource
    Economics? Send a message below.
  </p>

  <form method="POST" action="/api/contact" class="mt-8 space-y-5" data-contact-form>
    <div>
      <label for="name" class="block text-sm font-medium">Name</label>
      <input id="name" name="name" type="text" required autocomplete="name"
        class="mt-1 w-full border border-[color:var(--color-rule)] bg-white px-3 py-2" />
    </div>
    <div>
      <label for="email" class="block text-sm font-medium">Email</label>
      <input id="email" name="email" type="email" required autocomplete="email"
        class="mt-1 w-full border border-[color:var(--color-rule)] bg-white px-3 py-2" />
    </div>
    <div>
      <label for="message" class="block text-sm font-medium">Message</label>
      <textarea id="message" name="message" rows="6" required
        class="mt-1 w-full border border-[color:var(--color-rule)] bg-white px-3 py-2"></textarea>
    </div>

    <!-- Honeypot: hidden from humans; bots fill it -->
    <div aria-hidden="true" class="hidden">
      <label>Company<input name="company" type="text" tabindex="-1" autocomplete="off" /></label>
    </div>
    <input type="hidden" name="ts" value="" data-ts />

    <button type="submit"
      class="inline-block rounded-sm bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-cream)] hover:bg-black">
      Send message
    </button>

    <p data-form-status role="status" aria-live="polite" class="text-sm"></p>
  </form>
</BaseLayout>

<script>
  const form = document.querySelector('[data-contact-form]');
  if (form instanceof HTMLFormElement) {
    const tsField = form.querySelector('[data-ts]');
    if (tsField instanceof HTMLInputElement) tsField.value = String(Date.now());

    const statusEl = form.querySelector('[data-form-status]');
    const setStatus = (msg: string) => {
      if (statusEl) statusEl.textContent = msg;
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      if (button instanceof HTMLButtonElement) button.disabled = true;
      setStatus('Sending…');
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        const data = await res.json().catch(() => ({ ok: res.ok }));
        if (res.ok && data.ok) {
          form.reset();
          setStatus('Thank you — your message has been sent.');
        } else {
          setStatus('Sorry, that didn’t send. Please check your details and try again.');
        }
      } catch {
        setStatus('Sorry, that didn’t send. Please try again.');
      } finally {
        if (button instanceof HTMLButtonElement) button.disabled = false;
      }
    });
  }
</script>
```

- [ ] **Step 2: Build and confirm no secret leaks into client output**

Run: `NODE_OPTIONS=--use-system-ca npm run build`
Then:

```bash
grep -rn "steveatbts@gmail.com" dist/client 2>/dev/null | wc -l   # expect 0
grep -rn "SMTP_PASS\|smtp.migadu.com" dist/client 2>/dev/null | wc -l  # expect 0
```

Expected: both `0`. (The address and SMTP config exist only in the server bundle / env, never in client assets.)

- [ ] **Step 3: Manual check in dev**

`npm run dev`, open `http://localhost:4321/contact`:
- Form renders with Name/Email/Message and a Send button.
- View source: the honeypot `company` field is present but `display:none` (Tailwind `hidden`); no email address visible.
- Visit `http://localhost:4321/contact?sent=1` → green success banner shows (server-rendered, works without JS).
Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/contact.astro
git commit -m "feat: build contact form page with no-JS fallback and JS enhancement"
```

---

## Task 8: Deploy config + env documentation

**Files:**
- Modify: `railway.toml`
- Create: `.env.example`

- [ ] **Step 1: Update `railway.toml` start command**

Replace the `[deploy]` `startCommand` line so Railway runs the node server (binding to all interfaces and Railway's `$PORT`):

```toml
[build]
builder = "railpack"

[deploy]
startCommand = "HOST=0.0.0.0 node ./dist/server/entry.mjs"
healthcheckPath = "/"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 2: Create `.env.example`**

`.env.example` (committed; the real `.env` is already git-ignored via `.env` / `.env.*` in `.gitignore`):

```bash
# Migadu SMTP credentials for the contact form (set these as Railway variables).
SMTP_HOST=smtp.migadu.com
SMTP_PORT=465
SMTP_USER=contact@rre.org.uk
SMTP_PASS=
# Where contact-form submissions are delivered.
CONTACT_TO=steveatbts@gmail.com
```

- [ ] **Step 3: Final full build + full test suite**

Run: `NODE_OPTIONS=--use-system-ca npm run build && npm test`
Expected: build succeeds; all unit tests pass.

- [ ] **Step 4: Commit**

```bash
git add railway.toml .env.example
git commit -m "build: run node server on Railway and document contact env vars"
```

---

## Task 9: Provisioning + end-to-end (out-of-band; gates live delivery, not the merge)

This task is infrastructure, not application code. It can happen in parallel with review and does not block merging Tasks 1–8. **Use the `email-admin` skill** (Cloudflare DNS + Migadu).

- [ ] **Step 1: Create the Migadu mailbox** `contact@rre.org.uk` (or an identity that can authenticate to Migadu SMTP) and record its password.

- [ ] **Step 2: Add/verify rre.org.uk DNS** so Gmail accepts the mail: Migadu **MX**, **SPF** (`v=spf1 include:spf.migadu.com -all`), **DKIM** (Migadu-provided keys), and a **DMARC** record. Wait for propagation.

- [ ] **Step 3: Set Railway variables** on the site's service: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CONTACT_TO`, and `HOST=0.0.0.0`. (Use the Railway `environment`/variables skills or dashboard.)

- [ ] **Step 4: Deploy and end-to-end test.** After deploy, submit the live form once with a real address:
  - Confirm the email arrives at `steveatbts@gmail.com`, `Reply-To` is the visitor's address, and it is **not** in spam.
  - Submit with JS disabled → redirected to `/contact?sent=1` with the success banner.
  - Confirm the deployed page source still contains no email/SMTP secrets.

- [ ] **Step 5: Finish the branch.** Once Tasks 1–8 are reviewed and merged (and Task 9 verified), use the `finishing-a-development-branch` skill to wrap up.

---

## Self-review notes

- **Spec coverage:** runtime/adapter (Task 1), form fields + no-JS + enhancement (Task 7), endpoint validate/anti-spam/rate-limit/send (Tasks 2–6), env-var secrets + `.env` ignored + `.env.example` (Task 8), Migadu/DNS prerequisite (Task 9), no-secret-leak verification (Task 7 Step 2). All covered.
- **Refinements vs spec (intentional, noted above):** contact page is `prerender = false` so the no-JS banner renders server-side; the timing `ts` field is client-set, so timing only guards JS submissions while the honeypot covers all. Two on-demand routes (page + API) instead of one.
- **Type consistency:** `ContactInput` defined in `validate.ts` and reused by `mailer.ts` and the endpoint; `MailerEnv` defined in `mailer.ts` and reused by the endpoint; `RateLimiter.allow(key, now)` signature consistent across Task 4 and Task 6.
- **Env access:** the endpoint reads `process.env` (runtime), not `import.meta.env` (build-time) — correct for Railway-injected secrets.
