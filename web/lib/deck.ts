import 'server-only';
import { withUser } from './db';
import { houseCard, type HouseCard } from './housecard';
import { commuteMinutes, metres } from './geo';

export type DeckCard = HouseCard & { boosted: boolean; commute: { place: string; minutes: number; note: string } | null };

// The next cards for a renter (rentals) or investor (for sale). Boosted listings in the
// renter's area go first: that's the advertising product. Filters use listing facts and the
// user's own preferences only, never anything about other people.
export async function deckFor(userId: string, role: 'renter' | 'investor', limit = 15): Promise<DeckCard[]> {
  const { rows, prof } = await withUser(userId, async (db) => {
    const p = (await db.query('select * from profiles where user_id = $1', [userId])).rows[0] ?? {};
    const type = role === 'investor' ? 'sale' : 'rent';
    const params: unknown[] = [userId, type];
    const where = [`l.status = 'active'`, `l.type = $2`, `not exists (select 1 from swipes s where s.user_id = $1 and s.listing_id = l.id)`];
    if (role === 'renter' && p.max_rent_weekly) { params.push(Math.round(p.max_rent_weekly * 1.1)); where.push(`l.price <= $${params.length}`); }
    if (role === 'renter' && p.pets && p.pets !== 'none') where.push('l.pets_considered');
    if (role === 'investor' && p.max_price) { params.push(p.max_price); where.push(`l.price <= $${params.length}`); }
    if (role === 'investor' && p.property_kind && p.property_kind !== 'any') {
      params.push(p.property_kind === 'house' ? ['house', 'townhouse'] : ['unit']); where.push(`l.kind = any($${params.length})`);
    }
    params.push(limit * 2);
    const q = await db.query(
      `select l.id, (l.boosted_until > now()) as boosted from listings l where ${where.join(' and ')}
       order by (l.boosted_until > now()) desc nulls last, l.created_at desc limit $${params.length}`, params);
    return { rows: q.rows as { id: string; boosted: boolean }[], prof: p };
  });

  const out: DeckCard[] = [];
  for (const r of rows) {
    const c = await houseCard(r.id);
    if (!c) continue;
    if (role === 'investor') {
      const y = c.investor.grossYield.value as number | null;
      if (prof.min_yield && (y === null || y < Number(prof.min_yield))) continue;
      if (prof.no_risk_overlay && (c.investor.flood.value || c.investor.bushfire.value)) continue;
    }
    let commute: DeckCard['commute'] = null;
    if (prof.commute_lat != null && c.listing.lat != null && c.listing.lng != null) {
      const min = commuteMinutes(metres({ lat: c.listing.lat, lng: c.listing.lng }, { lat: prof.commute_lat, lng: prof.commute_lng }));
      commute = { place: prof.commute_place, minutes: min, note: 'Lumo estimate from distance' };
    }
    out.push({ ...c, boosted: r.boosted, commute });
    if (out.length >= limit) break;
  }
  return out;
}
