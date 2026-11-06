// Investor data. Runs in the service worker for listings that are FOR SALE.
// It adds what an investor needs on top of the normal checks: what the home is worth, what it would
// rent for, the suburb's yield, growth, vacancy and supply, and this home's own sale history.
// Every number keeps its source, so the panel can say where it came from.

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const DAY = 864e5;

// House, townhouse or unit. Microburbs market figures come as "house" or "unit".
export function homeKind(type) {
  const t = String(type || '').toLowerCase();
  if (/town/.test(t)) return 'townhouse';
  if (/house|villa|terrace|duplex|semi|cottage|acreage|rural/.test(t)) return 'house';
  return 'unit';
}

// Sold homes like this one: same kind, same bedrooms, sold in the last 12 months.
// Widens to one bedroom either side if there are fewer than three.
function soldComps(rows, L, kind, selfGnaf) {
  const since = Date.now() - 365 * DAY;
  const same = (x) => {
    const k = homeKind(x.property_type);
    return k === kind || (kind === 'townhouse' && k === 'unit');
  };
  // One row per sale: the same sale can be listed under two address spellings ("56a" and "56a-62").
  const all = rows.filter((x) => x.price > 50000 && same(x) && x.gnaf !== selfGnaf && (!x.date || new Date(x.date) > since))
    .filter((x, i, a) => a.findIndex((y) => y.price === x.price && y.date === x.date) === i);
  const bedsOk = (x) => Math.round(x.beds || 0) === Math.round(L.beds || 0);
  const bathsOk = (x) => !L.baths || x.baths == null || Math.round(x.baths) === Math.round(L.baths);
  // Same bedrooms and bathrooms first. A second bathroom adds real value, so mixing them up overstates the price.
  let pick = all.filter((x) => bedsOk(x) && bathsOk(x)), basis = `${L.beds || ''}-bed ${L.baths ? L.baths + '-bath ' : ''}${kind}s`, exact = true;
  if (pick.length < 3) { pick = all.filter(bedsOk); basis = `${L.beds || ''}-bed ${kind}s`; exact = false; }
  if (pick.length < 3 && L.beds) { pick = all.filter((x) => Math.abs((x.beds || 0) - L.beds) <= 1); basis = `${L.beds - 1}–${L.beds + 1} bed ${kind}s`; }
  // Bathrooms of the homes used, so the panel can say when they differ from this one.
  const otherBaths = L.baths ? pick.filter((x) => x.baths != null && Math.round(x.baths) !== Math.round(L.baths)).length : 0;
  pick.sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || new Date(b.date) - new Date(a.date));
  return { n: pick.length, median: median(pick.map((x) => x.price)), prices: pick.map((x) => x.price), basis: basis.replace(/^-bed /, ''), exact, otherBaths, sample: pick.slice(0, 8) };
}

export async function investFacts(L, S, F, { mb, tryIt, note, home, daRows }) {
  const sal = F.suburb && encodeURIComponent(F.suburb);
  const g = L.gnaf || F.gnaf;
  const kind = homeKind(L.type);
  const mt = kind === 'house' ? 'house' : 'unit';
  const sub = (p, days = 7) => (sal ? tryIt(p, () => mb.get('/suburbs/' + sal + p, days)) : null);
  const prop = (p, days = 30) => (g ? tryIt(p, () => mb.get('/properties/' + g + p, days)) : null);
  const realKey = S.microburbsKey && S.microburbsKey !== 'test';

  const [salePrice, yieldPct, growth, vacancy, mos, stock, levies, inv, rentMed, beds, forecast, sales, supply, avm, saleHist, nearby, land, quoting] = await Promise.all([
    sub('/market/median-sale-price'), sub('/market/yield-pct'), sub('/market/price-growth', 30), sub('/market/vacancy-rate'),
    sub('/market/months-of-supply'), sub('/market/stock-on-market', 3), sub('/market/strata-levies', 90), sub('/market/investor-concentration', 30),
    sub('/market/median-rent'), sub('/market/bedroom-stats', 30), sub('/forecast/sale', 30), sub('/sales/recent?limit=100', 7), sub('/development/supply', 30),
    prop('/valuation/avm'), prop('/sale-history'), prop('/comparables/recent-sales-nearby', 14), prop('/valuation/land-values', 90),
    // Agent quoting costs 50c a call, so only with a real key.
    realKey ? prop('/valuation/agent-quoting', 7) : null
  ]);

  const I = { kind, mt };
  const pick = (o) => (o && o[mt] != null ? o[mt] : null);

  // ---------- Market (suburb) ----------
  I.market = {
    medianPrice: pick(salePrice), yield: pick(yieldPct), growth: pick(growth), medianRent: pick(rentMed),
    vacancy: vacancy && vacancy[mt] ? vacancy[mt].value : null,
    vacancyRank: vacancy && vacancy[mt] ? { rank: vacancy[mt].rank, of: vacancy[mt].areas } : null,
    monthsSupply: mos?.months_of_supply ?? null, stock: stock ? { all: stock.stock_on_market, mine: stock[mt] } : null,
    strataLevy: levies?.median_levy_annual ?? null,
    investorShare: inv?.rental_share_pct ?? null,
    forecast: forecast && forecast[mt] ? forecast[mt] : null,
    newSupply: supply?.summary || null,
    asOf: salePrice?.as_of || yieldPct?.as_of || null
  };
  const bs = (beds?.bedrooms || []).find((b) => b.bedrooms === Math.round(L.beds || 0));
  I.market.bedPrice = bs ? (kind === 'house' ? bs.house_price : bs.unit_price) : null;

  // ---------- What it's worth ----------
  const rows = [
    ...((sales?.results) || []).map((x) => ({ address: x.address, property_type: x.property_type, beds: x.bedrooms, baths: x.bathrooms, price: x.sold_price, date: x.sold_date, gnaf: x.gnaf_pid, lat: x.lat, lng: x.lng })),
    ...((Array.isArray(nearby) ? nearby : [])).map((x) => ({ address: String(x.address || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), property_type: x.property_type, beds: x.bedrooms, baths: x.bathrooms, price: x.price, date: x.date_sold, gnaf: x.gnaf_pid, lat: x.latitude, lng: x.longitude, dkm: x.dist_km }))
  ].filter((x, i, all) => all.findIndex((y) => y.gnaf === x.gnaf && y.date === x.date) === i);
  const dist = (x) => {
    if (x.dkm != null) return Math.round(x.dkm * 1000);
    if (!home || !x.lat) return null;
    const R = 6371000, r = Math.PI / 180, dLat = (x.lat - home.lat) * r, dLng = (x.lng - home.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(home.lat * r) * Math.cos(x.lat * r) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  };
  rows.forEach((x) => (x.d = dist(x)));
  const comps = soldComps(rows, L, kind, g);
  const avmV = avm?.predicted_price ? { mid: Math.round(avm.predicted_price), low: Math.round(avm.predicted_price_low), high: Math.round(avm.predicted_price_high), confidence: avm.confidence_score, date: avm.prediction_date } : null;
  // One working value: the middle of what we have (the model valuation, similar sales, the suburb figure for this many bedrooms).
  const votes = [avmV?.mid, comps.n >= 2 ? comps.median : null, I.market.bedPrice].filter(Number.isFinite);
  // How sure: a valuation of this exact home that agrees with sales is strong; suburb figures alone are rough.
  const agree = avmV && comps.n >= 2 && Math.abs(avmV.mid - comps.median) / comps.median < 0.12;
  const confidence = agree || (avmV && avmV.confidence >= 70) ? 'high' : avmV || (comps.exact && comps.n >= 5) ? 'medium' : 'low';
  I.value = {
    avm: avmV, comps, bedPrice: I.market.bedPrice, confidence,
    mid: median(votes),
    low: votes.length ? Math.min(...votes, avmV?.low ?? Infinity) : null,
    high: votes.length ? Math.max(...votes) : null,
    basis: [avmV && 'Microburbs valuation', comps.n >= 2 && `${comps.n} sales of ${comps.basis}`, I.market.bedPrice && `suburb median for ${L.beds}-bed ${kind}s`].filter(Boolean)
  };
  if (votes.length) note('Microburbs valuation', 'live');

  // ---------- What it would rent for ----------
  // Best source first: your Task 4 model, similar homes for rent now, then the suburb's yield applied to the value.
  let rent = null;
  if (F.model && (F.model.with || F.model.without)) {
    const v = L.parking > 0 ? F.model.with || F.model.without : F.model.without || F.model.with;
    rent = { est: Math.round(v), method: 'model', basis: F.model.source };
  } else if (F.comps && F.comps.n >= 3 && F.comps.median) {
    const ps = F.comps.prices.slice().sort((a, b) => a - b);
    rent = { est: F.comps.median, low: ps[Math.floor(ps.length * 0.25)], high: ps[Math.ceil(ps.length * 0.75) - 1], method: 'comps', basis: `${F.comps.n} similar ${L.beds}-bed ${kind}s for rent in ${F.suburb || L.suburb}`, n: F.comps.n };
  } else if (I.market.yield && I.value.mid) {
    rent = { est: Math.round((I.market.yield * I.value.mid) / 52 / 5) * 5, method: 'yield', basis: `${(I.market.yield * 100).toFixed(1)}% suburb yield on a ${Math.round(I.value.mid / 1000)}k value` };
  } else if (I.market.medianRent) {
    rent = { est: Math.round(I.market.medianRent), method: 'median', basis: `median ${mt} rent in ${F.suburb || L.suburb}, all sizes` };
  }
  I.rent = rent;

  // ---------- This home's own history ----------
  const hist = (Array.isArray(saleHist) ? saleHist : []).filter((h) => h.date).sort((a, b) => new Date(b.date) - new Date(a.date));
  const sold = hist.filter((h) => /sold/i.test(h.type) && h.price);
  I.history = { rows: hist.slice(0, 6), lastSale: sold[0] || null, sales: sold.length, recentListings: hist.filter((h) => /sale/i.test(h.type) && Date.now() - new Date(h.date) < 3 * 365 * DAY).length };

  // ---------- Land ----------
  if (land?.land_value) I.land = { value: land.land_value, area: land.area_sqm, zone: land.zone_desc, history: (land.history || []).slice(-5) };
  if (quoting && quoting.available !== false && quoting.data !== null) I.quoting = quoting;

  // ---------- Building on this lot and new homes nearby (NSW Planning Portal) ----------
  if (daRows && home) {
    const rowsDA = (await tryIt('NSW Planning Portal', () => daRows())) || [];
    const m = (a, b) => {
      const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
      return Math.round(2 * R * Math.asin(Math.sqrt(h)));
    };
    const live = rowsDA.map(([lat, lng, storeys, dwellings, status, type, date, address, kinds, cost]) => ({ lat, lng, storeys, dwellings, status, type, date, address, kinds, cost, d: m(home, { lat, lng }) }))
      .filter((x) => !/withdrawn|rejected|refused/i.test(x.status || '') && !/modification/i.test(x.type || ''));
    const street = String(L.address || '').split(',')[0].replace(/^.*\//, '').trim().toLowerCase();
    I.siteDAs = live.filter((x) => x.d <= 25 || (street && x.address.toLowerCase().startsWith(street))).slice(0, 3);
    const near = live.filter((x) => x.d <= 1000 && x.dwellings > 0);
    I.supply1km = { projects: near.length, dwellings: near.reduce((s, x) => s + x.dwellings, 0), biggest: near.sort((a, b) => b.dwellings - a.dwellings).slice(0, 5) };
  }

  if (sal) note('Microburbs market', 'live');
  return I;
}
