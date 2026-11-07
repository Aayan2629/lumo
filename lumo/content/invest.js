// Investor mode. On a listing FOR SALE, Lumo checks the ad the way an investor would:
// is the price right, what will it rent for, what does it cost to hold, and what the ad leaves out.
// The list it works from is knowledge/investor-traps.md (100 traps) and investor-features.md.
// Every number shown comes from facts or from the stated assumptions in Numbers. Not financial advice.
(() => {
  const M = (n) => LUMO.money(n);
  const S = (n) => LUMO.short(n);
  const P1 = (x) => (x == null ? '' : (x * 100).toFixed(1).replace(/\.0$/, '') + '%');
  const yr = (d) => new Date(d).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // Straight-line interpolation through points [[x, y], ...], flat beyond the ends.
  const lerp = (x, pts) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); }
    return pts[pts.length - 1][1];
  };

  // "$767k", "$1.25m"
  LUMO.short = (n) => {
    if (n == null || !Number.isFinite(n)) return '';
    const a = Math.abs(n), sign = n < 0 ? '−' : '';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'm';
    if (a >= 1e4) return sign + '$' + Math.round(a / 1000) + 'k';
    return sign + M(a);
  };
  LUMO.pct = P1;

  // ---------- Reading a sale price ----------
  // "$1,250,000", "$1.25m", "Offers over $699,000", "$815,000 - $865,000", "Auction", "Contact agent".
  LUMO.parseSale = (txt) => {
    const t = String(txt || '').replace(/ /g, ' ');
    const out = { text: t.trim(), kind: 'hidden', price: null, low: null, high: null, floor: false };
    if (/auction/i.test(t)) out.auction = true;
    const re = /\$\s?(\d[\d,]*(?:\.\d+)?)\s*(m(?:il(?:lion)?)?\b|k\b)?/gi;
    const vals = [];
    let m;
    while ((m = re.exec(t))) {
      const after = t.slice(m.index + m[0].length, m.index + m[0].length + 14).toLowerCase();
      if (/^\s*(per\s*week|p\.?w|pw|\/\s*w|a week|weekly|per\s*month|pcm)/.test(after)) continue;   // a rent, not a price
      let n = Number(m[1].replace(/,/g, ''));
      if (/^m/i.test(m[2] || '')) n *= 1e6; else if (/^k/i.test(m[2] || '')) n *= 1e3;
      if (n >= 50000 && n <= 1e8) vals.push(Math.round(n));
    }
    if (!vals.length) { out.kind = out.auction ? 'auction' : 'hidden'; return out; }
    out.floor = /offers?\s+(over|above|from|in excess)|\bfrom\s+\$|\bover\s+\$|\babove\s+\$|plus\b|\+\s*$/i.test(t);
    const guide = /guide|offers?|eoi|expressions?|estimate|range|from|over|above|auction/i.test(t);
    if (vals.length >= 2 && vals[1] > vals[0]) { out.low = vals[0]; out.high = vals[1]; out.price = Math.round((vals[0] + vals[1]) / 2); out.kind = 'range'; }
    else { out.price = out.low = vals[0]; out.kind = out.floor || guide ? 'guide' : 'fixed'; }
    return out;
  };

  // Numbers the ad itself states: rent appraisal, strata, council and water rates.
  const PERIOD = (s) => (/quarter|\bpq\b|\/\s*q|qtr/i.test(s) ? 4 : /annum|\bpa\b|p\.a|year|yearly|annual/i.test(s) ? 1 : /month|pcm/i.test(s) ? 12 : null);
  LUMO.adNumbers = (L) => {
    const t = (L.description || '') + '\n' + (L.features || []).join('\n');
    const out = {};
    const ap = t.match(/(rental (?:appraisal|estimate|return|potential|income)|currently (?:leased|tenanted|rented)|leased (?:at|for)|returning|rented (?:at|for))[^$\n]{0,40}\$\s?([\d,]{3,6})(?:\s*(?:-|–|to)\s*\$?\s?([\d,]{3,6}))?/i);
    if (ap) {
      const a = +ap[2].replace(/,/g, ''), b = ap[3] ? +ap[3].replace(/,/g, '') : null;
      if (a >= 100 && a <= 10000) out.appraisal = { value: b && b > a ? Math.round((a + b) / 2) : a, low: a, high: b, leased: /leased|tenanted|rented|returning/i.test(ap[1]), text: ap[0] };
    }
    const fee = (re) => {
      const m = t.match(re);
      if (!m) return null;
      const v = +m[1].replace(/,/g, '');
      const per = PERIOD(m[2] || '');
      return { value: v, per, yearly: v * (per || 4), assumed: !per, text: m[0] };
    };
    out.strata = fee(/strata(?: levies| levy| fees| rates)?\s*(?::|of|approx\.?|approximately|is|are)?\s*\$\s?([\d,]+(?:\.\d+)?)\s*(per quarter|\/\s*q(?:tr)?|pq|quarterly|per annum|p\.?a\.?|a year|per year|yearly|annually|per month|pcm)?/i);
    out.council = fee(/council(?: rates)?\s*(?::|of|approx\.?|approximately|is|are)?\s*\$\s?([\d,]+(?:\.\d+)?)\s*(per quarter|\/\s*q(?:tr)?|pq|quarterly|per annum|p\.?a\.?|a year|per year|yearly|annually)?/i);
    out.water = fee(/water(?: rates)?\s*(?::|of|approx\.?|approximately|is|are)?\s*\$\s?([\d,]+(?:\.\d+)?)\s*(per quarter|\/\s*q(?:tr)?|pq|quarterly|per annum|p\.?a\.?|a year|per year|yearly|annually)?/i);
    return out;
  };

  // ---------- NSW costs to buy and hold ----------
  // Transfer (stamp) duty, NSW 2026–27 rates (Revenue NSW). Investors pay full duty: no first home concessions.
  LUMO.stampDuty = (v) => {
    const B = [[18000, 0, 1.25, 0], [38000, 225, 1.5, 18000], [103000, 525, 1.75, 38000], [387000, 1662, 3.5, 103000], [1290000, 11602, 4.5, 387000], [3870000, 52237, 5.5, 1290000], [Infinity, 194137, 7, 3870000]];
    for (const [top, base, rate, from] of B) if (v <= top) return Math.max(20, Math.round(base + ((v - from) * rate) / 100));
    return 0;
  };
  // NSW land tax, 2026 thresholds (frozen since 2024). Only if this is your only taxable land.
  LUMO.landTax = (lv) => (!lv || lv <= 1075000 ? 0 : lv <= 6571000 ? Math.round(100 + 0.016 * (lv - 1075000)) : Math.round(88036 + 0.02 * (lv - 6571000)));
  // Weekly loan repayment. Interest only, or principal and interest over `years`.
  LUMO.repay = (loan, ratePct, io, years = 30) => {
    if (!loan) return 0;
    const r = ratePct / 100;
    if (io) return (loan * r) / 52;
    const i = r / 12, n = years * 12;
    return ((loan * i) / (1 - Math.pow(1 + i, -n)) * 12) / 52;
  };

  const DEFAULTS = { deposit: 20, rate: 6.0, io: true, mgmt: 7 };
  LUMO.investDefaults = DEFAULTS;

  // The price Lumo works with. A low guide is not what the home will sell for, so when the guide
  // sits well under what similar homes sold for, Lumo uses the value instead and says so.
  function workingPrice(L, F) {
    const sale = L.sale || {}, V = F.inv?.value || {};
    // Only swap in the value when it is solid. A rough value (suburb sales of homes unlike this one) can't overrule the ad.
    const v = V.confidence === 'low' || V.comps?.otherBaths > 0 ? (sale.price ? null : V.mid) : V.mid;
    if (sale.kind === 'range' && !v) return { price: sale.high, basis: 'the top of the price range' };
    if (sale.kind === 'fixed') return { price: sale.price, basis: 'the asking price' };
    if (sale.kind === 'range') return v && sale.high < v * 0.95 ? { price: v, basis: 'what similar homes sold for (the range looks low)' } : { price: sale.price, basis: 'the middle of the price range' };
    if (sale.kind === 'guide') return v && sale.price < v * 0.95 ? { price: v, basis: 'what similar homes sold for (the guide looks low)' } : { price: sale.price, basis: 'the price guide' };
    return v ? { price: v, basis: 'what similar homes sold for (no price in the ad)' } : { price: null, basis: '' };
  }

  // Everything an investor's weekly sum needs. opts: { price, deposit, rate, io, mgmt } override the defaults.
  LUMO.investModel = (L, F, P, opts = {}) => {
    const I = F.inv || {}, ad = L.ad || LUMO.adNumbers(L);
    const set = { ...DEFAULTS, ...(P?.invest || {}), ...opts };
    const wp = workingPrice(L, F);
    const price = opts.price || wp.price;
    const rent = I.rent?.est || null;
    if (!price) return null;
    const kind = I.kind || 'unit', house = kind === 'house';
    const yearly = (rent || 0) * 52;
    const costs = [];
    const add = (key, label, v, note, from) => { if (v > 0) costs.push({ key, label, yearly: Math.round(v), note, from }); };
    if (!house) {
      if (ad.strata) add('strata', 'Strata', ad.strata.yearly, ad.strata.assumed ? 'from the ad, read as per quarter' : 'from the ad', 'ad');
      else if (I.market?.strataLevy) add('strata', 'Strata', I.market.strataLevy, 'suburb median, estimated', 'Microburbs');
    }
    add('council', 'Council rates', ad.council ? ad.council.yearly : house ? 1600 : 1200, ad.council ? 'from the ad' : 'typical, estimate', ad.council ? 'ad' : 'est');
    add('water', 'Water', ad.water ? ad.water.yearly : house ? 800 : 700, ad.water ? 'from the ad' : 'fixed charges, estimate', ad.water ? 'ad' : 'est');
    add('insurance', 'Landlord insurance', house ? 2000 : 500, house ? 'building and landlord cover, estimate' : 'landlord cover (strata insures the building), estimate', 'est');
    add('mgmt', 'Property manager', yearly * (set.mgmt / 100) + (rent || 0), `${set.mgmt}% of rent plus a week to let`, 'est');
    const vac = Math.max(I.market?.vacancy ?? 0.02, 0.02);
    add('vacancy', 'Empty weeks', yearly * vac, `${Math.round(vac * 52 * 10) / 10} weeks a year${I.market?.vacancy != null ? ', from the suburb vacancy rate' : ''}`, I.market?.vacancy != null ? 'Microburbs' : 'est');
    add('repairs', 'Repairs', house ? Math.max(1500, price * 0.002) : 900, 'estimate', 'est');
    const lt = LUMO.landTax(I.land?.value);
    if (lt) add('landtax', 'Land tax', lt, 'NSW 2026 rates, on this lot alone', 'Revenue NSW');
    const costsYear = costs.reduce((s, c) => s + c.yearly, 0);
    const loan = price * (1 - set.deposit / 100);
    const loanWeek = LUMO.repay(loan, set.rate, set.io);
    const duty = LUMO.stampDuty(price);
    const deposit = price - loan;
    const weekly = (rent || 0) - costsYear / 52 - loanWeek;
    return {
      set, price, priceBasis: opts.price ? 'your price' : wp.basis, rent, rentBasis: I.rent?.basis, rentMethod: I.rent?.method,
      costs, costsYear, costsWeek: costsYear / 52, loan, loanWeek, weekly,
      gross: rent ? yearly / price : null, net: rent ? (yearly - costsYear) / price : null,
      upfront: { deposit, duty, other: 3000, total: deposit + duty + 3000, lmi: set.deposit < 20 }
    };
  };

  // ---------- The Lumo score ----------
  // Five parts, each 0–100, from the data on screen. Not advice: a quick way to compare homes.
  LUMO.investScore = (L, F, model) => {
    const I = F.inv || {}, mk = I.market || {}, parts = [];
    const push = (key, label, w, score, why) => { if (score != null && Number.isFinite(score)) parts.push({ key, label, w, score: Math.round(clamp(score, 0, 100)), why }); };
    const v = I.value?.mid;
    if (v && model?.price) {
      const ask = L.sale?.kind === 'hidden' ? v : (L.sale?.price || model.price);
      const r = Math.max(ask, model.price) / v;
      push('value', 'Price', 25, lerp(r, [[0.95, 100], [1, 85], [1.05, 60], [1.1, 35], [1.2, 0]]), `${r <= 1 ? 'At or under' : Math.round((r - 1) * 100) + '% over'} what similar homes sold for`);
    }
    if (model?.net != null) push('yield', 'Rent return', 25, lerp(model.net * 100, [[0.5, 10], [1.5, 35], [2.5, 60], [3.5, 85], [4.5, 100]]), `${P1(model.net)} after costs, before the loan`);
    const g = mk.growth;
    const cagr = g?.['10yr'] != null ? Math.pow(1 + g['10yr'], 1 / 10) - 1 : g?.['5yr'] != null ? Math.pow(1 + g['5yr'], 1 / 5) - 1 : null;
    if (cagr != null) push('growth', 'Growth', 20, lerp(cagr * 100, [[0, 10], [3, 45], [6, 80], [8, 100]]), `${P1(cagr)} a year over ${g['10yr'] != null ? 10 : 5} years in the suburb`);
    let risk = 100; const why = [];
    const fl = F.risks?.flood?.[0], bf = F.risks?.bushfire?.[0];
    if (fl?.on_property) { risk -= 35; why.push('flood on the lot'); } else if ((F.suburbRisks?.flood?.coverage_pct || 0) > 10) { risk -= 8; why.push('flooding in the suburb'); }
    if (bf?.on_property) { risk -= 15; why.push('bushfire-prone lot'); } else if (bf && bf.nearest_distance_m <= 100) { risk -= 8; why.push('bushfire land next door'); }
    const cr = F.crime?.vs_national_pct;
    if (cr >= 25) { risk -= 20; why.push('high crime'); } else if (cr >= 10) { risk -= 10; why.push('crime above average'); }
    if (mk.monthsSupply > 6) { risk -= 10; why.push('lots for sale'); }
    if (mk.investorShare > 60) { risk -= 10; why.push('mostly investors'); }
    if ((I.supply1km?.dwellings || 0) >= 100) { risk -= 10; why.push('many new homes approved nearby'); }
    push('risk', 'Risk', 20, risk, why.length ? 'Lower for ' + why.join(', ') : 'Nothing serious in the data');
    if (mk.vacancy != null) push('demand', 'Tenant demand', 10, lerp(mk.vacancy * 100, [[1, 100], [2, 75], [3, 50], [5, 20]]), `${P1(mk.vacancy)} of rentals empty`);
    const wsum = parts.reduce((s, p) => s + p.w, 0);
    // A score needs the money side (price or rent return) and at least three parts. With only the risk
    // part every home in a suburb got the same number (90 in Bondi), which says nothing.
    const enough = parts.some((p) => p.key === 'value' || p.key === 'yield') && parts.length >= 3;
    const total = wsum && enough ? Math.round(parts.reduce((s, p) => s + p.score * p.w, 0) / wsum) : null;
    return { total, parts };
  };

  // ---------- Checks ----------
  // Checks that mean the same for a buyer as for a renter, taken from the renter rules.
  const SHARED = ['quiet', 'transport', 'crime', 'flood', 'build', 'views', 'latenight', 'trees', 'photos', 'beach', 'cafes'];
  const forBuyer = (s) => String(s || '').replace(/before you apply/gi, 'before you make an offer').replace(/\bapply\b/gi, 'offer').replace(/\brenters?\b/gi, 'tenants');

  LUMO.investRules = (L, F, P, claims) => {
    const has = (k) => claims.some((c) => c.key === k);
    const I = F.inv || {}, mk = I.market || {}, V = I.value || {};
    const out = [];
    const add = (c) => out.push({ anchors: [], questions: [], sources: [], ...c });
    const sub = F.suburb || L.suburb || 'this suburb';
    const kind = I.kind || 'unit', kinds = kind === 'house' ? 'houses' : kind === 'townhouse' ? 'townhouses' : 'units';
    const bed = L.beds ? L.beds + '-bed ' : '';
    const sale = L.sale || { kind: 'hidden' };
    const ad = (L.ad = LUMO.adNumbers(L));
    const model = LUMO.investModel(L, F, P);
    const vSrc = V.basis?.length ? V.basis.join(', ') : '';
    const mid = V.mid;

    // 1. Price against what similar homes sold for (traps 1–8)
    const marketProof = mid ? {
      kind: 'market', sale: true, me: sale.kind === 'hidden' || sale.kind === 'auction' ? null : sale.kind === 'range' ? sale.low : sale.price, median: mid, prices: V.comps?.prices || [],
      band: V.avm ? [V.avm.low, V.avm.high] : null,
      comps: (V.comps?.sample || []).map((c) => ({ address: c.address, price: c.price, d: c.d, date: c.date, beds: c.beds })),
      items: [{ label: sale.kind === 'hidden' ? 'Value' : 'This ad', v: sale.price || mid, me: true }, { label: 'Value', v: mid }],
      note: `Value is the middle of: ${vSrc}.`
    } : null;
    if (!mid) {
      add({ id: 'value', finding: 1, level: 'grey', title: 'Value not checked yet', line: 'Needs Microburbs sales data for this suburb. Add your key in Settings.', anchors: [{ type: 'price' }] });
    } else if (sale.kind === 'hidden' || sale.kind === 'auction') {
      add({ id: 'value', finding: 2, level: 'amber', tag: 'No price', title: sale.auction ? 'Auction with no price guide' : 'No price in the ad', line: `Similar homes sold for about ${S(mid)}.`, anchors: [{ type: 'price' }], proof: marketProof,
        meaning: 'Without a price you can’t tell if it suits your budget. In NSW the agent must give you their estimate if you ask.',
        next: `Ask the agent for their written estimate. Lumo would expect about ${S(mid)}.`, questions: ['What is it worth?', 'What should I offer?'], sources: ['Microburbs valuation and sales'] });
    } else {
      const ref = sale.kind === 'range' ? sale.low : sale.price;
      const pct = (ref - mid) / mid;
      const isGuide = sale.kind !== 'fixed';
      // How far to trust the value: rough when it rests on suburb sales of homes unlike this one.
      const rough = V.confidence === 'low' || V.comps?.otherBaths > 0;
      const caveat = V.comps?.otherBaths ? ` Most of those sales had ${L.baths === 1 ? 'more bathrooms' : 'a different number of bathrooms'}, so the real gap is likely smaller.` : rough ? ' Lumo has no valuation of this exact home yet, so treat the gap as a guide.' : '';
      if (isGuide && pct < -0.08) {
        add({ id: 'value', finding: 1, level: rough ? 'amber' : 'red', tag: 'Guide low', title: rough ? 'Guide is under recent sales' : 'Price guide looks low', line: `Guide ${S(ref)}. Similar homes sold for about ${S(mid)}.`, anchors: [{ type: 'price' }], proof: marketProof,
          meaning: `A guide ${Math.round(-pct * 100)}% under recent sales pulls in buyers who then get outbid. Plan your budget around ${S(mid)}, not the guide.${caveat}`,
          next: 'Ask which sales the agent used to set the guide. In NSW the guide can’t be lower than the agent’s own estimate.',
          questions: ['What will it really sell for?', 'Which homes sold nearby?', 'What should I offer?'], sources: ['Microburbs valuation', 'Microburbs sales'] });
      } else {
        const lv = pct > 0.1 ? 'red' : pct > 0.04 ? 'amber' : 'green';
        add({ id: 'value', finding: 1, level: lv, tag: lv === 'green' ? 'Fair price' : 'Pricey',
          title: pct > 0.1 ? 'Priced above similar sales' : pct > 0.04 ? 'A little above similar sales' : pct < -0.04 ? 'Below similar sales' : 'In line with similar sales',
          line: `${isGuide ? 'Guide' : 'Asks'} ${S(ref)}. Similar homes sold for about ${S(mid)}.`, anchors: [{ type: 'price' }], proof: marketProof,
          meaning: (pct > 0.04 ? `About ${S(ref - mid)} more than the going price. That money doesn’t earn rent.` : pct < -0.04 ? 'Under the going price. Check why: condition, noise or strata issues are common reasons.' : 'Close to what similar homes sell for.') + caveat,
          next: pct > 0.04 ? `Offer closer to ${S(Math.round(mid / 5000) * 5000)} and show the agent the sales.` : 'Get a building and pest report before you commit.',
          questions: ['Which homes sold nearby?', 'What should I offer?'], sources: ['Microburbs valuation', 'Microburbs sales'] });
      }
      if (sale.kind === 'range' && sale.high / sale.low > 1.12) add({ id: 'range', finding: 3, level: 'amber', title: 'Very wide price range', line: `${S(sale.low)} to ${S(sale.high)}: a ${Math.round((sale.high / sale.low - 1) * 100)}% spread.`, anchors: [{ type: 'price' }], meaning: 'A wide range tells you little about what the seller will accept.', next: 'Ask the agent what the seller will accept.', sources: ['The ad'] });
    }
    // "Priced to sell", "below valuation" (traps 4, 6)
    if (has('pricedToSell') && mid && sale.price) {
      const above = sale.price > mid * 1.03;
      const bait = sale.kind !== 'fixed' && sale.price < mid * 0.92;   // a low guide, not a low price
      add({ id: 'priced', finding: 4, dup: true, level: above ? 'amber' : bait ? 'amber' : 'green',
        title: above ? 'Says priced to sell, isn’t cheap' : bait ? '“Priced to sell” rests on the low guide' : '“Priced to sell” holds up',
        line: above ? `${S(sale.price)} is above the ${S(mid)} similar homes sold for.` : bait ? `Expect to pay near the ${S(mid)} similar homes sold for, not ${S(sale.price)}.` : `${S(sale.price)} is at or under what similar homes sold for.`,
        anchors: [{ type: 'claim', key: 'pricedToSell' }], proof: marketProof, meaning: bait ? 'A guide set under the market makes a home look cheap. The final price is set by what buyers pay, and similar homes sold for more.' : undefined, sources: ['Microburbs sales'] });
    }

    // 2. What it would rent for, and the agent's rent appraisal (traps 11, 13, 15)
    const R = I.rent;
    if (R?.est) {
      const rentProof = { kind: 'bars', items: [ad.appraisal && { label: ad.appraisal.leased ? 'Leased at' : 'Ad says', v: ad.appraisal.value }, { label: 'Lumo', v: R.est, me: !ad.appraisal }, mk.medianRent && { label: 'Suburb', v: mk.medianRent }].filter(Boolean).map((x, i) => (ad.appraisal && i === 0 ? { ...x, me: true } : x)),
        note: `Lumo’s figure: ${R.basis}.`, rows: (F.comps?.sample || []).slice(0, 4).map((c) => [c.address || 'Similar rental', M(c.price) + ' a week']) };
      if (ad.appraisal) {
        const d = (ad.appraisal.value - R.est) / R.est;
        const lv = d > 0.12 ? 'red' : d > 0.05 ? 'amber' : 'green';
        add({ id: 'appraisal', finding: ad.appraisal.leased ? 13 : 11, level: lv, tag: 'Rent claim', title: lv === 'red' ? 'Rent appraisal looks high' : lv === 'amber' ? 'Rent appraisal is generous' : 'Rent appraisal holds up',
          line: `Ad says ${M(ad.appraisal.value)} a week. Lumo expects about ${M(R.est)}.`, anchors: [{ type: 'claim', key: 'appraisal' }], proof: rentProof,
          meaning: d > 0.05 ? `The selling agent writes this appraisal, and a high one makes the yield look better. At ${M(R.est)}, you get ${M((ad.appraisal.value - R.est) * 52)} less a year.` : 'The rent in the ad is close to what similar homes rent for.',
          next: d > 0.05 ? (ad.appraisal.leased ? 'Ask for the lease and the tenant’s ledger. A lease to a friend or above market won’t last.' : 'Ask a property manager who isn’t selling the home for their own appraisal.') : 'Ask for the current lease end date.',
          questions: ['What will it rent for?', 'Which similar homes are for rent?'], sources: [R.method === 'model' ? R.basis : R.method === 'comps' ? 'Microburbs rentals' : 'Microburbs yield and value'] });
      } else {
        add({ id: 'rent', finding: 11, level: 'info', title: `Rents for about ${M(R.est)} a week`, line: R.method === 'comps' ? `${R.n} similar homes for rent now${R.low ? `: ${M(R.low)} to ${M(R.high)}` : ''}.` : R.method === 'model' ? 'From your rent model.' : `Estimate from the ${R.method === 'yield' ? 'suburb yield and value' : 'suburb median'}.`,
          proof: rentProof, meaning: R.method === 'yield' ? 'Few similar homes are for rent right now, so this uses the suburb’s rent return applied to the value. Treat it as a rough guide.' : 'This is the rent to plan on, before costs.',
          next: 'Ask the agent for a written rental appraisal and compare.', questions: ['What will it rent for?'], sources: [R.method === 'comps' ? 'Microburbs rentals' : R.method === 'model' ? R.basis : 'Microburbs market'] });
      }
    } else add({ id: 'rent', finding: 11, level: 'grey', title: 'Rent not estimated yet', line: 'Needs rentals or a rent model for this suburb.', sources: [] });

    // 3. Rent return (yield) and holding cost (traps 12, 92)
    if (model?.gross != null) {
      const sy = mk.yield;
      const lv = sy ? (model.gross >= sy * 1.05 ? 'green' : model.gross >= sy * 0.9 ? 'info' : 'amber') : model.net >= 0.03 ? 'green' : 'info';
      // Far above the suburb usually means the price will end up higher than the ad says, not a bargain.
      const tooGood = sy && model.gross > sy * 1.5 && sale.kind !== 'fixed';
      add({ id: 'yield', finding: 12, level: tooGood ? 'amber' : lv, title: tooGood ? 'Rent return looks too good' : lv === 'green' ? 'Better rent return than the suburb' : lv === 'amber' ? 'Lower rent return than the suburb' : 'Rent return in line with the suburb',
        line: `${P1(model.gross)} gross, ${P1(model.net)} after costs.${sy ? ` Suburb: ${P1(sy)}.` : ''}${tooGood ? ' Likely the price ends up above the guide.' : ''}`, anchors: has('yield') ? [{ type: 'claim', key: 'yield' }] : [],
        proof: { kind: 'bars', fmt: 'pct', items: [{ label: 'Gross', v: model.gross, me: true }, { label: 'After costs', v: model.net }, sy && { label: 'Suburb', v: sy }].filter(Boolean), note: `On ${S(model.price)}, ${model.priceBasis}. Costs are in Numbers.` },
        meaning: 'Gross yield is rent over price. After costs is what is left once strata, rates, insurance, the manager and empty weeks are paid, before the loan.',
        next: 'Open Numbers to see each cost and change the deposit and rate.', questions: ['What does it cost to hold?', 'What will it rent for?'], sources: ['Lumo’s sums', 'Microburbs market'] });
      add({ id: 'cashflow', finding: 21, level: model.weekly >= 0 ? 'green' : 'info', title: model.weekly >= 0 ? `Pays for itself: +${M(model.weekly)} a week` : `Costs about ${M(-model.weekly)} a week to hold`,
        line: `With ${model.set.deposit}% down at ${model.set.rate}%${model.set.io ? ' interest only' : ''}. Cash to buy: about ${S(model.upfront.total)}.`,
        proof: { kind: 'cash', model }, meaning: model.weekly < 0 ? 'Rent doesn’t cover the loan and costs, so you top it up each week. Some of that may come back at tax time (negative gearing), depending on your income. Ask an accountant.' : 'Rent covers the loan and the running costs at these settings.',
        next: 'Change the deposit, rate and loan type in Numbers.', questions: ['What does it cost to hold?', 'How much cash do I need?'], sources: ['Lumo’s sums'] });
    }

    // 4. Growth and the market (traps 21–25)
    const g = mk.growth;
    if (g && (g['10yr'] != null || g['5yr'] != null)) {
      const yrs = g['10yr'] != null ? 10 : 5, total = g[yrs + 'yr'];
      const cagr = Math.pow(1 + total, 1 / yrs) - 1;
      const lv = g['1yr'] != null && g['1yr'] < -0.02 ? 'amber' : cagr >= 0.05 ? 'green' : cagr < 0.02 ? 'amber' : 'info';
      add({ id: 'growth', finding: 21, level: lv, title: lv === 'green' ? 'Strong long-term growth' : g['1yr'] < -0.02 ? 'Prices fell this year' : cagr < 0.02 ? 'Slow growth' : 'Steady growth',
        line: `${sub} ${I.mt}s: ${P1(cagr)} a year over ${yrs} years${g['1yr'] != null ? `, ${g['1yr'] >= 0 ? '+' : ''}${P1(g['1yr'])} in the last year` : ''}.`, anchors: has('growth') ? [{ type: 'claim', key: 'growth' }] : [],
        proof: { kind: 'growth', g, forecast: mk.forecast, mt: I.mt, sub },
        meaning: has('growth') ? 'The ad talks up growth. These are the suburb’s actual numbers over several time frames, so one good year can’t hide a slow decade.' : 'Past growth for this kind of home in the suburb. It is no promise, but it shows the trend.',
        next: mk.forecast ? `Microburbs expects ${P1(mk.forecast.low)} to ${P1(mk.forecast.high)} next year (most likely ${P1(mk.forecast.most_likely)}).` : 'Compare with nearby suburbs before you decide.',
        questions: ['Is this a growth or a rent play?', 'Will prices keep rising?'], sources: ['Microburbs price growth', mk.forecast && 'Microburbs forecast'].filter(Boolean) });
    }

    // 5. Tenant demand: vacancy (trap 19)
    if (mk.vacancy != null) {
      const v = mk.vacancy;
      const lv = v <= 0.015 ? 'green' : v >= 0.03 ? 'amber' : 'info';
      add({ id: 'vacancy', finding: 19, level: has('demand') && lv === 'amber' ? 'red' : lv, title: has('demand') && v >= 0.03 ? 'Says strong demand, many sit empty' : has('demand') && v <= 0.015 ? '“Strong rental demand” holds up' : v <= 0.015 ? 'Tenants are easy to find' : v >= 0.03 ? 'Rentals here sit empty longer' : 'Normal tenant demand',
        line: `${P1(v)} of ${sub} ${I.mt} rentals are empty right now.`, anchors: has('demand') ? [{ type: 'claim', key: 'demand' }] : [],
        meaning: v <= 0.015 ? 'Under 1.5% is a tight market: new tenants come quickly and rents tend to rise.' : v >= 0.03 ? 'Above 3% means landlords compete for tenants. Expect more empty weeks and less room to raise rent.' : 'Between 1.5% and 3% is a balanced market.',
        next: 'Ask how long the last tenants stayed.', sources: ['Microburbs vacancy rate'] });
    }

    // 6. Supply: homes for sale and new homes approved nearby (traps 30–40)
    const s1 = I.supply1km;
    if (mk.monthsSupply != null || s1) {
      const lots = (s1?.dwellings || 0) >= 100, glut = mk.monthsSupply > 6;
      const lv = glut || lots ? 'amber' : (s1 ? s1.dwellings < 30 : true) && (mk.monthsSupply ?? 0) <= 4 ? 'green' : 'info';
      const scarce = has('scarce');
      add({ id: 'supply', finding: 31, level: scarce && lv === 'amber' ? 'red' : lv,
        title: scarce && lv === 'amber' ? 'Says rare, plenty coming' : glut ? 'Lots for sale, few buyers' : lots ? 'Many new homes approved nearby' : scarce ? '“Tightly held” holds up' : 'Little new supply nearby',
        line: [mk.monthsSupply != null && `${mk.monthsSupply} months of homes for sale`, s1 && `${s1.dwellings} new home${s1.dwellings === 1 ? '' : 's'} approved within 1 km since late 2024`].filter(Boolean).join('. ') + '.',
        anchors: scarce ? [{ type: 'claim', key: 'scarce' }] : [],
        proof: s1?.biggest?.length && F.home ? { kind: 'map', home: F.home, ring: 1000, points: s1.biggest.map((x) => ({ name: x.address.replace(/ \d{4}$/, ''), lat: x.lat, lng: x.lng, d: x.d, kind: 'da', info: `${x.dwellings} new home${x.dwellings > 1 ? 's' : ''}${x.storeys ? ', ' + x.storeys + ' storeys' : ''}` })),
          rows: s1.biggest.slice(0, 4).map((x) => [x.address.replace(/ \d{4}$/, ''), `${x.dwellings} home${x.dwellings > 1 ? 's' : ''} · ${LUMO.dist(x.d)}`]) } : null,
        meaning: 'Months of supply is how long the homes for sale now would take to sell at today’s pace. Under 4 favours sellers; over 6 favours buyers. New approvals nearby add rentals that compete with yours.',
        next: lots ? 'Look at what is being built: if it is the same kind of home, rents may flatten.' : 'Supply looks steady.',
        sources: ['Microburbs months of supply', s1 && 'NSW Planning Portal DAs'].filter(Boolean) });
    }

    // 7. Investor-heavy area (trap 35)
    if (mk.investorShare != null && (mk.investorShare > 55 || mk.investorShare < 35)) {
      const hi = mk.investorShare > 55;
      add({ id: 'investors', finding: 35, level: hi ? 'amber' : 'green', title: hi ? 'Mostly rentals around here' : 'Mostly owner-occupiers', line: `${Math.round(mk.investorShare)}% of homes in ${sub} are rented out.`,
        meaning: hi ? 'Lots of rentals means more competition for tenants, and fewer owner-occupiers to sell to later. They often pay the most.' : 'Owner-occupiers keep streets cared for and pay well when you sell.', sources: ['Microburbs investor concentration'] });
    }

    // 8. This home's own history (traps 5, 36)
    const H = I.history;
    if (H?.rows?.length) {
      const last = H.lastSale;
      const recentSale = last && Date.now() - new Date(last.date) < 2 * 365 * 864e5;
      const unsold = H.rows.filter((h) => /sale/i.test(h.type) && h.price && (!last || new Date(h.date) > new Date(last.date)));
      const prevAsk = unsold[0];
      let lv = 'info', title = 'Sale history', line = '';
      if (last) {
        const years = (Date.now() - new Date(last.date)) / (365 * 864e5);
        const ref = mid || sale.price;
        const cg = ref && years > 1 ? Math.pow(ref / last.price, 1 / years) - 1 : null;
        line = `Sold for ${S(last.price)} in ${yr(last.date)}${cg != null ? `. Value since: ${cg >= 0 ? '+' : ''}${P1(cg)} a year` : ''}.`;
        title = recentSale ? 'Sold under 2 years ago' : 'Last sold ' + new Date(last.date).getFullYear();
        if (recentSale) lv = 'amber';
      }
      if (prevAsk) { line += ` Listed at ${S(prevAsk.price)} in ${yr(prevAsk.date)}${sale.price && sale.price < prevAsk.price ? `, now cheaper` : ''} and didn’t sell then.`; lv = 'amber'; title = 'On the market before'; }
      add({ id: 'history', finding: 36, level: lv, title, line: line.trim(), anchors: [{ type: 'address' }],
        proof: { kind: 'history', title: 'Sale history', rows: H.rows.map((h) => ({ date: h.date, price: h.price, label: /sold/i.test(h.type) ? 'Sold' : 'Listed' })) },
        meaning: prevAsk ? 'It was offered before and didn’t sell. Ask what has changed since, and why it didn’t sell.' : recentSale ? 'A quick resale can mean the owner found a problem. Ask why they are selling.' : 'A long hold before selling is usually a good sign.',
        next: 'Ask the agent why the owner is selling.', questions: ['Why is the owner selling?'], sources: ['Microburbs sale history'] });
    }

    // 9. Approved plans on this lot, zoning and land (traps 17, 83, 84)
    if (I.siteDAs?.length) {
      const d = I.siteDAs[0];
      const approved = /determined|approved/i.test(d.status);
      add({ id: 'site', finding: 83, level: 'info', tag: 'Plans', title: approved ? 'Plans already approved on this lot' : 'Plans lodged for this lot', line: `${d.kinds.split(';')[0]}${d.cost ? `, ${S(d.cost)} of work` : ''}, lodged ${yr(d.date)}.`, anchors: [{ type: 'address' }],
        meaning: approved ? 'An approval can add value: the next owner may not need to apply again. Approvals usually lapse after 5 years if work hasn’t started.' : 'The owner applied to build here. Ask whether the application comes with the sale.',
        next: 'Ask if the approval and plans come with the sale, and look it up on the NSW Planning Portal.', sources: ['NSW Planning Portal DAs'] });
    }
    if (I.land) {
      const share = mid ? I.land.value / mid : null;
      const r2 = /R2|low density/i.test(I.land.zone || '');
      if (has('devPotential')) add({ id: 'zoning', finding: 84, level: r2 ? 'amber' : 'info', title: r2 ? 'Development potential is limited' : `Zoned ${I.land.zone}`, line: `Zoned ${I.land.zone}${I.land.area ? ` on ${Math.round(I.land.area)} m²` : ''}.`, anchors: [{ type: 'claim', key: 'devPotential' }],
        meaning: r2 ? 'Low density zoning rules out apartments. A granny flat or a duplex may be allowed, depending on lot size and council rules.' : 'Check what this zone allows before paying for potential.', next: 'Ask the council for a planning certificate (section 10.7).', sources: ['Microburbs land values'] });
      if (kind === 'house' && share) add({ id: 'land', finding: 7, level: share >= 0.55 ? 'green' : 'info', title: share >= 0.55 ? 'Most of the value is land' : `Land is ${Math.round(share * 100)}% of the value`,
        line: `Land valued at ${S(I.land.value)}${I.land.area ? ` (${Math.round(I.land.area)} m²)` : ''}. ${LUMO.landTax(I.land.value) ? `Land tax about ${M(LUMO.landTax(I.land.value))} a year.` : 'Under the NSW land tax threshold on its own.'}`,
        proof: I.land.history?.length ? { kind: 'history', title: 'Council land value', rows: I.land.history.slice().reverse().map((h) => ({ date: h.year + '-07-01', price: h.value, label: 'Land' })) } : null,
        meaning: 'Land tends to rise in value while buildings wear out, so a high land share usually means better long-term growth. Land tax adds up if you own other land in NSW.',
        sources: ['Microburbs land values', 'Revenue NSW'] });
    }

    // 10. Strata (traps 71–74)
    if (kind !== 'house') {
      const med = mk.strataLevy;
      if (ad.strata) {
        const y = ad.strata.yearly;
        const lv = med && y < med * 0.6 ? 'amber' : med && y > med * 1.6 ? 'amber' : 'info';
        add({ id: 'strata', finding: 71, level: lv, title: lv === 'amber' ? (y < med * 0.6 ? 'Strata looks low' : 'Strata is high') : 'Strata levies listed', line: `${M(ad.strata.value)}${ad.strata.per === 4 ? ' a quarter' : ad.strata.per === 1 ? ' a year' : ad.strata.per === 12 ? ' a month' : ' (period not stated)'}${med ? `. Suburb median: ${M(med)} a year` : ''}.`, anchors: [{ type: 'claim', key: 'strata' }],
          meaning: y < (med || 0) * 0.6 ? 'Low levies can mean a thin sinking fund, so a special levy comes later for big repairs.' : 'Levies pay for building upkeep and insurance. Big amenities push them up.',
          next: 'Ask for the strata report: sinking fund balance, special levies and defects.', sources: ['The ad', med && 'Microburbs strata levies'].filter(Boolean) });
      } else add({ id: 'strata', finding: 71, level: 'amber', title: 'Strata levies not in the ad', line: med ? `Typical in ${sub}: ${M(med)} a year.` : 'Ask the agent for the levies.', meaning: 'Levies come off your rent every quarter, and the sinking fund shows if big repair bills are coming.', next: 'Ask for the levies and a strata report before you offer.', sources: med ? ['Microburbs strata levies'] : [] });
    }

    // 11. Pressure in the ad (traps 9, 10, 99)
    const dom = F.daysOnMarket ? F.daysOnMarket[I.mt] : null;
    if (has('pressure') || dom) {
      add({ id: 'dom', finding: 9, level: has('pressure') ? 'amber' : 'info', title: has('pressure') ? 'Pressure words in the ad' : `Homes here sell in about ${Math.round(dom)} days`,
        line: has('pressure') ? `${dom ? `Similar homes take about ${Math.round(dom)} days to sell. ` : ''}Lumo can’t confirm other offers.` : `Typical for ${kinds} in ${sub}.`,
        anchors: has('pressure') ? [{ type: 'claim', key: 'pressure' }] : [],
        meaning: 'Words like “motivated vendor” or “won’t last” are there to rush you. Your checks matter more than the agent’s timeline.',
        next: 'Take the time to get a building and pest report and the contract reviewed.', sources: dom ? ['Microburbs days on market'] : ['The ad'] });
    }

    // 12. Bushfire (risk the ad leaves out, trap 62)
    const bf = F.risks?.bushfire?.[0];
    if (bf && (bf.on_property || bf.nearest_distance_m <= 100)) add({ id: 'bushfire', finding: 62, level: 'amber', title: bf.on_property ? 'Bushfire-prone land' : 'Bushfire-prone land next door', line: bf.on_property ? 'The lot is mapped as bushfire-prone.' : `The nearest bushfire-prone land is ${Math.round(bf.nearest_distance_m)} m away.`, meaning: 'Insurance can cost more, and new building work must meet bushfire rules (BAL), which adds cost.', next: 'Get an insurance quote before you offer.', sources: ['Microburbs risks'] });

    // 13. Agent quoting accuracy (trap 1), only with a full key
    if (I.quoting?.data) {
      const q = I.quoting.data, dev = q.median_deviation_pct ?? q.median_guide_vs_sold_pct;
      if (dev != null) add({ id: 'quoting', finding: 1, level: dev > 8 ? 'red' : dev > 4 ? 'amber' : 'green', title: dev > 4 ? 'This agency’s guides run low' : 'This agency quotes close', line: `Its homes sell ${Math.round(dev)}% ${dev >= 0 ? 'above' : 'below'} the guide, on median.`, anchors: [{ type: 'price' }], sources: ['Microburbs agent quoting'] });
    }

    // 14. Stamp duty and cash to buy
    if (model) add({ id: 'duty', finding: 22, level: 'info', title: `Stamp duty about ${S(model.upfront.duty)}`, line: `Cash to buy about ${S(model.upfront.total)} with ${model.set.deposit}% down.`, proof: { kind: 'cash', model, upfront: true },
      meaning: 'NSW transfer duty at 2026–27 rates. Investors don’t get first home buyer concessions.', next: 'Add lender fees and lenders mortgage insurance if your deposit is under 20%.', questions: ['How much cash do I need?'], sources: ['Revenue NSW'] });

    // Shared checks from the renter rules, worded for a buyer.
    const base = LUMO.rules(L, F, P, claims).filter((c) => SHARED.includes(c.id) && c.level !== 'grey');
    for (const c of base) out.push({ ...c, line: forBuyer(c.line), meaning: forBuyer(c.meaning), next: forBuyer(c.next), questions: (c.questions || []).map(forBuyer) });
    if (!I.value?.mid && !I.market?.medianPrice && !L.demo) add({ id: 'nodata', level: 'grey', title: 'Market data locked for this suburb', line: 'The free test key covers a few suburbs. Add your Microburbs key in Settings.', sources: [] });

    const ORDER = { red: 0, amber: 1, green: 2, info: 3, grey: 4 };
    const seen = new Set();
    return out.filter((c) => !seen.has(c.id) && seen.add(c.id)).sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  };
})();
