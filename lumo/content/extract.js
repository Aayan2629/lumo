// Reads the listing the person is looking at. Order: the page's own data blob, then the visible page.
// Lumo only reads the page in front of the person; it never crawls other pages.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // Is this page one rental listing?
  LUMO.pageKind = () => {
    const h = location.hostname, p = location.pathname;
    if ($('meta[name="lumo-demo"]')) return 'demo';
    if (/domain\.com\.au$/.test(h) && /-\d{5,}\/?$/.test(p) && !/^\/(rent|sale|sold-listings|property-profile|project|buy)\//.test(p)) return 'domain';
    if (/realestate\.com\.au$/.test(h) && /^\/property-[a-z-]+-\d{5,}\/?$/.test(p)) return 'rea';
    return null;
  };

  // Weekly rent from text like "$750 per week", "$3,000 pcm", "$750pw".
  LUMO.parseRent = (s) => {
    const m = String(s || '').replace(/ /g, ' ').match(/\$\s?([\d,]{3,6})(?:\.\d+)?\s*(per\s*week|p\.?w\.?|\/\s*w(?:ee)?k|weekly|a week|per\s*month|p\.?c\.?m\.?|\/\s*month)?/i);
    if (!m) return null;
    let n = Number(m[1].replace(/,/g, ''));
    if (m[2] && /month|pcm/i.test(m[2])) n = Math.round((n * 12) / 52);
    return n >= 80 && n <= 20000 ? n : null;
  };

  // Find {latitude, longitude} anywhere inside a blob.
  function findCoords(o, depth = 0) {
    if (!o || typeof o !== 'object' || depth > 8) return null;
    const la = o.latitude ?? o.lat, lo = o.longitude ?? o.lng ?? o.lon;
    if (typeof la === 'number' && typeof lo === 'number' && la < -9 && la > -45 && lo > 110 && lo < 155) return { lat: la, lng: lo };
    for (const k in o) { const r = findCoords(o[k], depth + 1); if (r) return r; }
    return null;
  }

  function fromDomain() {
    try {
      const cp = JSON.parse($('#__NEXT_DATA__').textContent).props.pageProps.componentProps;
      const s = cp.listingSummary || {};
      const h1 = text($('h1'));
      // After in-app navigation the blob can be from the first page. Check it matches.
      if (h1 && cp.street && !h1.toLowerCase().includes(String(cp.street).toLowerCase().split(' ')[0])) return null;
      return {
        address: s.address, suburb: cp.suburb, state: cp.stateAbbreviation || cp.state || (s.address || '').match(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/)?.[1], postcode: cp.postcode,
        priceText: s.title, price: LUMO.parseRent(s.title), beds: s.beds, baths: s.baths, parking: s.parking,
        type: s.propertyType || cp.propertyType, rent: (s.listingType || s.mode) === 'rent',
        description: Array.isArray(cp.description) ? cp.description.join('\n') : cp.description,
        features: (cp.structuredFeatures || []).map((f) => f.name).concat(cp.features || []),
        // The listing's own pin first; a deep search could pick up a nearby listing's coordinates.
        ...(cp.map && typeof cp.map.latitude === 'number' ? { lat: cp.map.latitude, lng: cp.map.longitude } : findCoords(cp.rootGraphQuery || cp))
      };
    } catch { return null; }
  }

  function fromRea() {
    try {
      const src = $$('script').map((s) => s.textContent).find((t) => t.includes('ArgonautExchange'));
      const blob = JSON.parse(src.match(/ArgonautExchange\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:window\.|$)/)[1]);
      let listing = null;
      for (const app of Object.values(blob)) {
        const cache = typeof app.urqlClientCache === 'string' ? JSON.parse(app.urqlClientCache) : app.urqlClientCache;
        for (const v of Object.values(cache || {})) {
          const d = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;
          listing = d?.details?.listing || listing;
        }
      }
      if (!listing) return null;
      const g = listing.generalFeatures || {}, a = listing.address || {};
      const c = a.display?.geocode || findCoords(listing) || {};
      return {
        address: a.display?.fullAddress, suburb: a.suburb, state: a.state, postcode: a.postcode,
        priceText: listing.price?.display, price: LUMO.parseRent(listing.price?.display),
        beds: g.bedrooms?.value, baths: g.bathrooms?.value, parking: g.parkingSpaces?.value,
        type: listing.propertyType?.display, rent: listing.channel === 'rent',
        description: String(listing.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''), lat: c.latitude, lng: c.longitude
      };
    } catch { return null; }
  }

  function fromDemo() {
    try { return JSON.parse($('#lumo-demo-data').textContent); } catch { return null; }
  }

  // ---------- page regions (where to look for words and photos) ----------
  const DESC = ['[data-lumo="description"]', '[data-testid="listing-details__description"]', '[data-testid*="description"]', '[class*="property-description"]', '[class*="PropertyDescription"]'];
  const HEAD = ['[data-lumo="headline"]', '[data-testid="listing-details__description-headline"]', '[class*="description__headline"]'];
  const FEAT = ['[data-lumo="features"]', '[data-testid*="additional-features"]', '[data-testid="property-features"]', '[class*="property-features"]', '[class*="propertyFeatures"]'];
  const PRICE = ['[data-lumo="price"]', '[data-testid="listing-details__summary-title"]', '[data-testid*="price"]', '.property-price', '[class*="property-price"]', '[class*="PropertyPrice"]'];
  const GALLERY = ['[data-lumo="gallery"]', '[data-testid*="gallery"]', '[class*="gallery"]', '[class*="Gallery"]', '[class*="carousel"]', '[class*="Carousel"]'];
  const first = (sels) => { for (const s of sels) { const el = $(s); if (el && text(el)) return el; } return null; };

  // Fallback: the block with the most paragraph text is the ad description.
  function biggestTextBlock() {
    const score = new Map();
    for (const p of $$('main p, article p, p')) {
      const t = text(p);
      if (t.length < 60 || p.closest('nav,footer,header,aside')) continue;
      const parent = p.parentElement;
      score.set(parent, (score.get(parent) || 0) + t.length);
    }
    let best = null, top = 0;
    for (const [el, n] of score) if (n > top) { best = el; top = n; }
    return top > 250 ? best : null;
  }

  // Fallback: the smallest element near the top whose text is a weekly rent.
  function priceElement() {
    const el = first(PRICE);
    if (el && LUMO.parseRent(text(el))) return el;
    const cands = $$('h1,h2,h3,h4,p,span,div,strong').filter((e) => {
      const t = text(e);
      if (t.length > 60 || !LUMO.parseRent(t)) return false;
      const r = e.getBoundingClientRect();
      return r.top + scrollY < 1600 && r.width > 0;
    });
    return cands.sort((a, b) => text(a).length - text(b).length)[0] || null;
  }

  LUMO.photos = () => {
    const root = first(GALLERY) || document.body;
    return $$('img', root).filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width >= 220 && r.height >= 150 && !img.closest('[data-lumo-ui]');
    });
  };

  LUMO.extract = () => {
    const kind = LUMO.pageKind();
    if (!kind) return null;
    const data = (kind === 'domain' ? fromDomain() : kind === 'rea' ? fromRea() : fromDemo()) || {};
    const priceEl = priceElement();
    const desc = first(DESC) || biggestTextBlock();
    const L = {
      site: kind, url: location.href.split('#')[0], demo: kind === 'demo',
      address: data.address || text($('h1')), suburb: data.suburb, state: data.state, postcode: data.postcode,
      price: data.price || LUMO.parseRent(text(priceEl)), priceText: data.priceText || text(priceEl),
      beds: data.beds, baths: data.baths, parking: data.parking, type: data.type,
      lat: data.lat, lng: data.lng, gnaf: data.gnaf,
      description: data.description || text(desc), rent: data.rent !== false,
      photo: (LUMO.photos()[0] || {}).currentSrc || ''
    };
    // Fill gaps from visible text
    const blob = text(document.body).slice(0, 20000);
    if (L.beds == null) L.beds = Number(blob.match(/(\d)\s*(?:bed(?:room)?s?|br)\b/i)?.[1]) || null;
    if (L.parking == null) L.parking = Number(blob.match(/(\d)\s*(?:car|parking|garage)/i)?.[1]) || 0;
    if (!L.suburb && L.address) L.suburb = L.address.split(',').slice(-1)[0].replace(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b.*$/, '').trim();
    L.regions = { price: priceEl, text: [first(HEAD), desc, first(FEAT)].filter(Boolean) };
    return L;
  };
})();
