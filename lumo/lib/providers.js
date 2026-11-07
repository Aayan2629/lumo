// Data providers. Each one turns a listing into plain facts Lumo can reason about.
// Add a new API here: write a function that returns facts, then call it in gatherFacts().
import { cached } from './store.js';
import { investFacts } from './invest.js';

const MB = 'https://api.microburbs.com.au/v1';

// ---------- helpers ----------
export function metres(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
// Street routes are longer than a straight line. 1.3x and 80 m a minute is a fair city walk.
export const walkMin = (m) => Math.max(1, Math.round((m * 1.3) / 80));
const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// ---------- Microburbs ----------
// snap: a saved copy of answers (demo listings only). Used when the live call fails, so the demo works offline.
function microburbs(key, snap) {
  const get = async (path, days = 7) => {
    try {
      return await cached('mb:' + path, days, async () => {
        const res = await fetch(MB + path, { headers: { Authorization: 'Bearer ' + (key || 'test') }, signal: AbortSignal.timeout(9000) });
        if (!res.ok) throw new Error('Microburbs ' + res.status + ' ' + path);
        return (await res.json()).data;
      });
    } catch (e) {
      if (snap?.paths && path in snap.paths) { snap.used = true; return snap.paths[path]; }
      throw e;
    }
  };
  return {
    get,
    async sal(name, state) {
      // The page can hand over { name, slug } instead of a name. Never send "[object Object]".
      if (name && typeof name === 'object') name = name.name || '';
      name = String(name || '').trim();
      if (!name) return null;
      if (typeof state !== 'string') state = '';
      const list = await get('/geocode/suburb?q=' + encodeURIComponent(name) + (state ? '&state=' + encodeURIComponent(state) : ''), 90);
      const n = name.toLowerCase();
      const hit = (list || []).find((x) => x.area_name.toLowerCase() === n) || (list || []).find((x) => x.area_name.toLowerCase().startsWith(n + ' ('));
      return hit ? hit.area_name : null;
    },
    // Up to 10 candidates come back, ranked by text match. The top one can be the whole building or the
    // unit next door, and its rent and sale history would then be someone else's. So only take a candidate
    // whose street address is this one exactly (same unit, same number, same street). No exact match:
    // return null, and gatherFacts finds the home in the suburb's listings instead.
    async gnaf(address, suburb) {
      const list = await get('/geocode/address?address=' + encodeURIComponent(address), 90);
      const loose = (k) => k.replace(/\b([a-z]*)0+(\d)/g, '$1$2');   // "G05/278" = "G5/278"
      const want = loose(streetKey(address));
      if (!want || !/\d/.test(want)) return null;
      const sub = String(suburb || '').toLowerCase();
      const hit = (list || []).find((c) => {
        const names = [c.name, c.display_name, c.abbr].filter(Boolean);
        const same = names.some((n) => loose(streetKey(n)) === want || loose(streetKey(n.replace(new RegExp('\\s+' + sub.replace(/[^a-z ]/g, '') + '$', 'i'), ''))) === want);
        // Must END in this suburb: "Bondi" is not "Bondi Junction".
        const subRe = new RegExp('(^|[,\\s])' + sub.replace(/[^a-z' -]/g, '') + '(\\s*,?\\s*(nsw|vic|qld|sa|wa|tas|act|nt))?(\\s*\\d{4})?\\s*$', 'i');
        const inSuburb = !sub || names.some((n) => subRe.test(n.trim()));
        return c.id && same && inSuburb;
      });
      return hit ? hit.id : null;
    }
  };
}

// "Unit 9, 47 Penkivil St" and "9/47 Penkivil Street, Bondi NSW" both become "9/47 penkivil street".
const ABBR = { st: 'street', rd: 'road', ave: 'avenue', av: 'avenue', pde: 'parade', cres: 'crescent', cr: 'crescent', pl: 'place', ln: 'lane', dr: 'drive', hwy: 'highway', cct: 'circuit', tce: 'terrace', cl: 'close', ct: 'court', blvd: 'boulevard', esp: 'esplanade', gr: 'grove', sq: 'square' };
export function streetKey(a) {
  let s = String(a || '').toLowerCase().split(',').length > 1 && /^(unit|apartment|apt|flat|suite|shop|level|villa|townhouse)\b/.test(String(a).toLowerCase())
    ? String(a).toLowerCase().replace(/^(?:unit|apartment|apt|flat|suite|shop|villa|townhouse)\s+([\w-]+)\s*,\s*/, '$1/')
    : String(a || '').toLowerCase();
  s = s.split(',')[0].replace(/^(?:unit|apartment|apt|flat|suite|villa|townhouse)\s+([\w-]+)\s*\/?\s*/, '$1/').replace(/\s*\/\s*/g, '/').replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
  return s.split(' ').map((w) => ABBR[w] || w).join(' ');
}

// Similar listings right now in the same suburb: same type, same bedrooms.
function comparables(results, L, home) {
  const type = /house|town|villa|terrace|duplex|semi/i.test(L.type || '') ? 'House' : 'Unit';
  const beds = (results || []).filter((x) =>
    x.price > 100 && x.price < 20000 &&
    (x.property_type || '').toLowerCase() === type.toLowerCase() &&
    Math.round(x.attributes?.bedrooms || 0) === Math.round(L.beds || 0) &&
    !(L.gnaf && x.gnaf_pid === L.gnaf) &&
    // Skip this same listing (same spot, same price), so it doesn't compare against itself.
    !(home && x.coordinates && x.price === L.price && metres(home, { lat: x.coordinates.latitude, lng: x.coordinates.longitude }) < 40));
  // Same bathrooms too when there are enough: a second bathroom lifts the rent.
  const baths = L.baths ? beds.filter((x) => x.attributes?.bathrooms == null || Math.round(x.attributes.bathrooms) === Math.round(L.baths)) : [];
  const same = baths.length >= 3 ? baths : beds;
  const withPark = same.filter((x) => x.attributes?.garage_spaces > 0).map((x) => x.price);
  const without = same.filter((x) => !(x.attributes?.garage_spaces > 0)).map((x) => x.price);
  return {
    type, beds: L.beds, n: same.length,
    median: median(same.map((x) => x.price)),
    withPark: { n: withPark.length, median: median(withPark) },
    without: { n: without.length, median: median(without) },
    prices: same.map((x) => x.price),
    // The closest similar homes first, with how far each one is from this home.
    sample: same.map((x) => {
      const c = x.coordinates && { lat: x.coordinates.latitude, lng: x.coordinates.longitude };
      return { address: x.address?.street, price: x.price, park: x.attributes?.garage_spaces || 0, date: x.listing_date, lat: c?.lat, lng: c?.lng, d: home && c ? metres(home, c) : null };
    }).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9)).slice(0, 8)
  };
}

// Points of interest from Microburbs, measured from the home.
const LATE = /^(pub|bar|nightclub|night_club|live_music|karaoke)$/;
function nearbyFromPois(pois, home, profile) {
  const feats = (pois?.pois?.features || []).map((f) => ({
    name: f.properties.name, cat: f.properties.category, sub: (f.properties.subtype || '').toLowerCase(),
    lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0]
  })).map((p) => ({ ...p, d: metres(home, p) }));
  const byD = (a, b) => a.d - b.d;
  const venues = feats.filter((p) => LATE.test(p.sub)).sort(byD);
  const pick = (re, want) => {
    const all = feats.filter((p) => re.test(p.sub) || re.test(p.cat.toLowerCase())).sort(byD);
    const mine = want ? all.filter((p) => p.name.toLowerCase().includes(want.toLowerCase())) : [];
    return { nearest: all[0] || null, mine: mine[0] || null, count500: all.filter((p) => p.d <= 500).length };
  };
  return {
    venues150: venues.filter((p) => p.d <= 150).map(({ name, sub, d, lat, lng }) => ({ name, sub, d, lat, lng })),
    venues300: venues.filter((p) => p.d <= 300).length,
    gym: pick(/gym|fitness/),
    supermarket: pick(/supermarket|grocery/),
    _gyms: feats.filter((p) => /gym|fitness/.test(p.sub)).map(({ name, d, lat, lng }) => ({ name, d, lat, lng })),
    _shops: feats.filter((p) => /supermarket|grocery/.test(p.sub)).map(({ name, d, lat, lng }) => ({ name, d, lat, lng })),
    parks: pick(/park|nature/),
    // Some 'beach' points are suburb centroids named like 'Bondi, New South Wales, Australia'. Skip those.
    beach: (() => { const b = feats.filter((p) => p.sub === 'beach' && !/, (New South Wales|NSW|Australia)|hotel|international|backpackers|apartments|motel/i.test(p.name)).sort(byD); return { nearest: b[0] || null, mine: null }; })(),
    cafes300: feats.filter((p) => /^(cafe|restaurant|bakery|coffee_shop)$/.test(p.sub) && p.d <= 300).length,
    busStop: feats.filter((p) => p.sub === 'bus_stop').sort(byD).slice(0, 1).map(({ name, d, lat, lng }) => ({ name, d, lat, lng }))[0] || null,
    // Microburbs tags some non-stations as stations (we saw a substation), so filter names.
    stations: feats.filter((p) => p.sub === 'train_station' && !/substation|electric/i.test(p.name)).sort(byD).slice(0, 2)
      .map(({ name, d, lat, lng }) => ({ name, d, lat, lng, mode: 'train' }))
  };
}

// ---------- OpenStreetMap (free, no key) ----------
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
let overpassDownUntil = 0;
// Ask every Overpass server at once and take the first good answer (max ~6 s).
// If they all fail, don't try again for 5 minutes; the snapshot covers the demo area meanwhile.
async function overpass(q) {
  if (Date.now() < overpassDownUntil) throw new Error('OSM servers busy');
  try {
    return await Promise.any(OVERPASS.map(async (url) => {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error('OSM ' + res.status);
      return (await res.json()).elements || [];
    }));
  } catch (e) { overpassDownUntil = Date.now() + 5 * 60 * 1000; throw new Error('OSM servers busy'); }
}
// Offline OpenStreetMap snapshot for the demo area (Bondi Junction to Bondi Beach), used when Overpass is down.
let SNAP = null;
async function osmSnapshot(home) {
  SNAP = SNAP || (await (await fetch(chrome.runtime.getURL('data/osm-east.json'))).json());
  const [x0, y0, x1, y1] = SNAP.bbox;
  return home.lng >= x0 && home.lng <= x1 && home.lat >= y0 && home.lat <= y1 ? SNAP : null;
}
function nearbyFromSnapshot(snap, home) {
  const withD = snap.pois.map((p) => ({ ...p, d: metres(home, p) })).sort((a, b) => a.d - b.d);
  return {
    venues150: withD.filter((p) => p.kind === 'venue' && p.d <= 150).map((p) => ({ name: p.name, sub: 'bar', d: p.d, lat: p.lat, lng: p.lng })),
    stations: withD.filter((p) => p.kind === 'station').slice(0, 2).map((p) => ({ name: p.name, d: p.d, lat: p.lat, lng: p.lng, mode: 'train' })),
    lightRail: null, busStop: null,
    gyms: withD.filter((p) => p.kind === 'gym'), shops: withD.filter((p) => p.kind === 'supermarket'), snapshot: true
  };
}

async function osmNearby(home) {
  try { return await osmLive(home); }
  catch (e) { const snap = await osmSnapshot(home); if (snap) return nearbyFromSnapshot(snap, home); throw e; }
}
async function osmLive(home) {
  const A = (r) => `(around:${r},${home.lat},${home.lng})`;
  const q = `[out:json][timeout:20];(
    node${A(150)}[amenity~"^(pub|bar|nightclub)$"];
    node${A(2500)}[railway~"^(station|halt|tram_stop)$"];
    node${A(400)}[highway=bus_stop];
    nwr${A(3000)}[leisure=fitness_centre];
    nwr${A(3000)}[shop=supermarket];);out center tags;`;
  return cached('osm2:' + home.lat.toFixed(4) + ',' + home.lng.toFixed(4), 30, async () => {
    const els = await overpass(q);
    const withD = els.map((e) => { const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon; return { ...e.tags, lat, lng, d: metres(home, { lat, lng }) }; }).sort((a, b) => a.d - b.d);
    return {
      venues150: withD.filter((t) => /pub|bar|nightclub/.test(t.amenity || '')).map((t) => ({ name: t.name || 'Licensed venue', sub: t.amenity, d: t.d, lat: t.lat, lng: t.lng })),
      stations: withD.filter((t) => t.railway === 'station' || t.railway === 'halt').slice(0, 2).map((t) => ({ name: t.name || 'Station', d: t.d, lat: t.lat, lng: t.lng, mode: t.station === 'light_rail' ? 'light rail' : t.station === 'subway' ? 'metro' : 'train' })),
      lightRail: withD.filter((t) => t.railway === 'tram_stop').slice(0, 1).map((t) => ({ name: t.name || 'Light rail', d: t.d }))[0] || null,
      busStop: withD.filter((t) => t.highway === 'bus_stop').slice(0, 1).map((t) => ({ name: t.name || 'Bus stop', d: t.d, lat: t.lat, lng: t.lng }))[0] || null,
      gyms: withD.filter((t) => t.leisure === 'fitness_centre').map((t) => ({ name: t.name || t.brand || 'Gym', brand: t.brand, d: t.d, lat: t.lat, lng: t.lng })),
      shops: withD.filter((t) => t.shop === 'supermarket').map((t) => ({ name: t.name || t.brand || 'Supermarket', brand: t.brand, d: t.d, lat: t.lat, lng: t.lng }))
    };
  });
}

// ---------- Walking routes (OSRM on OpenStreetMap, free) ----------
async function walkRoute(from, to) {
  const key = 'rt:' + [from.lat, from.lng, to.lat, to.lng].map((x) => x.toFixed(5)).join(',');
  return cached(key, 30, async () => {
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('route ' + res.status);
    const r = (await res.json()).routes?.[0];
    if (!r) return null;
    return { metres: Math.round(r.distance), minutes: Math.max(1, Math.round(r.duration / 60)), line: r.geometry.coordinates.map(([lng, lat]) => [+lat.toFixed(6), +lng.toFixed(6)]) };
  });
}

// Distance in metres from point p to the street segment a-b (flat projection is fine at street scale).
function segDist(p, a, b) {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111320, K = 110540;
  const ax = (a.lng - p.lng) * k, ay = (a.lat - p.lat) * K, bx = (b.lng - p.lng) * k, by = (b.lat - p.lat) * K;
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}
const nearWay = (p, w, r) => w.pts.some((q, i) => i && segDist(p, w.pts[i - 1], q) <= r);

// Points every ~20 m along a route, so lighting can be judged stretch by stretch.
function resample(line, step = 20) {
  const out = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = { lat: line[i][0], lng: line[i][1] }, b = { lat: line[i + 1][0], lng: line[i + 1][1] };
    const n = Math.max(1, Math.round(metres(a, b) / step));
    for (let k = 0; k < n; k++) out.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lng: a.lng + ((b.lng - a.lng) * k) / n });
  }
  if (line.length) out.push({ lat: line[line.length - 1][0], lng: line[line.length - 1][1] });
  return out;
}

// Street lighting along a walk, from OpenStreetMap: mapped street lamps and streets tagged lit=yes/no.
// A stretch counts as lit with a lamp within 30 m or a lit street within 15 m. If OSM has no lighting data
// for a stretch, it stays unknown rather than being called dark.
async function lighting(route, extraLamps = []) {
  const pts = route.line.filter((_, i, a) => i % Math.ceil(a.length / 60) === 0 || i === a.length - 1);
  const poly = pts.map(([a, b]) => a + ',' + b).join(',');
  let lamps, ways, source = 'live';
  try {
    const els = await cached('lit:' + poly.length + ':' + poly.slice(0, 60), 30, () =>
      overpass(`[out:json][timeout:20];(node(around:30,${poly})[highway=street_lamp];way(around:20,${poly})[highway][lit];way(around:20,${poly})[highway~"^(primary|secondary|trunk|tertiary)(_link)?$"][!lit];);out tags geom;`));
    lamps = els.filter((e) => e.type === 'node').map((e) => ({ lat: e.lat, lng: e.lon }));
    // Main roads with no lit tag count as 'main': almost always lit in Sydney, shown separately as likely lit.
    ways = els.filter((e) => e.type === 'way' && e.geometry).map((e) => ({ lit: e.tags.lit || 'main', pts: e.geometry.map((g) => ({ lat: g.lat, lng: g.lon })) }));
  } catch (e) {
    // Overpass busy: use the saved snapshot when the walk is inside it.
    const snap = await osmSnapshot({ lat: pts[0][0], lng: pts[0][1] });
    if (!snap && !extraLamps.length) throw e;
    if (!snap) { lamps = []; ways = []; source = 'council'; } else {
    const near = (p, r) => pts.some(([a, b]) => metres({ lat: a, lng: b }, p) <= r + 60);
    lamps = snap.lamps.map(([lat, lng]) => ({ lat, lng })).filter((p) => near(p, 30));
    const routePts = pts.map(([lat, lng]) => ({ lat, lng }));
    ways = snap.litways.map((w) => ({ lit: w.lit, pts: w.pts.map(([lat, lng]) => ({ lat, lng })) })).filter((w) => routePts.some((p) => nearWay(p, w, 60)));
    source = 'snapshot';
  } }
  // Council street lights (City of Sydney) are the best source where they exist.
  if (extraLamps.length) { lamps = lamps.concat(extraLamps.filter((l) => pts.some(([a, b]) => metres({ lat: a, lng: b }, l) <= 90))); source = source === 'snapshot' ? 'council + saved map' : 'council + map'; }
  const samples = resample(route.line).map((p) => {
    if (lamps.some((l) => metres(p, l) <= 30)) return { ...p, s: 'lit' };
    // The street you're walking on: the closest tagged street segment within 16 m.
    let best = null, bd = 16;
    for (const w of ways) for (let i = 1; i < w.pts.length; i++) { const d = segDist(p, w.pts[i - 1], w.pts[i]); if (d < bd) { bd = d; best = w; } }
    return { ...p, s: best ? (best.lit === 'no' ? 'dark' : best.lit === 'main' ? 'main' : best.lit === 'yes' || best.lit === '24/7' || best.lit === 'automatic' ? 'lit' : 'unknown') : 'unknown' };
  });
  const known = samples.filter((x) => x.s !== 'unknown');
  return { samples, lamps: lamps.slice(0, 200), lampCount: lamps.length, lightSource: source,
    knownPct: Math.round((known.length / Math.max(1, samples.length)) * 100),
    litPct: known.length ? Math.round((known.filter((x) => x.s === 'lit' || x.s === 'main').length / known.length) * 100) : null,
    mainPct: Math.round((samples.filter((x) => x.s === 'main').length / Math.max(1, samples.length)) * 100) };
}

// Your chosen gyms and supermarkets: the nearest branch of each brand, from Microburbs and OpenStreetMap.
function brands(wanted, ...lists) {
  const all = lists.flat().filter(Boolean);
  return wanted.filter(Boolean).map((b) => {
    const w = b.toLowerCase().replace(/ fitness$/, '');
    const hit = all.filter((p) => (p.name + ' ' + (p.brand || '')).toLowerCase().includes(w)).sort((a, b2) => a.d - b2.d)[0];
    return hit ? { brand: b, name: hit.name, d: hit.d, lat: hit.lat, lng: hit.lng } : { brand: b, missing: true };
  });
}

// ===================== Government and open data =====================

const title = (x) => String(x || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const yearsAgo = (n) => new Date(Date.now() - n * 365 * 864e5).toISOString().slice(0, 10);
const json = async (url, opts = {}, ms = 8000) => {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(new URL(url).host + ' ' + res.status);
  return res.json();
};

// ---------- NSW Spatial Services (NSW Government) ----------
const SIX = 'https://portal.spatial.nsw.gov.au/server/rest/services';
// Train, metro and light rail stations within 3 km, from the state's Features of Interest layer.
async function nswStations(home) {
  return cached('six-st:' + home.lat.toFixed(3) + home.lng.toFixed(3), 60, async () => {
    const j = await json(`${SIX}/NSW_FOI_Transport_Facilities/MapServer/1/query?geometry=${home.lng},${home.lat}&geometryType=esriGeometryPoint&inSR=4326&distance=3000&units=esriSRUnit_Meter&outFields=generalname&returnGeometry=true&outSR=4326&f=json`);
    return (j.features || []).map((f) => {
      const raw = f.attributes.generalname || '';
      const p = { lat: f.geometry.y, lng: f.geometry.x };
      return { name: title(raw.replace(/ (RAILWAY|METRO|LIGHT RAIL|TRAIN) STATION$/i, '')), ...p, d: metres(home, p), mode: /LIGHT RAIL/i.test(raw) ? 'light rail' : /METRO/i.test(raw) ? 'metro' : 'train' };
    }).sort((a, b) => a.d - b.d);
  });
}
// Which council the home is in (needed for planning data).
async function nswCouncil(home) {
  return cached('six-lga:' + home.lat.toFixed(3) + home.lng.toFixed(3), 180, async () => {
    const j = await json(`${SIX}/NSW_Administrative_Boundaries_Theme/MapServer/8/query?geometry=${home.lng},${home.lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=lganame,councilname&returnGeometry=false&f=json`);
    const a = j.features?.[0]?.attributes;
    return a ? { lga: title(a.lganame), council: title(a.councilname).replace(/ Of The /, ' of the ') } : null;
  });
}

// ---------- NSW Planning Portal: development applications (open data, since 2019) ----------
const DA_URL = 'https://api.apps1.nsw.gov.au/eplanning/data/v0/OnlineDA';
const trimDA = (a) => {
  const loc = (a.Location || [])[0] || {};
  const lat = parseFloat(loc.Y), lng = parseFloat(loc.X);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng, a.NumberOfStoreys || 0, a.NumberOfNewDwellings || 0, a.ApplicationStatus, a.ApplicationType, a.LodgementDate, title(loc.FullAddress), (a.DevelopmentType || []).map((t) => t.DevelopmentType).join('; ').slice(0, 90), Math.round(a.CostOfDevelopment || 0)];
};
// Saved copies for the two demo councils, so the demos answer fast and offline.
const DA_SEEDS = { waverley: 'da-waverley.json', 'lake macquarie': 'da-lake-macquarie.json' };
async function councilDAs(council) {
  const file = Object.entries(DA_SEEDS).find(([k]) => council.toLowerCase().includes(k))?.[1];
  const seed = file ? () => fetch(chrome.runtime.getURL('data/' + file)).then((r) => r.json()).then((j) => j.rows) : null;
  return cached('da:' + council, 7, async () => {
    // The portal can take 10+ seconds. For the demo council, answer from the saved copy after 4 s.
    const live = (async () => {
      const page = (n) => json(DA_URL, { headers: { PageSize: '1000', PageNumber: String(n), filters: JSON.stringify({ filters: { CouncilName: [council], LodgementDateFrom: yearsAgo(2) } }) } }, 15000);
      const first = await page(1);
      const rest = await Promise.all(Array.from({ length: Math.min(3, first.TotalPages || 1) - 1 }, (_, i) => page(i + 2)));
      return [first, ...rest].flatMap((x) => x.Application || []).map(trimDA).filter(Boolean);
    })();
    if (!seed) return live;
    return Promise.race([live.catch(seed), new Promise((r) => setTimeout(r, 4000)).then(seed)]);
  });
}
// Building work that could change a rental: new buildings, extra storeys, demolition, within 300 m.
async function nearbyDAs(home, council) {
  const rows = await councilDAs(council);
  return rows.map(([lat, lng, storeys, dwellings, status, type, date, address, kinds, cost]) => ({ lat, lng, storeys, dwellings, status, type, date, address, kinds, cost, d: metres(home, { lat, lng }) }))
    .filter((x) => x.d <= 300 && !/withdrawn|rejected|refused/i.test(x.status) && !/modification/i.test(x.type || '') &&
      (x.storeys >= 3 || x.dwellings >= 2 || /demolition|residential flat|shop top|mixed use|boarding|seniors|new multi/i.test(x.kinds)))
    .filter((x, i, all) => all.findIndex((y) => y.address === x.address && y.storeys === x.storeys) === i)   // one entry per site
    .sort((a, b) => a.d - b.d).slice(0, 12);
}

// ---------- ABS Census 2021 (by postcode) ----------
async function census(postcode) {
  return cached('abs:' + postcode, 365, async () => {
    const j = await json(`https://data.api.abs.gov.au/rest/data/ABS,C21_G02_POA,1.0.0/2+4+6+7.${postcode}..?format=jsondata&dimensionAtObservation=AllDimensions`, { headers: { Accept: 'application/vnd.sdmx.data+json' } });
    const dims = j.data.structures[0].dimensions.observation, obs = j.data.dataSets[0].observations, out = {};
    const key = { 2: 'personalIncome', 4: 'householdIncome', 6: 'medianRent', 7: 'perBedroom' };
    for (const [k, v] of Object.entries(obs)) out[key[dims[0].values[+k.split(':')[0]].id]] = v[0];
    return out.medianRent ? { ...out, year: 2021, postcode } : null;
  });
}

// ---------- City of Sydney open data (only inside the City of Sydney council area) ----------
const COS = 'https://services1.arcgis.com/cNVyNtjGVZybOQWZ/arcgis/rest/services';
async function cosPoints(layer, bbox) {
  const [x0, y0, x1, y1] = bbox;
  const j = await json(`${COS}/${layer}/FeatureServer/0/query?geometry=${x0},${y0},${x1},${y1}&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OBJECTID&returnGeometry=true&resultRecordCount=2000&f=json`);
  return (j.features || []).map((f) => ({ lat: f.geometry.y, lng: f.geometry.x }));
}
async function cosNearHome(home) {
  const g = `geometry=${home.lng},${home.lat}&geometryType=esriGeometryPoint&inSR=4326&units=esriSRUnit_Meter`;
  const [trees, late] = await Promise.all([
    json(`${COS}/Trees/FeatureServer/0/query?${g}&distance=100&returnCountOnly=true&f=json`).then((j) => j.count).catch(() => null),
    json(`${COS}/Sydney_Development_Control_Plan_2012/FeatureServer/10/query?${g}&distance=100&outFields=*&returnGeometry=false&f=json`).then((j) => (j.features || []).length).catch(() => null)
  ]);
  return { trees100: trees, lateNightStreet: late > 0 };
}
const routeBox = (line, pad = 0.0005) => {
  const la = line.map((p) => p[0]), ln = line.map((p) => p[1]);
  return [Math.min(...ln) - pad, Math.min(...la) - pad, Math.max(...ln) + pad, Math.max(...la) + pad];
};

// ---------- Mapillary street photos (free token) ----------
async function streetPhotos(home, token) {
  // About 150 m around the house; closest photos first, newest breaks ties.
  const d = 0.0014;
  const j = await json(`https://graph.mapillary.com/images?access_token=${encodeURIComponent(token)}&fields=id,thumb_1024_url,captured_at,computed_geometry,geometry&bbox=${home.lng - d},${home.lat - d},${home.lng + d},${home.lat + d}&limit=60`);
  return (j.data || []).map((x) => {
    const [lng, lat] = (x.computed_geometry || x.geometry || {}).coordinates || [];
    return { ...x, dist: lat ? metres(home, { lat, lng }) : 999 };
  }).sort((a, b) => Math.round(a.dist / 40) - Math.round(b.dist / 40) || b.captured_at - a.captured_at).slice(0, 6)
    .map((x) => ({ id: x.id, url: x.thumb_1024_url, d: Math.round(x.dist), date: new Date(x.captured_at).toISOString().slice(0, 10), link: 'https://www.mapillary.com/app/?pKey=' + x.id }));
}

// ---------- Overture Maps places (bundled for Greater Sydney) ----------
let PLACES = null;
async function placesNear(home, r = 3000) {
  PLACES = PLACES || (await (await fetch(chrome.runtime.getURL('data/places-sydney.json'))).json());
  const dLat = r / 110540, dLng = r / (Math.cos((home.lat * Math.PI) / 180) * 111320);
  return PLACES.rows.filter(([, , , lat, lng]) => Math.abs(lat - home.lat) < dLat && Math.abs(lng - home.lng) < dLng)
    .map(([kind, name, brand, lat, lng]) => ({ kind, name, brand, lat, lng, d: metres(home, { lat, lng }) })).filter((p) => p.d <= r).sort((a, b) => a.d - b.d);
}

// ---------- Your rent model (hackathon Task 4) ----------
// Two ways in: a URL that answers with a price, or the CSV you submit, imported in Settings.
async function rentModel(L, S) {
  if (L.gnaf) {
    const { rentcsv } = await chrome.storage.local.get('rentcsv');
    const row = rentcsv && rentcsv[L.gnaf];
    if (row) return { with: row[0], without: row[1], source: 'Your rent model (CSV)' };
  }
  if (!S.rentModelUrl) return null;
  const res = await fetch(S.rentModelUrl, {
    signal: AbortSignal.timeout(8000),
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gnaf_id: L.gnaf, address: L.address, suburb: L.suburb, beds: L.beds, baths: L.baths, parking: L.parking, property_type: L.type, lat: L.lat, lng: L.lng })
  });
  if (!res.ok) throw new Error('Rent model ' + res.status);
  const j = await res.json();
  return { with: j.rent_with_car_space ?? j.with, without: j.rent_without_car_space ?? j.without, source: 'Your rent model' };
}

// ---------- Commute to your places (Google Maps) ----------
// With a Google Maps key: real transit times leaving 8 am next Monday (Routes API).
// Without one: an estimate from distance, clearly labelled, plus a Google Maps link for the exact trip.
function nextMonday8() {
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(8, 0, 0, 0);
  return d.toISOString();
}
// ---------- Transport for NSW Trip Planner (free key: opendata.transport.nsw.gov.au) ----------
const MODE = { 1: 'train', 2: 'metro', 4: 'light rail', 5: 'bus', 7: 'coach', 9: 'ferry', 11: 'school bus' };
const pad = (n) => String(n).padStart(2, '0');
// The next given weekday (0 = Sunday) at a set time, local Sydney time.
function nextDay(dow, hh, mm) { const d = new Date(); d.setDate(d.getDate() + ((dow + 7 - d.getDay()) % 7 || 7)); d.setHours(hh, mm, 0, 0); return d; }
export async function tfnswTrips(from, to, when, key) {
  const pt = (p) => `${p.lng.toFixed(6)}:${p.lat.toFixed(6)}:EPSG:4326`;
  const q = new URLSearchParams({
    outputFormat: 'rapidJSON', coordOutputFormat: 'EPSG:4326', depArrMacro: 'dep',
    itdDate: `${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}`, itdTime: pad(when.getHours()) + pad(when.getMinutes()),
    type_origin: 'coord', name_origin: pt(from), type_destination: 'coord', name_destination: pt(to),
    calcNumberOfTrips: '4', TfNSWTR: 'true', version: '10.2.1.42'
  });
  const res = await fetch('https://api.transport.nsw.gov.au/v1/tp/trip?' + q, { headers: { Authorization: 'apikey ' + key }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error('Transport for NSW ' + res.status);
  const j = await res.json();
  return (j.journeys || []).map((jr) => {
    const legs = jr.legs || [], last = legs[legs.length - 1];
    const t = (x, k) => x && (x[k + 'Estimated'] || x[k + 'Planned']);
    const dep = new Date(t(legs[0]?.origin, 'departureTime')), arr = new Date(t(last?.destination, 'arrivalTime'));
    // Rides only: walking legs (class 99, 100) are left out of the summary.
    const rides = legs.filter((l) => MODE[l.transportation?.product?.class])
      .map((l) => ({ mode: MODE[l.transportation.product.class], name: l.transportation.disassembledName || l.transportation.number || '', from: (l.origin?.name || '').split(',')[0] }));
    return { dep: dep.toISOString(), arr: arr.toISOString(), minutes: Math.round((arr - dep) / 60000), rides };
  }).filter((x) => x.minutes > 0);
}
// "Bus 333, then train T4"
const ridesText = (rides) => rides.length ? rides.map((r, i) => (i ? 'then ' : '') + r.mode + (r.name ? ' ' + r.name : '')).join(', ').replace(/^./, (c) => c.toUpperCase()) : 'Walk';

async function commute(home, places, S) {
  const list = places.filter((p) => p.lat && p.lng);
  if (!home || !list.length) return null;
  const base = list.map((p) => {
    const km = (metres(home, p) * 1.35) / 1000;
    return { name: p.name, label: p.label, days: p.days || 3, lat: p.lat, lng: p.lng, km: Math.round(km * 10) / 10, minutes: Math.round(10 + km * 2.8), source: 'estimate' };
  });
  // 1. Transport for NSW: real timetables, leaving 8 am next Monday. Free.
  if (S.tfnswKey) {
    const when = nextDay(1, 8, 0);
    await Promise.all(base.map(async (b) => {
      try {
        const trips = await cached(`tf:${home.lat.toFixed(4)},${home.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`, 7, () => tfnswTrips(home, b, when, S.tfnswKey));
        const best = (trips || []).slice(0, 3).sort((x, y) => x.minutes - y.minutes)[0];
        if (best) Object.assign(b, { minutes: best.minutes, how: ridesText(best.rides), rides: best.rides, source: 'tfnsw' });
      } catch {}
    }));
    if (base.every((b) => b.source === 'tfnsw')) return base;
  }
  // 2. Google Maps, if that key is set instead.
  const key = S.googleKey;
  if (!key) return base;
  const ll = (p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
  const rows = await cached('gm:' + home.lat.toFixed(4) + home.lng.toFixed(4) + list.map((p) => p.name).join('|'), 7, async () => {
    const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      signal: AbortSignal.timeout(8000),
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition' },
      body: JSON.stringify({ origins: [ll(home)], destinations: list.map(ll), travelMode: 'TRANSIT', departureTime: nextMonday8() })
    });
    if (!res.ok) throw new Error('Google Maps ' + res.status);
    return res.json();
  });
  for (const r of rows || []) {
    const b = base[r.destinationIndex];
    if (b && b.source === 'estimate' && r.duration && r.condition !== 'ROUTE_NOT_FOUND') { b.minutes = Math.round(parseInt(r.duration) / 60); b.km = Math.round(r.distanceMeters / 100) / 10; b.source = 'google'; }
  }
  return base;
}

// Getting home late: the first trip from Town Hall after 12:30 am on a Saturday (Friday night out).
const TOWN_HALL = { name: 'Town Hall', lat: -33.8732, lng: 151.2069 };
async function nightHome(home, key) {
  if (metres(home, TOWN_HALL) < 1500) return null;    // walkable from the city anyway
  const when = nextDay(6, 0, 30);
  const trips = await cached(`tfn:${home.lat.toFixed(4)},${home.lng.toFixed(4)}`, 7, () => tfnswTrips(TOWN_HALL, home, when, key));
  const first = (trips || []).sort((a, b) => new Date(a.arr) - new Date(b.arr))[0];
  if (!first) return null;
  return { ...first, from: TOWN_HALL, asked: when.toISOString(), how: ridesText(first.rides) };
}

// ---------- gather everything ----------
export async function gatherFacts(L, S, profile) {
  const F = { sources: [], errors: [], sample: null };
  const note = (name, kind) => { if (!F.sources.find((s) => s.name === name)) F.sources.push({ name, kind }); };
  const tryIt = async (label, fn) => { try { return await fn(); } catch (e) { F.errors.push(label + ': ' + e.message); return null; } };
  let home = L.lat && L.lng ? { lat: L.lat, lng: L.lng } : null;

  // Offline copies for the demo listings, so the demos still work with no internet.
  // A demo page can name its own saved answers (cache) and turn off the sample facts (sample: false).
  const cacheFile = /^[\w-]+\.json$/.test(L.cache || '') ? L.cache : 'bondi-sandbox.json';
  const demoP = L.demo ? Promise.all([
    tryIt('snapshot', async () => (await fetch(chrome.runtime.getURL('demo/cache/' + cacheFile))).json()),
    L.sample === false ? null : tryIt('sample', async () => (await fetch(chrome.runtime.getURL('demo/facts.json'))).json())
  ]) : Promise.resolve([null, null]);
  const snapFirst = L.demo ? (await demoP)[0] : null;
  const mb = microburbs(S.microburbsKey, snapFirst);

  // 1. Microburbs: suburb data, and property data when the address resolves.
  const mbP = (async () => {
    const sal = L.suburb ? await tryIt('suburb', () => mb.sal(L.suburb, L.state)) : null;
    // Address lookup needs a real key (the free sandbox refuses it), so don't spend a call on it with 'test'.
    const realKey = S.microburbsKey && S.microburbsKey !== 'test';
    if (!L.gnaf && L.address && !L.demo && realKey) L.gnaf = await tryIt('address', () => mb.gnaf(L.address, sal || L.suburb));
    const S_ = sal ? encodeURIComponent(sal) : null;
    // No address match (the free key can't look addresses up): find this home in the suburb's own listings instead.
    if (!L.gnaf && S_ && L.address) {
      const list = await tryIt('listings', () => mb.get('/suburbs/' + S_ + '/listings/' + (L.rent === false ? 'for-sale?limit=300' : 'for-rent?limit=300'), 1));
      const want = streetKey(L.address);
      const hit = want && (list?.results || []).find((x) => streetKey(x.address?.street || x.area_name) === want);
      if (hit?.gnaf_pid) L.gnaf = hit.gnaf_pid;
      // The listing's own pin, when the page didn't give one.
      if (hit?.coordinates && !(L.lat && L.lng)) { L.lat = hit.coordinates.latitude; L.lng = hit.coordinates.longitude; }
    }
    const r = await Promise.all([
      S_ ? tryIt('listings', () => mb.get('/suburbs/' + S_ + '/listings/for-rent?limit=300', 1)) : null,
      S_ ? tryIt('pois', () => mb.get('/suburbs/' + S_ + '/lifestyle/pois', 30)) : null,
      S_ ? tryIt('days on market', () => mb.get('/suburbs/' + S_ + '/market/days-on-market', 7)) : null,
      S_ ? tryIt('crime', () => mb.get('/suburbs/' + S_ + '/crime/summary', 30)) : null,
      S_ ? tryIt('suburb risks', () => mb.get('/suburbs/' + S_ + '/risks/all', 30)) : null,
      L.gnaf ? tryIt('transport', () => mb.get('/properties/' + L.gnaf + '/transport/nearby?radius_m=2500', 30)) : null,
      L.gnaf ? tryIt('rent history', () => mb.get('/properties/' + L.gnaf + '/rent-history', 7)) : null,
      L.gnaf ? tryIt('risks', () => mb.get('/properties/' + L.gnaf + '/risks/all', 30)) : null,
      tryIt('rent model', () => rentModel(L, S))
    ]);
    return { sal, r };
  })();
  // Without coordinates on the page, Microburbs gives the location.
  if (!home) { const { r } = await mbP; if (L.lat && L.lng) home = { lat: L.lat, lng: L.lng }; else if (r[5]) home = { lat: r[5].center_lat, lng: r[5].center_lng }; }
  F.home = home;

  // 2. Everything that only needs the location starts at the same time.
  const H = (fn) => (home ? fn() : Promise.resolve(null));
  const councilP = H(() => tryIt('NSW council', () => nswCouncil(home)));
  const postcode = L.postcode || (String(L.address || '').match(/\b(\d{4})\b(?!.*\b\d{4}\b)/) || [])[1];
  const nightP = S.tfnswKey ? H(() => tryIt('Transport for NSW', () => nightHome(home, S.tfnswKey))) : null;
  const [stationsNSW, council, abs, near, photos, o, commuteR, das, cos] = await Promise.all([
    H(() => tryIt('NSW stations', () => nswStations(home))),
    councilP,
    postcode ? tryIt('ABS Census', () => census(postcode)) : null,
    H(() => tryIt('Overture places', () => placesNear(home))),
    S.mapillaryToken ? H(() => tryIt('Mapillary', () => streetPhotos(home, S.mapillaryToken))) : null,
    S.useOsm ? H(() => tryIt('osm', () => osmNearby(home))) : null,
    profile.places?.length ? H(() => tryIt('commute', () => commute(home, profile.places, S))) : null,
    councilP.then((c) => (c ? tryIt('NSW Planning Portal', () => nearbyDAs(home, c.council)) : null)),
    councilP.then((c) => (/city of sydney/i.test(c?.council || '') ? tryIt('City of Sydney', () => cosNearHome(home)) : null))
  ]);
  const [{ sal, r: [rent, pois, dom, crime, risksSub, transport, history, risks, model] }, [snap, sample]] = await Promise.all([mbP, demoP]);

  F.sample = sample;
  F.suburb = sal || L.suburb || null;
  F.gnaf = L.gnaf || null;
  const R = rent || snap?.rent?.data, P = pois || snap?.pois?.data;
  if (rent || pois || dom || crime) note('Microburbs', 'live'); else if (snap) note('Microburbs snapshot', 'snapshot');
  if (R) F.comps = comparables(R.results, L, home);
  if (model) { F.model = model; note(model.source, 'live'); }
  if (dom) F.daysOnMarket = dom;
  if (crime) F.crime = crime;
  if (risksSub) F.suburbRisks = risksSub;
  if (risks) F.risks = risks;
  if (history) F.history = history;
  if (transport) F.transport = transport;
  if (P && home) Object.assign(F, nearbyFromPois(P, home, profile));

  if (council) F.council = council;
  if (abs) { F.census = abs; note('ABS Census 2021', 'live'); }
  if (photos?.length) { F.photos = photos; note('Mapillary', 'live'); }
  if (das) { F.das = das; note('NSW Planning Portal', 'live'); }
  if (cos) { F.cos = cos; note('City of Sydney', 'live'); }
  if (commuteR) { F.commute = commuteR; if (commuteR.some((c) => c.source === 'google')) note('Google Maps', 'live'); }
  if (commuteR?.some((c) => c.source === 'tfnsw')) note('Transport for NSW', 'live');
  const night = await nightP;
  if (night) { F.nightRide = night; note('Transport for NSW', 'live'); }
  if (near?.length) note('Overture Maps', 'live');
  if (o) { note('OpenStreetMap', 'live'); F.lightRail = o.lightRail; F.busStop = F.busStop || o.busStop; }

  // Best source first for each fact.
  if (stationsNSW?.length) { F.stations = stationsNSW.slice(0, 3); note('NSW Spatial Services', 'live'); }
  else if (o?.stations?.length) F.stations = o.stations;
  else if (!F.stations?.length && near) F.stations = near.filter((p) => p.kind === 'station').slice(0, 2).map((p) => ({ ...p, mode: 'train' }));
  if (!F.venues150?.length) F.venues150 = o?.venues150?.length ? o.venues150 : near ? near.filter((p) => p.kind === 'venue' && p.d <= 150).map((p) => ({ name: p.name, sub: 'bar', d: p.d, lat: p.lat, lng: p.lng })) : F.venues150;

  // Your gyms and supermarkets (you can pick several of each in Settings).
  const wantGyms = profile.gyms?.length ? profile.gyms : profile.gym ? [profile.gym] : [];
  const wantShops = profile.supermarkets?.length ? profile.supermarkets : profile.supermarket ? [profile.supermarket] : [];
  const ovGyms = (near || []).filter((p) => p.kind === 'gym'), ovShops = (near || []).filter((p) => p.kind === 'supermarket');
  if (home) {
    F.myGyms = brands(wantGyms, F._gyms, o?.gyms, ovGyms);
    F.myShops = brands(wantShops, F._shops, o?.shops, ovShops);
    if (!F.gym?.nearest && ovGyms[0]) F.gym = { nearest: ovGyms[0], mine: null };
    if (!F.supermarket?.nearest && ovShops[0]) F.supermarket = { nearest: ovShops[0], mine: null };
  }
  delete F._gyms; delete F._shops;

  // 3. Walking routes: the night walk home from the station (with street lighting), and to your nearest gym and shop.
  if (home) {
    const mbT = F.transport?.nearest || {};
    const dest = (mbT.train && { name: mbT.train.label, lat: mbT.train.lat, lng: mbT.train.lng }) || F.stations?.[0] || F.sample?.station || (F.busStop?.d > 250 ? F.busStop : null);
    const nearest = (xs) => xs?.filter((x) => !x.missing).sort((a, b) => a.d - b.d)[0];
    const g = nearest(F.myGyms) || F.gym?.nearest, sh = nearest(F.myShops) || F.supermarket?.nearest;
    const isCoS = /city of sydney/i.test(F.council?.council || '');
    const [rDest, rGym, rShop] = await Promise.all([
      dest?.lat ? tryIt('route', () => walkRoute(dest, home)) : null,
      g?.lat ? tryIt('route', () => walkRoute(home, g)) : null,
      sh?.lat ? tryIt('route', () => walkRoute(home, sh)) : null
    ]);
    if (rDest || rGym || rShop) note('OpenStreetMap', 'live');
    if (rGym) F.routeGym = { ...rGym, to: g };
    if (rShop) F.routeShop = { ...rShop, to: sh };
    if (rDest) {
      F.nightWalk = { ...rDest, from: dest };
      // City of Sydney's own street light register, along the walk.
      const councilLights = isCoS ? await tryIt('City of Sydney lights', () => cosPoints('Lights', routeBox(rDest.line))) : [];
      if (councilLights?.length) note('City of Sydney', 'live');
      const lit = S.useOsm || councilLights?.length ? await tryIt('lighting', () => lighting(rDest, councilLights || [])) : null;
      if (lit) Object.assign(F.nightWalk, lit);
    }
  }
  // 4. Listings for sale: what an investor needs (value, rent, yield, growth, supply). See lib/invest.js.
  if (L.rent === false) {
    const inv = await tryIt('investor data', () => investFacts(L, S, F, { mb, tryIt, note, home, daRows: F.council ? () => councilDAs(F.council.council) : null }));
    if (inv) F.inv = inv;
  }
  // Demo answered from its saved copy (no internet): say so on every Microburbs source.
  if (snapFirst?.used) F.sources.forEach((s) => { if (/Microburbs/.test(s.name)) s.kind = 'snapshot'; });
  if (F.sample) note('Sample data', 'sample');
  return F;
}
