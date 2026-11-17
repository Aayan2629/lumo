import 'server-only';
import { env } from '../env';

// Microburbs is only ever called from the server. The key lives in MICROBURBS_KEY.
// lib/housecard.ts caches every answer (property 7 days, suburb 30 days), so one pull serves
// thousands of swipes.

export type SuburbFacts = {
  suburb: string;
  asOf: string;                       // ISO date the data was fetched
  sample: boolean;                    // true when it came from the offline sample set
  crime: { level: string; violentVsNationalPct: number | null } | null;
  livability: { score: number | null; safety: number | null; convenience: number | null } | null;
  risks: { floodPct: number; bushfirePct: number };
  medianRentUnit: number | null;      // $/week
  medianRentHouse: number | null;
  rentChange12mPct: number | null;
  vacancyRatePct: number | null;
  daysOnMarket: number | null;
  grossYieldPct: number | null;
  growth5yPct: number | null;
  growth10yPct: number | null;
  medianSalePrice: number | null;
  developmentCount12m: number | null;
  amenities: { total: number; cafes: number; shopping: number; parks: number; fitness: number; busStops: number; education: number } | null;
};

export type PropertyFacts = {
  gnafPid: string;
  asOf: string;
  sample: boolean;
  valuation: number | null;
  rentEstimate: number | null;
  flood: boolean;
  bushfire: boolean;
  saleHistory: { date: string; price: number }[];
  comparables: { address: string; price: number; date: string; beds: number | null }[];
};

export interface Microburbs {
  suburb(name: string): Promise<SuburbFacts>;
  property(gnafPid: string, suburb: string): Promise<PropertyFacts>;
  calls(): number;                    // API calls made by this instance, for the pitch numbers
}

const today = () => new Date().toISOString().slice(0, 10);
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

// ---------- parsing real Microburbs response shapes ----------
// Shapes match the sandbox answers saved in ../lumo/demo/cache (tests/fixtures/bondi.json).
type Raw = Record<string, any>;
export function parseSuburb(name: string, raw: Raw, sample = false): SuburbFacts {
  const crime = raw.crime_breakdown?.breakdown;
  const violent = Array.isArray(crime) ? crime.find((c: Raw) => c.type === 'violent') : null;
  const highs = Array.isArray(crime) ? crime.filter((c: Raw) => c.verdict === 'High').length : 0;
  const scores: Raw[] = raw.livability?.scores ?? [];
  const score = (k: string) => num(scores.find((s) => s.key === k)?.value);
  const series = (raw.median_rent_series?.unit ?? raw.median_rent_series?.house ?? []) as { date: string; value: number }[];
  const last = (xs: { value: number }[] | undefined) => (xs && xs.length ? xs[xs.length - 1].value : null);
  const change12 = (() => {
    if (series.length < 13) return null;
    const a = series[series.length - 13].value, b = series[series.length - 1].value;
    return a ? Math.round(((b - a) / a) * 1000) / 10 : null;
  })();
  const cats: Raw[] = raw.pois?.categories ?? [];
  const cat = (n: string) => cats.find((c) => c.category === n)?.count ?? 0;
  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const das: Raw[] = Array.isArray(raw.da_list) ? raw.da_list : [];
  const livScores = ['lifestyle', 'convenience', 'safety', 'family'].map(score).filter((x): x is number => x !== null);
  return {
    suburb: name,
    asOf: raw.as_of ?? today(),
    sample,
    crime: crime ? { level: highs >= 4 ? 'High' : highs >= 2 ? 'Average' : 'Low', violentVsNationalPct: num(violent?.diff_pct) } : null,
    livability: scores.length ? {
      score: livScores.length ? Math.round(livScores.reduce((a, b) => a + b, 0) / livScores.length) : null,
      safety: score('safety'), convenience: score('convenience'),
    } : null,
    risks: { floodPct: num(raw.risks?.flood?.coverage_pct) ?? 0, bushfirePct: num(raw.risks?.bushfire?.coverage_pct) ?? 0 },
    medianRentUnit: last(raw.median_rent_series?.unit),
    medianRentHouse: last(raw.median_rent_series?.house),
    rentChange12mPct: change12,
    vacancyRatePct: num(raw.vacancy_rate?.value ?? raw.vacancy_rate),
    daysOnMarket: num(raw.days_on_market?.value ?? raw.days_on_market),
    grossYieldPct: num(raw.yield_pct?.value ?? raw.yield_pct),
    growth5yPct: num(raw.price_growth?.growth_5y_pct ?? raw.price_growth?.['5y']),
    growth10yPct: num(raw.price_growth?.growth_10y_pct ?? raw.price_growth?.['10y']),
    medianSalePrice: num(raw.median_sale_price?.value ?? raw.median_sale_price),
    developmentCount12m: das.length ? das.filter((d) => (d.date ?? '') >= yearAgo).length : null,
    amenities: cats.length ? {
      total: raw.pois?.count ?? 0, cafes: cat('Restaurant / Cafe'), shopping: cat('Shopping'), parks: cat('Parks & Nature'),
      fitness: cat('Sport & Fitness'), busStops: cat('Bus Stop'), education: cat('Education'),
    } : null,
  };
}

// ---------- live client ----------
// Paths follow the Microburbs v1 API used by the Lumo extension. The hackathon key (ht26_...)
// covers the City of Sydney's 29 suburbs on api-ht. Check the market/* shapes against the API
// docs once a paid key is in place; they were not reachable from the build environment.
export function liveMicroburbs(): Microburbs {
  const key = env.req('MICROBURBS_KEY');
  const base = (env.opt('MICROBURBS_BASE') || (/^ht\d*_/.test(key) ? 'https://api-ht.microburbs.com.au' : 'https://api.microburbs.com.au'))
    .replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1';
  let count = 0;
  const get = async (path: string) => {
    count++;
    const res = await fetch(base + path, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    return ((await res.json()) as Raw).data ?? null;
  };
  return {
    calls: () => count,
    async suburb(name) {
      const S = '/suburbs/' + encodeURIComponent(name);
      const [crime_breakdown, livability, risks, median_rent_series, pois, da_list, days_on_market, vacancy_rate, yield_pct, price_growth, median_sale_price] =
        await Promise.all([
          get(S + '/crime/breakdown'), get(S + '/lifestyle/livability'), get(S + '/risks/all'), get(S + '/market/median-rent-series'),
          get(S + '/lifestyle/pois'), get(S + '/development/da-list'), get(S + '/market/days-on-market'), get(S + '/market/vacancy-rate'),
          get(S + '/market/yield-pct'), get(S + '/market/price-growth'), get(S + '/market/median-sale-price'),
        ]);
      return parseSuburb(name, { crime_breakdown, livability, risks, median_rent_series, pois, da_list, days_on_market, vacancy_rate, yield_pct, price_growth, median_sale_price });
    },
    async property(gnafPid) {
      const P = '/properties/' + encodeURIComponent(gnafPid);
      const [avm, risks, history, comps, rent] = await Promise.all([
        get(P + '/valuation/avm'), get(P + '/risks/all'), get(P + '/sale-history'), get(P + '/comparables/recent-sales-nearby'), get(P + '/rent-history'),
      ]);
      const list = (x: unknown): Raw[] => (Array.isArray(x) ? x : Array.isArray((x as Raw)?.results) ? (x as Raw).results : []);
      return {
        gnafPid, asOf: today(), sample: false,
        valuation: num(avm?.value ?? avm?.estimate),
        rentEstimate: num(list(rent).at(-1)?.price),
        flood: (num(risks?.flood?.coverage_pct) ?? 0) > 0 || (risks?.flood?.risk_band && risks.flood.risk_band !== 'none'),
        bushfire: (num(risks?.bushfire?.coverage_pct) ?? 0) > 0,
        saleHistory: list(history).map((h) => ({ date: h.date ?? h.sale_date, price: h.price })).filter((h) => h.date && h.price),
        comparables: list(comps).slice(0, 5).map((c) => ({
          address: c.area_name ?? c.address?.street ?? '', price: c.price, date: c.sale_date ?? c.date ?? '', beds: num(c.attributes?.bedrooms),
        })),
      };
    },
  };
}

// ---------- offline sample set (City of Sydney) ----------
// Plausible figures for the pilot area so the app runs without a key. Every card built from
// these says "Microburbs sample data" next to the date, so nobody mistakes it for live data.
const SAMPLE: Record<string, [rentUnit: number, rentHouse: number, vac: number, dom: number, yld: number, g5: number, g10: number, price: number, crime: string, liv: number, flood: number, das: number, amen: number]> = {
  'Surry Hills':  [780, 1250, 1.4, 28, 3.4, 18, 61, 1450000, 'Average', 86, 0, 41, 620],
  'Redfern':      [720, 1100, 1.6, 31, 3.6, 22, 70, 1320000, 'Average', 80, 0, 36, 410],
  'Waterloo':     [690, 980, 1.9, 35, 3.9, 14, 52, 980000, 'Average', 72, 3, 58, 260],
  'Zetland':      [760, 1150, 2.4, 40, 4.1, 9, 38, 1050000, 'Low', 74, 6, 64, 210],
  'Glebe':        [700, 1150, 1.5, 30, 3.3, 20, 66, 1600000, 'Low', 82, 2, 22, 340],
  'Pyrmont':      [820, 1400, 1.8, 33, 3.7, 12, 48, 1250000, 'Low', 84, 1, 19, 380],
  'Ultimo':       [650, 1000, 2.1, 38, 4.4, 10, 44, 890000, 'Average', 78, 0, 15, 300],
  'Haymarket':    [640, 950, 2.8, 45, 4.8, 6, 30, 780000, 'High', 76, 0, 27, 520],
  'Chippendale':  [690, 1050, 1.7, 32, 3.8, 19, 63, 1180000, 'Average', 81, 0, 17, 230],
  'Darlinghurst': [740, 1200, 1.5, 29, 3.5, 16, 58, 1380000, 'High', 85, 0, 24, 560],
  'Potts Point':  [720, 1300, 1.9, 34, 3.6, 13, 50, 1300000, 'Average', 83, 0, 18, 430],
  'Erskineville': [730, 1200, 1.3, 26, 3.2, 21, 68, 1700000, 'Low', 79, 1, 21, 190],
  'Alexandria':   [760, 1180, 2.2, 37, 3.9, 15, 55, 1500000, 'Low', 70, 9, 49, 240],
  'Camperdown':   [700, 1100, 1.4, 29, 3.5, 17, 60, 1550000, 'Low', 80, 0, 14, 260],
  'Sydney':       [880, 1500, 2.6, 42, 4.2, 5, 28, 1150000, 'High', 88, 1, 33, 1400],
};
function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

export function sampleMicroburbs(): Microburbs {
  let count = 0;
  return {
    calls: () => count,
    async suburb(name) {
      count++;
      const s = SAMPLE[name] ?? SAMPLE['Sydney'];
      const [ru, rh, vac, dom, yld, g5, g10, price, crime, liv, flood, das, amen] = s;
      return {
        suburb: name, asOf: today(), sample: true,
        crime: { level: crime, violentVsNationalPct: crime === 'High' ? 85 : crime === 'Average' ? 20 : -15 },
        livability: { score: liv, safety: crime === 'High' ? 41 : crime === 'Average' ? 58 : 74, convenience: Math.min(98, liv + 6) },
        risks: { floodPct: flood, bushfirePct: 0 },
        medianRentUnit: ru, medianRentHouse: rh, rentChange12mPct: 4 + (hash(name) % 50) / 10,
        vacancyRatePct: vac, daysOnMarket: dom, grossYieldPct: yld, growth5yPct: g5, growth10yPct: g10,
        medianSalePrice: price, developmentCount12m: das,
        amenities: { total: amen, cafes: Math.round(amen * 0.29), shopping: Math.round(amen * 0.17), parks: Math.max(3, Math.round(amen * 0.03)),
          fitness: Math.round(amen * 0.03), busStops: Math.round(amen * 0.05), education: Math.round(amen * 0.05) },
      };
    },
    async property(gnafPid, suburb) {
      count++;
      const s = SAMPLE[suburb] ?? SAMPLE['Sydney'];
      const h = hash(gnafPid);
      const val = Math.round((s[7] * (0.75 + (h % 60) / 100)) / 5000) * 5000;
      const years = [2016, 2019, 2022];
      return {
        gnafPid, asOf: today(), sample: true,
        valuation: val,
        rentEstimate: Math.round(s[0] * (0.85 + (h % 40) / 100) / 10) * 10,
        flood: s[10] > 3 && h % 3 === 0,
        bushfire: false,
        saleHistory: years.map((y, i) => ({ date: `${y}-0${(h % 8) + 1}-15`, price: Math.round(val * (0.62 + i * 0.13) / 1000) * 1000 })),
        comparables: [0, 1, 2, 3].map((i) => ({
          address: `${10 + ((h >> i) % 180)} ${['Crown', 'Bourke', 'Riley', 'Elizabeth', 'Cleveland'][(h + i) % 5]} St, ${suburb}`,
          price: Math.round(val * (0.9 + ((h >> (i + 3)) % 20) / 100) / 5000) * 5000,
          date: `2026-${String(((h >> i) % 9) + 1).padStart(2, '0')}-${String(((h >> (i + 2)) % 27) + 1).padStart(2, '0')}`,
          beds: 1 + ((h >> i) % 3),
        })),
      };
    },
  };
}
