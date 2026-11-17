// End-to-end run of the pilot's definition of done, against a running server with mocks on.
//   APP_URL=http://localhost:3000 DATABASE_URL=... node e2e/pilot-flow.mjs [screenshotDir]
// Renter signs up, verifies 2 IDs + income + bond, likes a listing; the agent signs in with
// 2FA, accepts; the match email lands with the listing's assigned agent; renter books.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import pg from 'pg';
import { createHmac } from 'node:crypto';
import { mkdirSync } from 'node:fs';

const BASE = process.env.APP_URL ?? 'http://localhost:3000';
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totp(secret) {
  let bits = 0, value = 0; const out = [];
  for (const ch of secret) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', Buffer.from(out)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
async function magicLink(email) {
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query(`select text from dev_outbox where "to" = $1 and subject like '%sign-in%' order by created_at desc limit 1`, [email]);
    if (rows[0]) return rows[0].text.match(/https?:\/\/\S+/)[0];
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('no magic link for ' + email);
}
const snap = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false }); };

const browser = await chromium.launch();
const renterEmail = `renter+${Date.now()}@example.com`;

// ---------- renter ----------
const r = await (await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 })).newPage();
r.on('pageerror', (e) => console.error('renter page error:', e.message));
await r.goto(BASE + '/');
await snap(r, '01-landing');
await r.click('text=I’m looking to rent');
await r.fill('#email', renterEmail);
await r.click('button:has-text("Email me a sign-in link")');
await r.waitForSelector('text=Check your email');
await r.goto(await magicLink(renterEmail));
await r.click('button:has-text("Sign in")');
await r.waitForURL(/\/app\/onboarding/);
await r.fill('#name', 'Mei Chen');
await r.fill('#moveIn', '2026-12-15');
await r.fill('#occupants', '1');
await r.fill('#maxRent', '760');
await r.selectOption('#commute', 'usyd');
await r.check('input[name=consent]');
await snap(r, '02-onboarding');
await r.click('button:has-text("Continue to verification")');
await r.waitForURL(/\/app\/verify/);
log('renter signed up and onboarded');

await r.click('button:has-text("Verify my ID")');
await r.waitForURL(/\/mock\/id\//);
await snap(r, '03-id-provider');
await r.click('button:has-text("Both IDs match")');
await r.waitForURL(/\/app\/verify/);
await r.click('button:has-text("Connect my bank")');
await r.waitForURL(/\/mock\/bank\//);
await r.click('button:has-text("2,400")');
await r.waitForURL(/\/app\/verify/);
await r.waitForSelector('text=Bond ready');
await snap(r, '04-verified');
log('renter verified: 2 IDs, income, bond');

await r.goto(BASE + '/app');
await r.waitForSelector('.swipe-card:not(.behind) h2');
await snap(r, '05-deck');
const first = await r.locator('.swipe-card:not(.behind)').getAttribute('aria-label');
await r.click('button[aria-label=Details]');
await r.waitForSelector('[role=dialog]');
await snap(r, '06-details');
await r.click('[role=dialog] button:has-text("Close")');
await r.click('button[aria-label=Like]');
await r.waitForTimeout(800);
log('renter liked', first);
const minutes = (Date.now() - t0) / 60000;
log(`renter sign-up to first like took ${minutes.toFixed(1)} min (target under 10)`);

// ---------- agent ----------
const listing = (await db.query(
  `select l.id, l.address, coalesce(l.assigned_agent_email, a.leasing_email) as to_email from swipes s join listings l on l.id = s.listing_id
   join agencies a on a.id = l.agency_id join users u on u.id = s.user_id where u.email = $1 and s.direction = 'right'`, [renterEmail])).rows[0];
if (!listing) throw new Error('like was not recorded');
const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
a.on('pageerror', (e) => console.error('agent page error:', e.message));
await a.goto(BASE + '/agent/login');
await a.fill('#email', 'alex@harbour.example');
await a.click('button:has-text("Email me a sign-in link")');
await a.waitForSelector('text=Check your email');
await a.goto(await magicLink('alex@harbour.example'));
await a.click('button:has-text("Sign in")');
await a.waitForURL(/\/auth\/2fa/);
const secret = await a.locator('[data-testid=totp-secret]').textContent().catch(() => null);
if (secret) await snap(a, '07-agent-2fa');
const s2 = secret ?? process.env.AGENT_TOTP;
await a.fill('#code', totp(s2.trim()));
await a.click('button:has-text("Verify")');
await a.waitForURL(/\/agent$/);
log('agent signed in with 2FA');
await a.waitForSelector('[data-testid=lead]');
await snap(a, '08-agent-dashboard');
const lead = a.locator('[data-testid=lead]', { hasText: 'Mei' }).first();
const tMatch = Date.now();
await lead.locator('button:has-text("Accept")').click();
await a.waitForSelector('text=It’s a match');
log('agent accepted: match');

const mail = (await db.query(`select "to", subject, created_at from dev_outbox where subject like 'New verified match%' order by created_at desc limit 1`)).rows[0];
const secs = (new Date(mail.created_at).getTime() - tMatch) / 1000;
log(`next-step email to ${mail.to} (expected ${listing.to_email}) ${secs.toFixed(1)}s after accept: "${mail.subject}"`);
if (mail.to !== listing.to_email) throw new Error('match email went to the wrong agent');

// ---------- agent email + renter booking ----------
const o = await (await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 })).newPage();
await o.goto(BASE + '/dev/outbox');
await snap(o, '09-agent-email');
await r.goto(BASE + '/app/matches');
await r.click('button:has-text("Book this time")');
await r.waitForSelector('text=Booked');
await snap(r, '10-booked');
log('renter booked an inspection');
await a.goto(BASE + '/agent/listings/' + listing.id);
await snap(a, '11-agent-listing');

// ---------- data minimisation spot check ----------
const leaks = (await db.query(
  `select table_name, column_name from information_schema.columns where table_schema = 'public'
   and column_name ~* '(licence_image|passport|id_number|document_number|account_number|bsb|transaction|statement|selfie|photo_id)'`)).rows;
log('sensitive-looking columns:', leaks.length ? leaks : 'none');

await browser.close();
await db.end();
log('PASS');
