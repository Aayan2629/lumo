import 'server-only';
import { env } from './env';
import { withService, type Db } from './db';
import { liveMicroburbs, sampleMicroburbs, type Microburbs, type PropertyFacts, type SuburbFacts } from './providers/microburbs';

// houseCard(listingId) merges a listing with Microburbs property and suburb data into one
// card object. Cached: the card for 7 days, suburb data for 30 days. The browser never calls
// Microburbs; it only ever sees this card.
export const CARD_TTL_DAYS = 7;
export const SUBURB_TTL_DAYS = 30;

const g = globalThis as unknown as { __mb?: Microburbs };
export function microburbs(): Microburbs {
  if (!g.__mb) {
    if (env.provider('MICROBURBS') === 'live') g.__mb = liveMicroburbs();
    else {
      if (!env.allowMocks) throw new Error('Microburbs sample data is disabled: set MICROBURBS_PROVIDER=live and MICROBURBS_KEY');
      g.__mb = sampleMicroburbs();
    }
  }
  return g.__mb;
}
export function setMicroburbsForTests(mb: Microburbs) { g.__mb = mb; }

export type Metric = { label: string; value: number | string | boolean | null; display: string; source: string; asOf: string; estimate?: boolean; tone?: 'good' | 'warn' | 'bad' };

export type HouseCard = {
  listing: {
    id: string; type: 'rent' | 'sale'; kind: string; address: string; suburb: string; price: number; beds: number; baths: number;
    parking: number; petsConsidered: boolean; photos: string[]; description: string | null; lat: number | null; lng: number | null;
  };
  agentLicensed: boolean;
  photoCheck: { status: 'clear' | 'disclosed'; label: string };
  renter: Record<string, Metric>;
  investor: Record<string, Metric> & { comparables?: never };
  comparables: { address: string; price: number; date: string; beds: number | null }[];
  poweredBy: { name: 'Microburbs'; sample: boolean; asOf: string };
  builtAt: string;
};

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-AU');
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

export function vacancyTone(v: number | null): Metric['tone'] {
  if (v === null) return undefined;
  return v < 2 ? 'good' : v <= 3 ? 'warn' : 'bad';
}

export function buildCard(l: any, agencyLicensed: boolean, s: SuburbFacts, p: PropertyFacts | null): HouseCard {
  const src = s.sample ? 'Microburbs sample data' : 'Microburbs';
  const m = (label: string, value: Metric['value'], display: string, extra: Partial<Metric> = {}, asOf = s.asOf): Metric =>
    ({ label, value, display, source: src, asOf, ...extra });
  const median = l.kind === 'house' ? s.medianRentHouse : s.medianRentUnit;
  const vsMedian = l.type === 'rent' && median ? Math.round(((l.price - median) / median) * 100) : null;
  const flood = p ? p.flood : s.risks.floodPct > 0;
  const bushfire = p ? p.bushfire : s.risks.bushfirePct > 0;

  const renter: Record<string, Metric> = {
    medianRent: m('Suburb median rent', median, median ? `${money(median)}/wk` : 'No data'),
    rentVsMedian: m('This rent vs median', vsMedian, vsMedian === null ? 'No data' : vsMedian === 0 ? 'At the median' : `${Math.abs(vsMedian)}% ${vsMedian > 0 ? 'above' : 'below'}`,
      { tone: vsMedian === null ? undefined : vsMedian > 10 ? 'warn' : 'good' }),
    rentChange: m('Suburb rent, last 12 months', s.rentChange12mPct, s.rentChange12mPct === null ? 'No data' : pct(s.rentChange12mPct)),
    crime: m('Crime level', s.crime?.level ?? null, s.crime?.level ?? 'No data', { tone: s.crime?.level === 'High' ? 'bad' : s.crime?.level === 'Average' ? 'warn' : 'good' }),
    livability: m('Livability score', s.livability?.score ?? null, s.livability?.score != null ? `${s.livability.score}/100` : 'No data'),
    amenities: m('Amenities in suburb', s.amenities?.total ?? null, s.amenities ? `${s.amenities.cafes} cafes · ${s.amenities.shopping} shops · ${s.amenities.parks} parks` : 'No data'),
    schools: m('Schools and education', s.amenities?.education ?? null, s.amenities ? `${s.amenities.education} nearby` : 'No data'),
    flood: m('Flood overlay', flood, flood ? 'Flood risk on record' : 'None on record', { tone: flood ? 'bad' : 'good' }, p?.asOf ?? s.asOf),
    bushfire: m('Bushfire overlay', bushfire, bushfire ? 'Bushfire risk on record' : 'None on record', { tone: bushfire ? 'bad' : 'good' }, p?.asOf ?? s.asOf),
  };

  // Investor numbers are estimates, always labelled with source and date. Not financial advice.
  const rentEst = p?.rentEstimate ?? (l.kind === 'house' ? s.medianRentHouse : s.medianRentUnit);
  const yieldPct = l.type === 'sale' && rentEst ? Math.round(((rentEst * 52) / l.price) * 1000) / 10 : s.grossYieldPct;
  const investor: Record<string, Metric> = {
    grossYield: m('Gross rental yield (est.)', yieldPct, yieldPct != null ? `${yieldPct.toFixed(1)}%` : 'No data', { estimate: true, tone: yieldPct == null ? undefined : yieldPct >= 4 ? 'good' : yieldPct >= 3 ? 'warn' : 'bad' }, p?.asOf ?? s.asOf),
    rentEstimate: m('Rent estimate', rentEst, rentEst ? `${money(rentEst)}/wk` : 'No data', { estimate: true }, p?.asOf ?? s.asOf),
    growth5y: m('5-year growth (suburb)', s.growth5yPct, s.growth5yPct != null ? pct(s.growth5yPct) : 'No data', { estimate: true }),
    growth10y: m('10-year growth (suburb)', s.growth10yPct, s.growth10yPct != null ? pct(s.growth10yPct) : 'No data', { estimate: true }),
    vacancy: m('Vacancy rate', s.vacancyRatePct, s.vacancyRatePct != null ? `${s.vacancyRatePct.toFixed(1)}%` : 'No data', { tone: vacancyTone(s.vacancyRatePct) }),
    daysOnMarket: m('Days on market', s.daysOnMarket, s.daysOnMarket != null ? `${s.daysOnMarket} days` : 'No data'),
    development: m('Development applications, 12 months', s.developmentCount12m, s.developmentCount12m != null ? `${s.developmentCount12m} nearby` : 'No data', { tone: (s.developmentCount12m ?? 0) > 50 ? 'warn' : undefined }),
    valuation: m('Automated valuation', p?.valuation ?? null, p?.valuation ? money(p.valuation) : 'No data', { estimate: true }, p?.asOf ?? s.asOf),
    medianPrice: m('Suburb median price', s.medianSalePrice, s.medianSalePrice ? money(s.medianSalePrice) : 'No data'),
    flood: renter.flood,
    bushfire: renter.bushfire,
  };

  return {
    listing: {
      id: l.id, type: l.type, kind: l.kind, address: l.address, suburb: l.suburb, price: l.price, beds: l.beds, baths: l.baths,
      parking: l.parking, petsConsidered: l.pets_considered, photos: l.photos ?? [], description: l.description, lat: l.lat, lng: l.lng,
    },
    agentLicensed: agencyLicensed,
    // Basic check for the pilot: the agent's own disclosure. An image-forensics provider can
    // replace this behind the same field later.
    photoCheck: l.photos_edited_disclosed
      ? { status: 'disclosed', label: 'Agent says some photos are digitally edited' }
      : { status: 'clear', label: 'No edited photos disclosed or detected' },
    renter,
    investor: investor as HouseCard['investor'],
    comparables: p?.comparables ?? [],
    poweredBy: { name: 'Microburbs', sample: s.sample, asOf: s.asOf },
    builtAt: new Date().toISOString(),
  };
}

async function suburbFacts(db: Db, suburb: string): Promise<SuburbFacts> {
  const { rows } = await db.query(
    `select data_json from suburb_cache where suburb = $1 and fetched_at > now() - make_interval(days => $2)`, [suburb, SUBURB_TTL_DAYS]);
  if (rows[0]) return rows[0].data_json;
  const s = await microburbs().suburb(suburb);
  await db.query(
    `insert into suburb_cache (suburb, data_json, fetched_at) values ($1, $2, now())
     on conflict (suburb) do update set data_json = excluded.data_json, fetched_at = now()`, [suburb, s]);
  return s;
}

export async function houseCard(listingId: string, opts: { db?: Db } = {}): Promise<HouseCard | null> {
  const run = async (db: Db) => {
    const cached = await db.query(
      `select card_json from house_cards where listing_id = $1 and fetched_at > now() - make_interval(days => $2)`, [listingId, CARD_TTL_DAYS]);
    if (cached.rows[0]) return cached.rows[0].card_json as HouseCard;
    const { rows } = await db.query(
      `select l.*, a.licence_status from listings l join agencies a on a.id = l.agency_id where l.id = $1`, [listingId]);
    const l = rows[0];
    if (!l) return null;
    const s = await suburbFacts(db, l.suburb);
    const p = l.microburbs_property_id ? await microburbs().property(l.microburbs_property_id, l.suburb) : null;
    const card = buildCard(l, l.licence_status === 'current', s, p);
    await db.query(
      `insert into house_cards (listing_id, card_json, fetched_at) values ($1, $2, now())
       on conflict (listing_id) do update set card_json = excluded.card_json, fetched_at = now()`, [listingId, card]);
    return card;
  };
  return opts.db ? run(opts.db) : withService(run);
}

export async function invalidateCard(db: Db, listingId: string) {
  await db.query('delete from house_cards where listing_id = $1', [listingId]);
}
