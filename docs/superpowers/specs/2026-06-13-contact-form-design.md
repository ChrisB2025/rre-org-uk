# Contact form — design spec

**Date:** 2026-06-13
**Site:** rre.org.uk (Astro 5, deployed on Railway)
**Status:** Approved (design), pending implementation plan

## Context / problem

The site has a `/contact` page that is currently a placeholder ("Contact details
coming soon"). Steve wants a working contact form whose submissions reach his
email **steveatbts@gmail.com**, **without that address appearing anywhere in the
client-side HTML or JavaScript**.

The site is currently a fully static Astro build served on Railway via
`serve dist`, so there is no server runtime to process a form POST. Rather than
introduce a third-party form service (Formspree / Web3Forms / FormSubmit), the
decision is to **give the site its own server runtime** and send the email
ourselves through an authenticated mailbox.

## Decisions

- **Runtime:** Convert the site to **Astro hybrid rendering** using the
  `@astrojs/node` adapter (standalone mode). All existing pages stay prerendered
  (static); only a single API endpoint runs on-demand.
- **Mail transport:** **Migadu SMTP**, sending **from `contact@rre.org.uk`** and
  delivering **to `steveatbts@gmail.com`**, via `nodemailer`. (Running our own
  raw mail server is rejected — it would land in Gmail spam.)
- **No third-party form service and no CAPTCHA** (CAPTCHA would reintroduce a
  third party). Spam is handled with a honeypot + timing + best-effort rate
  limiting.

## Architecture

```
Browser (form)  ──POST /api/contact──▶  Astro Node server (Railway)
                                          │  validate + anti-spam
                                          │  nodemailer → Migadu SMTP (TLS 465)
                                          ▼
                                       contact@rre.org.uk  ──▶  steveatbts@gmail.com
```

- Add `@astrojs/node` (mode: `standalone`) in `astro.config.mjs`.
- Build remains `astro build`, producing `dist/server/entry.mjs` + `dist/client`.
- Railway start command changes from `serve dist` to `node ./dist/server/entry.mjs`
  (adapter reads `HOST`/`PORT` from Railway). Update `package.json` `start`
  script and any Railway/Nixpacks config accordingly.
- Existing pages keep default `prerender = true` → byte-for-byte same static
  output. Only `src/pages/api/contact.ts` sets `export const prerender = false`.

## Components

### 1. Contact page — `src/pages/contact.astro`
Replaces the current stub. Renders a `<form method="POST" action="/api/contact">`
with:
- **Name** — text, required
- **Email** — email, required (used as `Reply-To`)
- **Message** — textarea, required
- **Honeypot** — a visually-hidden field (e.g. `company`) that real users never
  see; bots that fill it are silently dropped.
- A hidden timestamp field (form render time) for the timing check.

Works with **no JavaScript** (native form POST). A small inline progressive-
enhancement script intercepts submit, sends via `fetch`, and swaps in an inline
success or error message without a page reload. On first paint the page also
checks `?sent=1` / `?error=1` query params (set by the no-JS redirect path) to
show the corresponding banner.

### 2. API endpoint — `src/pages/api/contact.ts` (`prerender = false`)
A `POST` handler that:
1. Parses the submission (form-encoded; also accept JSON from `fetch`).
2. **Validates:** name non-empty; email matches a basic pattern; message within
   length bounds (e.g. 1–5000 chars). On failure → 400 (JSON) or redirect
   `?error=1`.
3. **Anti-spam:**
   - Honeypot filled → respond `200 ok` but **do not send** (silent drop).
   - Submission faster than a small threshold (e.g. < 2s after render) → drop.
   - Best-effort in-memory per-IP rate limit (e.g. N per 10 min). Single Railway
     instance, so a module-level map is adequate; not relied on for correctness.
4. **Sends mail** via a small `nodemailer` transport helper:
   - `From: "RRE Contact" <contact@rre.org.uk>`
   - `To: steveatbts@gmail.com` (from `CONTACT_TO`)
   - `Reply-To:` visitor's email
   - Subject + plain-text body containing name, email, message.
5. Returns `{ ok: true }` (JSON) to `fetch` callers, or `303` redirect to
   `/contact?sent=1` for native form posts. Errors mirror this with `?error=1`.

Content negotiation: respond JSON when the request's `Accept` includes
`application/json` (set explicitly by the enhancement script), otherwise redirect.

### 3. Mail helper — `src/lib/mailer.ts`
Creates the `nodemailer` transport from env vars and exposes a `sendContactEmail`
function. Keeps SMTP config in one place, out of the route handler.

## Configuration (Railway env vars — never in source/client)

| Var | Example | Purpose |
| --- | --- | --- |
| `SMTP_HOST` | `smtp.migadu.com` | Migadu SMTP host |
| `SMTP_PORT` | `465` | TLS port |
| `SMTP_USER` | `contact@rre.org.uk` | Migadu mailbox (auth + From) |
| `SMTP_PASS` | *(secret)* | Migadu mailbox password |
| `CONTACT_TO` | `steveatbts@gmail.com` | Destination inbox |

A local `.env` (git-ignored) mirrors these for `astro dev` testing.

## Prerequisite (provisioning, outside the app code)

For Gmail to accept mail from `contact@rre.org.uk`, the domain needs Migadu set
up with correct DNS:
- A Migadu mailbox `contact@rre.org.uk` must exist.
- DNS for rre.org.uk: **MX** → Migadu, plus **SPF**, **DKIM**, **DMARC** records.

rre.org.uk is still marked "pending" (the live site runs on the Railway
subdomain), so this email DNS may not be configured yet. Use the **email-admin**
skill (Cloudflare DNS + Migadu) to verify/provision the mailbox and records.
**This is the only step that can block go-live until DNS propagates.** The app
code can be built and merged independently; the form will deliver once SMTP creds
+ DNS are live.

## Error handling

- Invalid input → 400 / `?error=1` with a clear inline message; never silently
  swallow a genuine user error.
- SMTP send failure → 500 / `?error=1`; log the error server-side (Railway logs);
  show the user a "couldn't send, try again / email directly" message. Do **not**
  expose `steveatbts@gmail.com` in that fallback message (offer the Lola
  Books / MMTUK links instead, as the current stub does).
- Honeypot/timing/rate-limit drops → respond as success to the client (don't
  tip off bots) but send nothing.

## Testing / verification

- `npm run build` succeeds with the node adapter; existing 7 pages still emit
  static HTML; `/api/contact` present as a server route.
- Local: `astro dev` with a `.env`; submit the form and confirm an email is
  received at the destination (use a Migadu test or mailtrap-style check if DNS
  not yet live).
- No-JS path: submit with JS disabled → redirect + success banner.
- JS path: submit → inline success without reload.
- Spam: honeypot filled → no email; rapid submit → no email.
- **Grep the built `dist/` to confirm `steveatbts@gmail.com` and SMTP creds do
  not appear anywhere in client output.**

## Out of scope

- File attachments, multi-recipient routing, autoresponders, storing submissions
  in a database, analytics on the form.
