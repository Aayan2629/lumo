import { describe, expect, it } from 'vitest';
import { withService } from '@/lib/db';
import { maybeMatch } from '@/lib/match';
import { makeAgency, makeListing, makeRenter, swipe } from './helpers';

const agentSays = (agentId: string, userId: string, listingId: string) =>
  withService((db) => db.query(`insert into agent_swipes (agent_id, user_id, listing_id, direction) values ($1, $2, $3, 'right')`, [agentId, userId, listingId]));
const outbox = (to: string) => withService(async (db) => (await db.query(`select subject, html, text from dev_outbox where "to" = $1 order by created_at`, [to])).rows);

describe('matching and the next-step email', () => {
  it('matches only when both sides like, then emails the listing’s assigned agent and the renter', async () => {
    const { agencyId, agentId } = await makeAgency();
    const listing = await makeListing(agencyId, { assigned: 'priya@agency.test' });
    const renter = await makeRenter({ verified: true });

    await swipe(renter, listing);
    expect(await maybeMatch(renter, listing)).toBeNull(); // agent hasn't said yes yet

    await agentSays(agentId, renter, listing);
    const t = Date.now();
    const matchId = await maybeMatch(renter, listing);
    expect(matchId).toBeTruthy();
    expect(Date.now() - t).toBeLessThan(60_000);

    const mails = await outbox('priya@agency.test');
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toMatch(/New verified match: Mei/);
    expect(mails[0].html).toMatch(/ID verified/);
    expect(mails[0].html).toMatch(/Income covers rent 3x/);   // 2250 / 700 = 3.2 -> 3x
    expect(mails[0].html).not.toMatch(/2250|2,250/);           // the band itself never leaves Lumo
    expect(mails[0].html).toMatch(/\/e\/offer\?t=/);
    expect(mails[0].html).toMatch(/Not your listing\?/);

    const renterEmail = await withService(async (db) => (await db.query('select email from users where id = $1', [renter])).rows[0].email);
    expect((await outbox(renterEmail))[0].subject).toMatch(/You matched with/);

    expect(await maybeMatch(renter, listing)).toBeNull(); // no duplicate match or email
    expect(await outbox('priya@agency.test')).toHaveLength(1);
  });

  it('falls back to the agency’s leasing inbox when no agent is assigned', async () => {
    const { agencyId, agentId } = await makeAgency({ leasing: 'leasing-fallback@agency.test' });
    const listing = await makeListing(agencyId, { assigned: null });
    const renter = await makeRenter({ verified: true });
    await swipe(renter, listing); await agentSays(agentId, renter, listing);
    await maybeMatch(renter, listing);
    expect(await outbox('leasing-fallback@agency.test')).toHaveLength(1);
  });

  it('records a $25 investor-lead charge on a for-sale match', async () => {
    const { agencyId, agentId } = await makeAgency();
    const listing = await makeListing(agencyId, { type: 'sale', price: 900000 });
    const investor = await makeRenter({ verified: true, role: 'investor' });
    await swipe(investor, listing); await agentSays(agentId, investor, listing);
    const matchId = await maybeMatch(investor, listing);
    const ev = await withService(async (db) => (await db.query(`select kind, amount_cents from billing_events where match_id = $1`, [matchId])).rows);
    expect(ev).toEqual([{ kind: 'investor_lead', amount_cents: 2500 }]);
  });
});
