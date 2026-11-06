// Pins Lumo's marks to the ad's own words and photos.
// Text: the CSS Custom Highlight API paints ranges inside the page's text, so marks move with
// the words when you scroll, resize or the page reflows. Lumo never edits the page's DOM.
// Photos: a thin glowing edge drawn over the photo, recalculated when it moves.
(() => {
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|svg)$/i;

  // Map every text node under a root to one long string, so a match can span tags.
  function textMap(root) {
    const nodes = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && !SKIP.test(n.parentElement.tagName) && !n.parentElement.closest('[data-lumo-ui]') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    let s = '', n;
    while ((n = walker.nextNode())) { nodes.push({ node: n, start: s.length }); s += n.data; }
    return { s, nodes };
  }
  function rangeAt(map, from, to) {
    const locate = (i, end) => {
      for (let k = map.nodes.length - 1; k >= 0; k--) {
        const x = map.nodes[k];
        if (end ? x.start < i : x.start <= i) return { node: x.node, off: Math.min(i - x.start, x.node.data.length) };
      }
      return null;
    };
    const a = locate(from, false), b = locate(to, true);
    if (!a || !b) return null;
    const r = document.createRange();
    r.setStart(a.node, a.off); r.setEnd(b.node, b.off);
    return r;
  }

  // Find the ad's claims ("quiet street", "light-filled") as live ranges.
  LUMO.findClaims = (roots, claims) => {
    const found = [], used = [];
    for (const root of roots) {
      if (!root || used.some((u) => u.contains(root))) continue;
      used.push(root);
      const map = textMap(root);
      for (const c of claims) {
        let hits = 0;
        for (const p of c.patterns) {
          const re = new RegExp(p, 'gi');
          let m;
          while ((m = re.exec(map.s)) && hits < 2) {
            // Skip negated phrases like "not far from".
            const before = map.s.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
            if (/\bnot\s+$|\bno\s+$/.test(before)) continue;
            if (found.some((f) => f.root === root && m.index < f.to && m.index + m[0].length > f.from)) continue;
            const range = rangeAt(map, m.index, m.index + m[0].length);
            if (range) { found.push({ key: c.key, finding: c.finding, text: m[0], range, root, from: m.index, to: m.index + m[0].length }); hits++; }
          }
        }
      }
    }
    return found;
  };

  // A range over the dollar amount inside the price element, or the h1 address.
  LUMO.rangeFor = (el, re) => {
    if (!el) return null;
    const map = textMap(el);
    const m = re ? re.exec(map.s) : { index: map.s.search(/\S/), 0: map.s.trim() };
    return m && m.index >= 0 ? rangeAt(map, m.index, m.index + m[0].length) : null;
  };

  // The rent itself ("$980 per week"), never the bond or another dollar figure near it.
  // Looks in the price block first, then a little wider, then the whole page.
  function priceRange(L) {
    // For sale: the whole guide, "$1,400,000 - $1,500,000" or "$1.4m".
    if (L.sale) {
      const re = /\$\s?\d[\d,]*(?:\.\d+)?\s*(?:m(?:il(?:lion)?)?\b|k\b)?(?:\s*(?:-|–|to)\s*\$?\s?\d[\d,]*(?:\.\d+)?\s*(?:m(?:il(?:lion)?)?\b|k\b)?)?/gi;
      const el = L.regions.price;
      for (const scope of [el, el?.parentElement].filter(Boolean)) {
        const map = textMap(scope); re.lastIndex = 0; let m;
        while ((m = re.exec(map.s))) { const v = Number(m[0].replace(/^\$\s?/, '').split(/[^\d,.]/)[0].replace(/,/g, '')); if (v >= 50000 || /\d\s*(m|k)/i.test(m[0])) return rangeAt(map, m.index, m.index + m[0].trimEnd().length); }
      }
      // No dollar figure ("Auction", "Contact agent"): mark the price line itself.
      return el ? LUMO.rangeFor(el) : null;
    }
    const any = /\$\s?[\d,]{3,6}(?:\.\d+)?/g;
    const exact = L.price ? new RegExp('\\$\\s?' + L.price.toLocaleString('en-AU').replace(',', ',?') + '(?![\\d,])', 'g') : any;
    const el = L.regions.price;
    const scopes = [el, el?.parentElement, el?.parentElement?.parentElement, document.querySelector('main'), document.body].filter(Boolean);
    for (const scope of scopes) {
      const map = textMap(scope);
      for (const re of [exact, any]) {
        re.lastIndex = 0; let m;
        while ((m = re.exec(map.s))) {
          const before = map.s.slice(Math.max(0, m.index - 14), m.index).toLowerCase();
          if (/bond|deposit|holding/.test(before)) continue;   // skip "Bond $3920"
          return rangeAt(map, m.index, m.index + m[0].length);
        }
        if (!L.price) break;
      }
    }
    return null;
  }

  // ---------- marks ----------
  const HL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
  const RANK = { red: 3, amber: 2, green: 1, info: 0, grey: -1 };
  LUMO.supportsHighlights = HL;

  // Is this text actually on screen? Sites fold long descriptions into a box with overflow hidden
  // ("Read more"). A mark inside the folded part would be counted but never seen.
  LUMO.rangeVisible = (range) => {
    if (!LUMO.rangeAlive(range)) return false;
    const r = [...range.getClientRects()].find((x) => x.width > 1 && x.height > 1);
    if (!r) return false;
    for (let p = range.startContainer.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') {
        const pr = p.getBoundingClientRect();
        if (r.bottom <= pr.top + 2 || r.top >= pr.bottom - 2 || r.right <= pr.left + 2 || r.left >= pr.right - 2) return false;
      }
    }
    return true;
  };

  // Where each check can show on the page when the ad has no claim word for it.
  // Tried in order. Strings are places: 'price', 'street' (the address), 'suburb' (the suburb's name in the
  // address or the ad), 'facts:parking|beds|baths|land' (the summary strip). Regexes are topic words in the ad.
  // Each check takes a spot no other check has taken yet, so every coloured row in the panel has its own mark.
  const W = (s) => new RegExp('\\b(?:' + s + ')\\b', 'i');
  const TOPICS = {
    price: ['price'], value: ['price'], budget: ['price', 'facts:beds'], lastRent: ['price', 'street'], dom: [W('available|vacant|now|immediately|won.?t last|motivated'), 'price'],
    parking: ['facts:parking', W('car ?spaces?|car ?park(?:ing)?|parking|garages?|carport')],
    quiet: [W('quiet|peaceful|street|road|location|pocket|bedrooms?'), 'street'],
    latenight: [W('nightlife|bars?|pubs?|restaurants?|dining|entertainment'), 'street'],
    transport: [W('stations?|trains?|bus(?:es)?|light rail|metro|transport|ferr(?:y|ies)|cbd|city'), 'suburb'],
    night: [W('stations?|trains?|walk(?:ing)?|nightlife|transport'), 'suburb'], nightRide: [W('cbd|city|nightlife|transport'), 'suburb'],
    commute: [W('cbd|city|universit(?:y|ies)|uni|unsw|campus|work|transport'), 'suburb'],
    light: [W('light|sun(?:ny|lit)?|bright|north'), 'street'], views: [W('views?|outlook|glimpses?|vista|balcony'), 'street'],
    build: [W('views?|outlook|balcony|quiet|street|location'), 'street'],
    crime: [W('safe|secure|security|intercom|family'), 'suburb'], flood: [W('garage|basement|ground floor|courtyard|level|low'), 'suburb'],
    bushfire: [W('bush(?:land)?|reserve|trees|garden|backyard|nature'), 'suburb'], trees: [W('leafy|trees?|garden|green|parks?'), 'suburb'],
    beach: [W('beach(?:es)?|coast(?:al)?|ocean|sea|surf'), 'suburb'], cafes: [W('caf(?:e|é)s?|restaurants?|dining|shops?|village'), 'suburb'],
    gym: [W('gyms?|fitness|pool'), 'suburb'], shops: [W('shops?|shopping|supermarkets?|woolworths|coles|aldi|village'), 'suburb'],
    census: ['postcode', 'suburb'], relisted: ['street'], renovated: [W('renovat\\w*|new|updated|modern')], laundry: [W('laundry')], aircon: [W('air ?con\\w*|cooling|split[- ]system')], photos: ['street'],
    // Investor mode
    yield: [W('invest\\w*|return|yield|income'), 'price'], cashflow: [W('invest\\w*|income|return'), 'price'], duty: ['price'], range: ['price'], quoting: ['price'], priced: ['price'],
    rent: [W('rental|rent|lease[ds]?|tenant(?:ed|s)?|income'), 'price'], appraisal: [W('rental|lease[ds]?|tenant(?:ed|s)?'), 'price'],
    growth: [W('growth|blue[- ]chip|sought[- ]after|tightly held|desirable'), 'suburb'], vacancy: [W('demand|tenants?|rental|lease'), 'suburb'],
    supply: [W('rare|scarce|tightly held|limited|opportunity'), 'suburb'], investors: [W('invest\\w*|owner[- ]occupiers?|families'), 'postcode', 'suburb'],
    history: ['street'], site: [W('plans?|approved|DA|development|potential|granny flat|extend'), 'street'],
    zoning: ['facts:land', W('block|land|lot|potential|development'), 'street'], land: ['facts:land', W('block|land|lot|backyard|yard'), 'street'],
    strata: [W('strata|levies|body corporate|building|complex|block'), 'price']
  };
  const topicsFor = (id) => TOPICS[id] || TOPICS[id.replace(/-.*$/, '')] || ['street'];

  // Every match of a pattern inside an element, as live ranges.
  function matchesIn(el, re) {
    if (!el) return [];
    const map = textMap(el), g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), out = [];
    let m;
    while ((m = g.exec(map.s)) && out.length < 12) {
      if (!m[0].trim()) { g.lastIndex++; continue; }
      const r = rangeAt(map, m.index, m.index + m[0].length);
      if (r) out.push(r);
    }
    return out;
  }

  // Build marks from checks: one per range/photo, keeping the most serious level.
  LUMO.buildMarks = (checks, L, claims) => {
    const text = new Map(), photos = new Map();
    const put = (map, key, target, check) => {
      const m = map.get(key) || { key, target, level: check.level, checks: [] };
      if (!m.checks.includes(check.id)) m.checks.push(check.id);
      if (RANK[check.level] > RANK[m.level]) m.level = check.level;
      map.set(key, m);
    };
    const priceR = priceRange(L);
    const h1 = document.querySelector('h1');
    // The address splits into the street (this home) and the suburb (the area), so each can carry its own checks.
    const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const street = h1 ? (L.address || h1.textContent).split(',')[0].trim() : '';
    const addrR = (street && matchesIn(h1, new RegExp(esc(street), 'i'))[0]) || LUMO.rangeFor(h1);
    const imgs = LUMO.photos();
    const placed = new Set();          // checks that got a visible mark
    const vis = (r) => r && LUMO.rangeVisible(r);
    for (const c of checks) {
      if (c.level === 'grey') continue;
      for (const a of c.anchors) {
        if (a.type === 'claim') claims.filter((x) => x.key === a.key && vis(x.range)).forEach((x, i) => { put(text, 'claim:' + a.key + i, x.range, c); placed.add(c.id); });
        else if (a.type === 'price' && vis(priceR)) { put(text, 'price', priceR, c); placed.add(c.id); }
        else if (a.type === 'address' && vis(addrR)) { put(text, 'street', addrR, c); placed.add(c.id); }
        else if (a.type === 'photo') {
          const img = a.match ? imgs.find((im) => (im.currentSrc || im.src).includes(a.match)) : imgs[a.index || 0];
          if (img) { put(photos, 'p:' + (a.match || a.index || 0), img, c); placed.add(c.id); }
        }
      }
    }

    // Every red, amber and green check gets a mark of its own, even when the ad has no claim word for it.
    const roots = [...(L.regions.text || []), L.regions.facts].filter(Boolean);
    const taken = new Set([...text.keys()]);
    const keyOf = (r) => { const s = r.startContainer; return (s.__lumoId ||= Math.random().toString(36).slice(2)) + ':' + r.startOffset + ':' + r.endOffset; };
    const sub = String(L.suburb || '').trim();
    const crumbs = document.querySelector('nav[aria-label*="readcrumb"], [class*="readcrumb"], [data-testid*="readcrumb"], .crumbs');
    const inside = (r, outer) => { try { return r.compareBoundaryPoints(Range.START_TO_START, outer) >= 0 && r.compareBoundaryPoints(Range.END_TO_END, outer) <= 0; } catch { return false; } };
    const FACT = { parking: W('\\d+\\s*(?:parking|cars?|car ?spaces?|garages?|carports?)'), beds: W('\\d+\\s*(?:beds?|bedrooms?)'), baths: W('\\d+\\s*(?:baths?|bathrooms?)'), land: /\d[\d,]*\s*(?:m²|m2|sqm|square metres)/i };
    const spots = (t) => {
      if (t instanceof RegExp) return roots.flatMap((el) => matchesIn(el, t)).map((r) => ['t:' + keyOf(r), r]);
      if (t === 'price') return priceR ? [['price', priceR]] : [];
      if (t === 'street') return addrR ? [['street', addrR]] : [];
      // The suburb's name wherever it shows: after the street in the address, the ad, the breadcrumbs.
      if (t === 'suburb') return sub ? [h1, ...roots, crumbs].filter(Boolean).flatMap((el) => matchesIn(el, new RegExp('\\b' + esc(sub) + '\\b', 'i'))).filter((r) => !addrR || !inside(r, addrR)).map((r) => ['t:' + keyOf(r), r]) : [];
      if (t === 'postcode') return h1 ? matchesIn(h1, /\b(?:NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\s+\d{4}\b/).map((r) => ['t:' + keyOf(r), r]) : [];
      if (t.startsWith('facts:')) { const re = FACT[t.slice(6)]; return re ? [L.regions.facts, ...roots].filter(Boolean).flatMap((el) => matchesIn(el, re)).map((r) => ['t:' + keyOf(r), r]) : []; }
      return [];
    };
    // A topic word that sits inside a mark already there (a claim) would hide one colour under another.
    const overlaps = (r) => [...text.values()].some((m) => { try { return r.compareBoundaryPoints(Range.END_TO_START, m.target) < 0 && r.compareBoundaryPoints(Range.START_TO_END, m.target) > 0; } catch { return false; } });
    const ORDER = { red: 0, amber: 1, green: 2 };
    // A check also needs a spot when all its words already show another check's colour ("views" under a red "build").
    const ownColour = (c) => [...text.values(), ...photos.values()].some((m) => m.checks.includes(c.id) && m.level === c.level);
    const todo = checks.filter((c) => ORDER[c.level] != null && !c.dup && (!placed.has(c.id) || !ownColour(c))).sort((a, b) => ORDER[a.level] - ORDER[b.level]);
    for (const c of todo) {
      const list = [...topicsFor(c.id), 'suburb', 'postcode', 'street'];
      let pick = null;
      // First a spot nobody has, then share the first spot that works.
      for (const t of list) { pick = spots(t).find(([k, r]) => !taken.has(k) && vis(r) && !overlaps(r)); if (pick) break; }
      // Nothing free: share a mark that is already there (the same words), never half-cover another one.
      // Prefer sharing with a mark of the same colour, so the colour on the page still matches the panel.
      const same = (k) => text.get(k)?.level === c.level;
      if (!pick && placed.has(c.id)) continue;   // it has a mark already; don't share one just for colour
      if (!pick) for (const t of list) { pick = spots(t).find(([k, r]) => vis(r) && same(k)); if (pick) break; }
      if (!pick) for (const t of list) { pick = spots(t).find(([k, r]) => vis(r) && (taken.has(k) || !overlaps(r))); if (pick) break; }
      if (!pick) continue;
      put(text, pick[0], pick[1], c); taken.add(pick[0]); placed.add(c.id);
    }
    return { text: [...text.values()], photos: [...photos.values()] };
  };

  // Paint text marks with native highlights (they follow the words for free).
  // While data loads, the claim words glow softly gold so you can see Lumo found them.
  LUMO.paintReading = (claims) => { if (HL && claims.length) CSS.highlights.set('lumo-reading', new Highlight(...claims.map((c) => c.range))); };
  LUMO.paint = (marks) => {
    if (!HL) return false;
    CSS.highlights.delete('lumo-reading');
    for (const lv of ['red', 'amber', 'green']) {
      const ranges = marks.text.filter((m) => m.level === lv).map((m) => m.target);
      if (ranges.length) CSS.highlights.set('lumo-' + lv, new Highlight(...ranges));
      else CSS.highlights.delete('lumo-' + lv);
    }
    return true;
  };
  LUMO.unpaint = () => { if (HL) ['red', 'amber', 'green', 'focus', 'reading'].forEach((l) => CSS.highlights.delete('lumo-' + l)); };
  LUMO.focusPaint = (range) => {
    if (!HL) return;
    if (range) CSS.highlights.set('lumo-focus', new Highlight(range)); else CSS.highlights.delete('lumo-focus');
  };

  // A range is dead when the page re-rendered that text.
  LUMO.rangeAlive = (r) => r && r.startContainer.isConnected && r.endContainer.isConnected && !r.collapsed;

  // Visible part of an element, clipped by any scrolling or overflow-hidden parent (galleries).
  LUMO.visibleRect = (el) => {
    let r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const pr = p.getBoundingClientRect();
        x1 = Math.max(x1, pr.left); y1 = Math.max(y1, pr.top); x2 = Math.min(x2, pr.right); y2 = Math.min(y2, pr.bottom);
      }
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return null;
    }
    if (x2 - x1 < 40 || y2 - y1 < 40) return null;
    return { left: x1, top: y1, width: x2 - x1, height: y2 - y1, radius: getComputedStyle(el).borderRadius };
  };
})();
