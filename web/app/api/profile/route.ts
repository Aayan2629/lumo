import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { PLACES } from '@/lib/geo';
import { json, parse, route } from '@/lib/http';

const num = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());

// Only fields the NSW standard application form allows. Deliberately no photo, social media,
// children, appearance or other protected-attribute fields.
const Body = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(['renter', 'investor']),
  moveIn: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  occupants: opt(num(1, 12)),
  pets: opt(z.enum(['none', 'cat', 'dog', 'other'])),
  maxRent: opt(num(100, 10000)),
  maxPrice: opt(num(100000, 20000000)),
  commute: opt(z.enum(PLACES.map((p) => p.id) as [string, ...string[]])),
  strategy: opt(z.enum(['growth', 'cashflow'])),
  minYield: opt(z.coerce.number().min(0).max(15)),
  kind: opt(z.enum(['any', 'house', 'unit'])),
  noRisk: z.boolean().optional(),
  consent: z.literal(true, { message: 'Please accept the collection notice' }),
});

export const POST = route(async (req: Request) => {
  const u = await apiUser(['renter', 'investor']);
  const b = await parse(req, Body);
  const place = PLACES.find((p) => p.id === b.commute);
  await withUser(u.id, async (db) => {
    await db.query('update users set name = $1, role = $2 where id = $3', [b.name, b.role, u.id]);
    await db.query(
      `insert into profiles (user_id, move_in_date, occupants, pets, max_rent_weekly, max_price, commute_place, commute_lat, commute_lng,
         investor_strategy, min_yield, property_kind, no_risk_overlay, consented_collection_at, onboarded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now(), now())
       on conflict (user_id) do update set move_in_date = $2, occupants = $3, pets = $4, max_rent_weekly = $5, max_price = $6,
         commute_place = $7, commute_lat = $8, commute_lng = $9, investor_strategy = $10, min_yield = $11, property_kind = $12,
         no_risk_overlay = $13, consented_collection_at = coalesce(profiles.consented_collection_at, now()), onboarded_at = coalesce(profiles.onboarded_at, now())`,
      [u.id, b.moveIn ?? null, b.occupants ?? null, b.pets ?? 'none', b.maxRent ?? null, b.maxPrice ?? null, place?.label ?? null, place?.lat ?? null, place?.lng ?? null,
        b.strategy ?? null, b.minYield ?? null, b.kind ?? 'any', !!b.noRisk]);
  });
  return json({ redirect: '/app/verify' });
});
