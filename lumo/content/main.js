// Starts Lumo on a listing page, and keeps it pinned while the page changes underneath.
(() => {
  if (LUMO.started) return;                 // added twice (manifest + toolbar): run once
  LUMO.started = true;
  let url = '', run = 0, data = null, mo = null, heal = 0, reading = 0;
  const log = (...a) => console.info('[Lumo]', ...a);

  async function start(fromClick) {
    reading++;
    try { await run1(fromClick); } catch (e) { console.warn('[Lumo] stopped:', e); LUMO.ui.note && LUMO.ui.note('Lumo hit a problem on this page'); }
    finally { reading--; }
  }
  // For voice shortcuts: make sure Lumo is on this page, the same way the toolbar icon does.
  // False when this isn't a listing. Doesn't restart a scan that is already running.
  LUMO.ensureStarted = () => {
    if (data || reading) return true;
    if (!LUMO.pageKind()) return false;
    start(true);
    return true;
  };
  async function run1(fromClick) {
    const id = ++run;
    LUMO.ui.destroy();
    data = null;
    // Open "Read more" first, so marks in the folded part of the ad can be seen.
    if (LUMO.pageKind() && LUMO.expandAd()) await new Promise((r) => setTimeout(r, 450));
    if (id !== run) return;
    const L = LUMO.extract();
    log('page', LUMO.pageKind() || 'not a listing', L ? { address: L.address, price: L.price, beds: L.beds, lat: L.lat, forSale: !L.rent } : '');
    if (!L) { if (fromClick) LUMO.ui.note('Open a listing and Lumo will check it'); return; }
    // To rent: checks for a renter. For sale: Investor mode (content/invest.js).
    const mode = L.rent ? 'rent' : 'invest';
    LUMO.loadFonts();
    LUMO.ui.scanning();
    const [state, kb] = await Promise.all([LUMO.send('state'), LUMO.send('knowledge')]);
    if (id !== run) return;
    if (!state || !kb) { log('no answer from the extension; reload it in chrome://extensions'); LUMO.ui.note('Reload Lumo in chrome://extensions'); return; }
    const claims = LUMO.findClaims(L.regions.text, claimsFor(kb, mode));
    log(claims.length + ' claims found in the ad:', claims.map((c) => c.text).join(', '));
    LUMO.paintReading(claims);
    const { regions, ...plain } = L;
    const F = (await Promise.race([LUMO.send('facts', { listing: plain }), new Promise((r) => setTimeout(() => r(null), 28000))])) || { sources: [], errors: ['data took too long'] };
    if (id !== run) return;
    log('data from', (F.sources || []).map((x) => x.name).join(', ') || 'nothing', F.errors?.length ? { gaps: F.errors } : '');
    // The page had no map pin, but the data found the home: use it for Maps and Street View.
    if (!(L.lat && L.lng) && F.home) { L.lat = F.home.lat; L.lng = F.home.lng; }
    const checks = mode === 'invest' ? LUMO.investRules(L, F, state.profile, claims) : LUMO.rules(L, F, state.profile, claims);
    data = { mode, L, F, checks, claims, state, kb, marks: LUMO.buildMarks(checks, L, claims) };
    log(checks.length + ' checks,', data.marks.text.length + ' words and ' + data.marks.photos.length + ' photos marked');
    LUMO.ui.render(data);
    // Every red, amber and green check should have a mark on the page. Say in the console if one doesn't.
    const marked = new Set([...data.marks.text, ...data.marks.photos].flatMap((m) => m.checks));
    const missing = checks.filter((c) => ['red', 'amber', 'green'].includes(c.level) && !c.dup && !marked.has(c.id)).map((c) => c.id);
    if (missing.length) log('no place on the page for:', missing.join(', '));
    LUMO._last = data;   // for debugging in the console
    watch();
  }

  // Claims marked "rent" only matter in a rental ad, "invest" only in an ad for sale.
  const claimsFor = (kb, mode) => kb.claims.claims.filter((c) => !c.mode || c.mode === mode);

  // Sites like Domain re-render parts of the page. If our words disappear, find them again.
  function watch() {
    mo && mo.disconnect();
    mo = new MutationObserver(() => {
      clearTimeout(heal);
      heal = setTimeout(() => {
        if (!data) return;
        const dead = data.marks.text.some((m) => !LUMO.rangeAlive(m.target)) || data.marks.photos.some((m) => !m.target.isConnected);
        if (!dead) return;
        const L = LUMO.extract();
        if (!L) return;
        data.L.regions = L.regions;
        data.claims = LUMO.findClaims(L.regions.text, claimsFor(data.kb, data.mode));
        data.marks = LUMO.buildMarks(data.checks, data.L, data.claims);
        data.rerender = true;
        LUMO.ui.render(data);
      }, 350);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // Single-page sites change the URL without reloading. Check every second.
  setInterval(() => { if (location.href.split('#')[0] !== url) { url = location.href.split('#')[0]; setTimeout(start, 700); } }, 1000);
  url = location.href.split('#')[0];
  start();

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg.type === 'toggle') { if (data) LUMO.ui.toggle(); else start(true); reply(true); }
  });
})();
