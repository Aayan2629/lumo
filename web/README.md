# Lumo app (pilot)

A swipe app where renters and investors prove who they are once, swipe on homes with Microburbs data,
and land in an agent's inbox as a verified lead. Agents pay; renters never do.

This folder is the pilot build from the master spec. The Chrome extension (the original hackathon
listing checker) lives next door in `../lumo`.

## Run it locally

You need Node 22 and Postgres 16.

```bash
cd web
npm install
cp .env.example .env.local        # then fill FIELD_ENCRYPTION_KEY (command in the file)
createdb lumo_dev                  # and lumo_test for the tests
npm run db:seed                    # migrates, then adds a demo agency with 20 City of Sydney listings
npm run dev                        # http://localhost:3000
```

With the default `.env.local` everything runs on mock providers, so you can click through the whole flow:

1. Open `/`, choose **I'm looking to rent**, enter any email.
2. Open `/dev/outbox` to find the sign-in email (no email is really sent), and sign in.
3. Fill in preferences, verify ID and bank on the simulated provider pages, then swipe.
4. In another browser, sign in at `/agent/login` as `alex@harbour.example` (the demo agency owner).
   Scan the QR code with an authenticator app, accept the lead, and watch the next-step email arrive
   in `/dev/outbox`.

`node e2e/pilot-flow.mjs [screenshot-dir]` runs that whole journey in a headless browser against a
running server.

## Tests

```bash
npm run typecheck
npm test               # uses lumo_test; set TEST_DATABASE_URL to point elsewhere
```

The tests cover the pilot's definition of done that can be checked in code: row-level security (agents only
see people who liked their own listings), no sensitive columns anywhere, match emails to the assigned
agent with the leasing inbox fallback, signed webhooks storing only bands, Microburbs caching with a date
and source on every number, single-use email links, TOTP, rate limits and retention.

## How it's built

- **Next.js 15** (App Router) for the renter/investor app (`/app`), the agent dashboard (`/agent`) and
  the API (`/api`). Mobile-first; add it to the home screen.
- **Postgres** with row-level security. `db/migrations/001_init.sql` is the schema and every policy.
- **Server-only integrations** in `lib/providers/`. The browser never talks to Microburbs, the ID provider
  or the bank provider; it only sees Lumo's own card and badge objects.

| Service | File | Pilot | Live |
| --- | --- | --- | --- |
| Microburbs | `lib/providers/microburbs.ts`, `lib/housecard.ts` | Sample data for City of Sydney, labelled "sample data" on every card | `MICROBURBS_PROVIDER=live` + key. Client written against the v1 paths the extension uses; check the `market/*` shapes once you have a key |
| ID (DVS gateway) | `lib/providers/verify.ts` | Simulated hosted page + signed webhook | Adapter to write for Didit or Sumsub |
| Open banking | `lib/providers/verify.ts` | Simulated consent page + signed webhook | Adapter to write for Basiq, Frollo or Fiskil |
| NSW licence register | `lib/providers/licence.ts` | Mock register (`111111` expired, `000000` not found) | Adapter for the NSW property licence API |
| Email | `lib/providers/email.ts` | Outbox table, viewable at `/dev/outbox` | Resend (written; needs key and a domain with SPF/DKIM/DMARC) |
| Billing | `lib/providers/billing.ts` | Simulated checkout | Stripe Checkout + webhook (written; needs keys and price IDs) |
| Bot check | `lib/providers/turnstile.ts` | Dev token | Cloudflare Turnstile (written; needs keys) |

Mocks only run with `LUMO_ALLOW_MOCKS=1`. Without it the app refuses to start a mock check.

Security and data handling, including the retention schedule and incident plan: [docs/security.md](docs/security.md).

## Where the build order stands

| Step | Status |
| --- | --- |
| 1. Foundation: repo, auth, RLS database, secrets, privacy policy | Done. Magic links for everyone, TOTP for agents. Passkeys not yet |
| 2. House cards with caching (City of Sydney) | Done on sample data; live client ready for a key |
| 3. Renter app: onboarding, deck, swipe-up details, saved | Done |
| 4. Verification: 2 IDs, income, bond, references, expiring badges | Done against simulated providers; references are real (email to referee) |
| 5. Agent dashboard: licence check, listings, lead queue, accept | Done (team management too). Photo upload not yet: listings get demo photos |
| 6. Matching + emails: match, next-step email, renter notice, inspection booking | Done, including reroute, send application, calendar links, 7-day expiry |
| 7. Billing: plan and boosts | Done against simulated checkout; Stripe code written |
| 8. Security pass | Headers, CSP, CSRF, rate limits, Turnstile, audit log, retention jobs done. External pen test still to book |
| 9. Investor mode | Done: for-sale deck, investor card, finance badge, $25 lead charge |

## Pilot definition of done

- [x] Renter can sign up, verify 2 IDs and income, and swipe in under 10 minutes (end-to-end run: seconds on mocks)
- [x] Agent can sign up only with a valid NSW licence (mock register until the live one is wired)
- [x] A match sends the next-step email to the right agent within 1 minute (sent in the same request)
- [x] No ID images, account numbers or transactions in the database (enforced by a test)
- [x] Every Microburbs number on a card shows its date and source
- [x] Agents can only see renters who liked their own listings (tested at the database level)
- [x] Rate limiting and bot protection on sign-up and swipes
- [x] Privacy policy, collection notice and data deletion work end to end
- [ ] Real City of Sydney listings: needs agencies to list, or a listings feed
- [ ] Live DVS, open-banking and licence providers: needs contracts and keys

## Deploying

Any Node host with Postgres works (Vercel or Fly plus Supabase or Neon, all in Sydney regions). Set the
variables from `.env.example` in the host's secrets manager, leave `LUMO_ALLOW_MOCKS` unset, run
`npm run db:migrate`, and schedule `POST /api/cron/daily` with the `CRON_SECRET`. The connection user must
be allowed to `SET ROLE lumo_app` (true for the owner role on Supabase and Neon).

The spec suggested Cloudflare Workers. This build uses Next.js on Node because row-level security
needs a real Postgres connection per request; moving to Workers later means swapping `pg` for a
Workers-compatible driver (Hyperdrive or Neon serverless), with the rest unchanged.
