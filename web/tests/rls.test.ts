import { beforeAll, describe, expect, it } from 'vitest';
import { withUser } from '@/lib/db';
import { leadsFor } from '@/lib/agent';
import { makeAgency, makeListing, makeRenter, swipe } from './helpers';

// Definition of done: "Agents can only see renters who liked their own listings (tested)".
// These run as the real lumo_app role with app.user_id set, exactly like a request.
describe('row-level security', () => {
  let A: { agencyId: string; agentId: string }, B: { agencyId: string; agentId: string };
  let listingA: string, liker: string, other: string;

  beforeAll(async () => {
    A = await makeAgency(); B = await makeAgency();
    listingA = await makeListing(A.agencyId);
    await makeListing(B.agencyId);
    liker = await makeRenter({ verified: true });
    other = await makeRenter({ verified: true });
    await swipe(liker, listingA, 'right');
    await swipe(other, listingA, 'left'); // a pass doesn't reveal you
  });

  it('lets an agent see people who liked their listing, with badges', async () => {
    const seen = await withUser(A.agentId, async (db) => ({
      users: (await db.query('select id from users where id = any($1)', [[liker, other]])).rows.map((r) => r.id),
      verifs: (await db.query('select type from verifications where user_id = $1', [liker])).rowCount,
      leads: await leadsFor(db),
    }));
    expect(seen.users).toEqual([liker]);
    expect(seen.verifs).toBeGreaterThan(0);
    expect(seen.leads.map((l) => l.userId)).toEqual([liker]);
    expect(seen.leads[0].badges.find((b) => b.key === 'id')?.ok).toBe(true);
  });

  it('hides those people from every other agency', async () => {
    const seen = await withUser(B.agentId, async (db) => ({
      users: (await db.query('select id from users where id = $1', [liker])).rowCount,
      profiles: (await db.query('select 1 from profiles where user_id = $1', [liker])).rowCount,
      verifs: (await db.query('select 1 from verifications where user_id = $1', [liker])).rowCount,
      swipes: (await db.query('select 1 from swipes where user_id = $1', [liker])).rowCount,
      leads: (await leadsFor(db)).length,
    }));
    expect(seen).toEqual({ users: 0, profiles: 0, verifs: 0, swipes: 0, leads: 0 });
  });

  it('stops an agent recording a decision on someone else’s lead', async () => {
    await expect(withUser(B.agentId, (db) => db.query(
      `insert into agent_swipes (agent_id, user_id, listing_id, direction) values ($1, $2, $3, 'right')`, [B.agentId, liker, listingA]))).rejects.toThrow(/row-level security/);
  });

  it('keeps renters out of each other’s data', async () => {
    const seen = await withUser(other, async (db) => ({
      users: (await db.query('select 1 from users where id = $1', [liker])).rowCount,
      verifs: (await db.query('select 1 from verifications where user_id = $1', [liker])).rowCount,
      swipes: (await db.query('select 1 from swipes where user_id = $1', [liker])).rowCount,
    }));
    expect(seen).toEqual({ users: 0, verifs: 0, swipes: 0 });
  });

  it('won’t let a renter award themselves a badge', async () => {
    await expect(withUser(other, (db) => db.query(
      `insert into verifications (user_id, type, status, provider) values ($1, 'id', 'passed', 'me')`, [other]))).rejects.toThrow(/row-level security|permission/);
  });

  it('cuts a removed agent off from their agency’s leads', async () => {
    const { withService } = await import('@/lib/db');
    const extra = await withService(async (db) => {
      const u = (await db.query(`insert into users (email, role) values ($1, 'agent') returning id`, [`gone-${Date.now()}@agency.test`])).rows[0].id;
      await db.query(`insert into agents (user_id, agency_id, role, removed_at) values ($1, $2, 'agent', now())`, [u, A.agencyId]);
      return u as string;
    });
    const n = await withUser(extra, (db) => leadsFor(db));
    expect(n).toEqual([]);
  });
});
