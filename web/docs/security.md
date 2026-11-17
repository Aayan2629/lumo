# Lumo security and data handling

Lumo holds sensitive data about renters, so the main defence is not holding the dangerous data at all.
This file is the written retention schedule and incident plan the pilot spec asks for. Get it reviewed
before public launch.

## What Lumo stores, and what it never stores

| Check | Where it happens | What Lumo keeps |
| --- | --- | --- |
| ID (2 documents + liveness) | DVS gateway's hosted page | pass/fail, "2 documents", date, provider session ref |
| Income | Open-banking provider (CDR, read-only) | weekly income band in $250 steps, date |
| Bond ready | Same | yes/no against 4 weeks of the renter's max rent, date |
| References | Lumo emails the referee | confirmed/declined; the referee email is encrypted and wiped once they answer |
| Finance ready | Lender / provider | amount band ("up to $900k"), expiry |
| Agent licence | NSW Fair Trading register | licence number and status |

`tests/schema.test.ts` fails CI if any column name looks like it could hold an ID number, image, account
number, BSB, transaction, statement or date of birth, or if the profile table gains a field the NSW reform
puts off limits (photos, social media, children, appearance, protected attributes).

Webhook payloads from providers are mapped to bands in `lib/verification.ts` and the raw figures are
dropped there; `tests/verification.test.ts` checks the figures never reach the database.

## Access control

- **Row-level security** in Postgres decides what each user can read. Requests run as the `lumo_app`
  role (no `BYPASSRLS`) with `app.user_id` set per transaction (`lib/db.ts`). An agent can only see a
  person who swiped right on one of their own agency's listings (`agent_can_see_user`).
  `tests/rls.test.ts` covers this, including a removed agent and cross-agency attempts.
- Auth, sessions, tokens, rate limits and the dev outbox are not granted to `lumo_app` at all.
- **Renters/investors**: email magic links (15-minute, single-use, stored hashed).
- **Agents**: magic link plus mandatory TOTP two-factor. No `/agent` page or API works until the
  session has passed it. Removing an agent deletes their sessions immediately.
- **Admin actions** and every security-relevant event go to `audit_log`, which a trigger makes
  append-only.

## App and API

- Every secret is read on the server from the environment (`lib/env.ts`). The only `NEXT_PUBLIC_` value is
  the Turnstile site key, which is public by design. `.env.local` is git-ignored.
- Mock providers are refused unless `LUMO_ALLOW_MOCKS=1`, so a production deploy can't silently run on
  fake checks. Turnstile fails closed without a secret.
- Security headers on every response (`middleware.ts`): nonce-based CSP, HSTS, `frame-ancestors 'none'`,
  `nosniff`, strict referrer policy, permissions policy.
- CSRF: `SameSite=Lax` cookies plus a same-origin check on every state-changing API call.
- Input validated on the server with zod; all SQL is parameterised.
- Rate limits (Postgres-backed, so they hold across instances): sign-up 5 per IP and 3 per email per
  10 minutes, swipes 120 a minute, verification starts 10 an hour, TOTP 6 tries per 5 minutes.
- Turnstile on sign-up, and once an hour before swiping.
- Webhooks are HMAC-signed with a 5-minute replay window (providers and Stripe).
- Email buttons are 256-bit single-use tokens, stored hashed, expiring in 7 days. Opening the link
  changes nothing (mail scanners pre-fetch links); pressing the button does.
- Field-level AES-256-GCM encryption for TOTP secrets and referee emails.
- Dependabot and `npm audit` in CI.

## Retention schedule

Runs daily (`npm run jobs:daily`, or `POST /api/cron/daily` with `CRON_SECRET`):

| Data | Kept for |
| --- | --- |
| Accounts with no sign-in | 12 months, then deleted with everything attached |
| Match records | 2 years |
| Income and bond badges | valid 30 days (rows kept until the account goes) |
| ID badge | valid 12 months |
| Open reference requests | 30 days, then closed and the referee email wiped |
| Login links, sessions, email-button tokens | removed once expired |
| Manual uploads (fallback, not built yet) | must be deleted within 24 hours |

Users can download everything (`/api/me/export`) and delete their account (`/api/me/delete`) from their
profile. Update this schedule when NSW publishes the storage and destruction rules under the 2025
amendment.

## Incident plan (Notifiable Data Breaches scheme)

1. **Contain**: revoke affected keys in the secrets manager, rotate `FIELD_ENCRYPTION_KEY` and webhook
   secrets, delete all sessions (`delete from sessions`) if accounts may be compromised.
2. **Assess within 30 days** (aim for 72 hours): what data, how many people, is serious harm likely?
   Use `audit_log` and provider logs.
3. **Notify**: if serious harm is likely, tell affected people and the OAIC
   (oaic.gov.au/privacy/notifiable-data-breaches) as soon as practicable. Tell Microburbs and the
   verification providers if their data or keys are involved.
4. **Review**: write up the cause and the fix; add a test that would have caught it.

## Before public launch

- External penetration test (and yearly after).
- Passkeys for renters (WebAuthn) alongside magic links.
- Monitoring and alerts on unusual sign-ins and data exports.
- Monthly licence re-check against the live NSW register.
- Legal review of the privacy policy, collection notice and this schedule.
