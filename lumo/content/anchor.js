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

  // Build marks from checks: one per range/photo, keeping the most serious level.
  LUMO.buildMarks = (checks, L, claims) => {
    const text = new Map(), photos = new Map();
    const put = (map, key, target, check) => {
      const m = map.get(key) || { key, target, level: check.level, checks: [] };
      m.checks.push(check.id);
      if (RANK[check.level] > RANK[m.level]) m.level = check.level;
      map.set(key, m);
    };
    const priceR = priceRange(L);
    const addrR = LUMO.rangeFor(document.querySelector('h1'));
    const imgs = LUMO.photos();
    for (const c of checks) {
      if (c.level === 'grey') continue;
      for (const a of c.anchors) {
        if (a.type === 'claim') claims.filter((x) => x.key === a.key).forEach((x, i) => put(text, a.key + i, x.range, c));
        else if (a.type === 'price' && priceR) put(text, 'price', priceR, c);
        else if (a.type === 'address' && addrR) put(text, 'address', addrR, c);
        else if (a.type === 'photo') {
          const img = a.match ? imgs.find((im) => (im.currentSrc || im.src).includes(a.match)) : imgs[a.index || 0];
          if (img) put(photos, 'p:' + (a.match || a.index || 0), img, c);
        }
      }
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
