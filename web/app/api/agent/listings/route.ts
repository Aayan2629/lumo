import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { withService, withUser } from '@/lib/db';
import { audit } from '@/lib/audit';
import { invalidateCard } from '@/lib/housecard';
import { json, parse, route } from '@/lib/http';

const SUBURBS = ['Surry Hills', 'Redfern', 'Waterloo', 'Zetland', 'Glebe', 'Pyrmont', 'Ultimo', 'Haymarket', 'Chippendale', 'Darlinghurst', 'Potts Point', 'Erskineville', 'Alexandria', 'Camperdown', 'Sydney'] as const;
const CENTRES: Record<string, [number, number]> = {
  'Surry Hills': [-33.8861, 151.2111], Redfern: [-33.8928, 151.2048], Waterloo: [-33.9003, 151.2063], Zetland: [-33.9078, 151.2093], Glebe: [-33.8798, 151.1866],
  Pyrmont: [-33.8698, 151.1944], Ultimo: [-33.879, 151.1975], Haymarket: [-33.8803, 151.205], Chippendale: [-33.887, 151.199], Darlinghurst: [-33.879, 151.2196],
  'Potts Point': [-33.8693, 151.2257], Erskineville: [-33.9026, 151.1857], Alexandria: [-33.905, 151.194], Camperdown: [-33.8889, 151.179], Sydney: [-33.8688, 151.2093],
};
const PHOTOS = ['living', 'kitchen', 'bedroom', 'lounge'];

const Create = z.object({
  address: z.string().trim().min(4).max(160),
  suburb: z.enum(SUBURBS),
  type: z.enum(['rent', 'sale']),
  kind: z.enum(['unit', 'house', 'townhouse']),
  price: z.coerce.number().int().min(100).max(50_000_000),
  beds: z.coerce.number().int().min(0).max(12),
  baths: z.coerce.number().int().min(0).max(12),
  parking: z.coerce.number().int().min(0).max(12),
  assignedAgentEmail: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().toLowerCase().email().optional()),
  petsConsidered: z.boolean().optional(),
  photosEdited: z.boolean().optional(),
  description: z.string().trim().max(2000).optional(),
});

export const POST = route(async (req: Request) => {
  const u = await apiUser(['agent']);
  const b = await parse(req, Create);
  const [lat, lng] = CENTRES[b.suburb];
  const id = await withUser(u.id, async (db) => {
    const { rows } = await db.query(
      `insert into listings (agency_id, assigned_agent_email, address, suburb, lat, lng, type, kind, price, beds, baths, parking, pets_considered,
         photos_edited_disclosed, description, photos)
       values (app_agency_id(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning id`,
      [b.assignedAgentEmail ?? u.email, b.address, b.suburb, lat, lng, b.type, b.kind, b.price, b.beds, b.baths, b.parking, !!b.petsConsidered, !!b.photosEdited,
        b.description ?? null, JSON.stringify(PHOTOS.map((p, i) => `/img/${PHOTOS[(i + b.address.length) % 4]}${i ? '-b' : ''}.jpg`))]);
    return rows[0].id as string;
  });
  // Microburbs property lookup (GNAF) would go here via /geocode/address; the card falls back
  // to suburb data until it's set.
  await withService((db) => audit(db, u.id, 'listing.create', id));
  return json({ redirect: `/agent/listings/${id}` });
});

const Patch = z.object({ id: z.string().uuid(), status: z.enum(['active', 'leased', 'sold', 'withdrawn']) });
export const PATCH = route(async (req: Request) => {
  const u = await apiUser(['agent']);
  const b = await parse(req, Patch);
  const n = await withUser(u.id, async (db) => (await db.query('update listings set status = $1 where id = $2', [b.status, b.id])).rowCount);
  if (!n) return json({ error: 'Listing not found' }, 404);
  await withService(async (db) => { await invalidateCard(db, b.id); await audit(db, u.id, `listing.${b.status}`, b.id); });
  return json({ message: 'Updated' });
});
