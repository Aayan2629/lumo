import { withService } from '@/lib/db';
import { expiresAt } from '@/lib/badges';

let n = 0;
const uniq = () => `${Date.now().toString(36)}${n++}`;

export async function makeAgency(opts: { leasing?: string } = {}) {
  return withService(async (db) => {
    const id = uniq();
    const ag = (await db.query(
      `insert into agencies (name, licence_no, licence_status, licence_checked_at, leasing_email) values ($1, $2, 'current', now(), $3) returning id`,
      [`Agency ${id}`, String(Math.floor(Math.random() * 1e9)).padStart(9, '1'), opts.leasing ?? `leasing-${id}@agency.test`])).rows[0].id as string;
    const u = (await db.query(`insert into users (email, name, role) values ($1, 'Agent ${id}', 'agent') returning id`, [`agent-${id}@agency.test`])).rows[0].id as string;
    await db.query(`insert into agents (user_id, agency_id, role) values ($1, $2, 'owner')`, [u, ag]);
    return { agencyId: ag, agentId: u };
  });
}

export async function makeListing(agencyId: string, o: { assigned?: string | null; type?: 'rent' | 'sale'; price?: number; suburb?: string } = {}) {
  return withService(async (db) => (await db.query(
    `insert into listings (agency_id, assigned_agent_email, address, suburb, type, price, beds, baths, lat, lng, microburbs_property_id)
     values ($1, $2, $3, $4, $5, $6, 1, 1, -33.88, 151.21, $7) returning id`,
    [agencyId, o.assigned === undefined ? 'assigned@agency.test' : o.assigned, `${uniq()} Test St`, o.suburb ?? 'Surry Hills', o.type ?? 'rent', o.price ?? 700, `GANSW${uniq()}`])).rows[0].id as string);
}

export async function makeRenter(o: { verified?: boolean; role?: 'renter' | 'investor' } = {}) {
  return withService(async (db) => {
    const id = uniq();
    const u = (await db.query(`insert into users (email, name, role) values ($1, 'Mei Chen', $2) returning id`, [`renter-${id}@mail.test`, o.role ?? 'renter'])).rows[0].id as string;
    await db.query(`insert into profiles (user_id, max_rent_weekly, occupants, pets, onboarded_at, consented_collection_at) values ($1, 700, 1, 'none', now(), now())`, [u]);
    if (o.verified) {
      await db.query(`insert into verifications (user_id, type, status, result_band, provider, provider_ref, checked_at, expires_at) values ($1, 'id', 'passed', '2 documents', 'mock', $2, now(), $3)`, [u, `ref-${id}`, expiresAt('id')]);
      await db.query(`insert into verifications (user_id, type, status, result_band, provider, provider_ref, checked_at, expires_at) values ($1, 'income', 'passed', '2250-2500', 'mock', $2, now(), $3)`, [u, `bank-${id}`, expiresAt('income')]);
    }
    return u;
  });
}

export const swipe = (userId: string, listingId: string, direction = 'right') =>
  withService((db) => db.query(`insert into swipes (user_id, listing_id, direction) values ($1, $2, $3) on conflict (user_id, listing_id) do update set direction = excluded.direction`, [userId, listingId, direction]));
