import 'server-only';
import { withUser, type Db } from './db';
import { badgeLabels, badgesFor } from './badges';

export async function agentContext(userId: string) {
  return withUser(userId, async (db) => {
    const { rows } = await db.query(
      `select a.role as agent_role, g.* from agents a join agencies g on g.id = a.agency_id where a.user_id = $1`, [userId]);
    return rows[0] as { agent_role: 'owner' | 'agent'; id: string; name: string; licence_no: string; licence_status: string; leasing_email: string; plan: string; billing_status: string };
  });
}

export type Lead = {
  userId: string; listingId: string; firstName: string; likedAt: string; moveIn: string | null; occupants: number | null; pets: string | null;
  badges: { key: string; label: string; ok: boolean }[]; score: number; decision: 'right' | 'left' | null; matchId: string | null; matchStatus: string | null;
};

// Everyone who liked this agency's listings. Runs under RLS as the agent, so the database
// itself refuses rows for people who didn't like one of this agency's listings. Ordered by
// verified badges and how recently they liked: nothing about who the person is.
export async function leadsFor(db: Db, opts: { listingId?: string } = {}): Promise<Lead[]> {
  const params: unknown[] = [];
  let where = `s.direction = 'right' and l.agency_id = app_agency_id()`;
  if (opts.listingId) { params.push(opts.listingId); where += ` and l.id = $1`; }
  const { rows } = await db.query(
    `select s.user_id, s.listing_id, s.created_at, u.name, p.move_in_date, p.occupants, p.pets, l.type, l.price,
            x.direction as decision, m.id as match_id, m.status as match_status
     from swipes s join listings l on l.id = s.listing_id join users u on u.id = s.user_id
     left join profiles p on p.user_id = s.user_id
     left join agent_swipes x on x.listing_id = s.listing_id and x.user_id = s.user_id
     left join matches m on m.listing_id = s.listing_id and m.user_id = s.user_id
     where ${where} order by s.created_at desc limit 300`, params);
  const out: Lead[] = [];
  for (const r of rows) {
    const badges = badgeLabels(await badgesFor(db, r.user_id), { type: r.type, price: r.price });
    out.push({
      userId: r.user_id, listingId: r.listing_id, firstName: String(r.name ?? 'Verified renter').split(' ')[0], likedAt: r.created_at.toISOString(),
      moveIn: r.move_in_date ? new Date(r.move_in_date).toISOString().slice(0, 10) : null, occupants: r.occupants, pets: r.pets,
      badges, score: badges.filter((b) => b.ok).length, decision: r.decision, matchId: r.match_id, matchStatus: r.match_status,
    });
  }
  return out.sort((a, b) => b.score - a.score || b.likedAt.localeCompare(a.likedAt));
}
