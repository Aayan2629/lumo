// Turns the listing, the facts and the renter's profile into checks.
// A check is one thing Lumo can say about this home: red (problem), amber (worth a look),
// green (good sign), info (useful), grey (can't check yet).
// Every number shown comes from facts. If a fact is missing, the check says so instead of guessing.
(() => {
  const M = (n) => LUMO.money(n);
  const yr = (d) => new Date(d).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
  const title = (x) => String(x || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const ORDER = { red: 0, amber: 1, green: 2, info: 3, grey: 4 };

  LUMO.rules = (L, F, P, claims) => {
    const has = (k) => claims.some((c) => c.key === k);
    const S = F.sample || {};
    const out = [];
    const add = (c) => out.push({ anchors: [], questions: [], sources: [], ...c });
    const typeWord = /house|town|villa|terrace/i.test(L.type || '') ? 'houses' : 'units';
    const bedWord = L.beds ? L.beds + '-bed ' : '';
    const sub = F.suburb || L.suburb || 'this area';

    // ---------- 1. Price against similar homes (finding 1) ----------
    let fair = null, fairSrc = '', basis = '';
    if (F.model && (F.model.with || F.model.without)) {
      fair = L.parking > 0 ? F.model.with : F.model.without || F.model.with;
      fairSrc = F.model.source; basis = 'Lumo’s rent model';
    } else if (F.comps) {
      const c = F.comps;
      if (L.parking > 0 && c.withPark.n >= 2) { fair = c.withPark.median; basis = `${c.withPark.n} similar ${bedWord}${typeWord} with parking`; }
      else if (!(L.parking > 0) && c.without.n >= 2) { fair = c.without.median; basis = `${c.without.n} similar ${bedWord}${typeWord} without parking`; }
      else if (c.n >= 3) { fair = c.median; basis = `${c.n} similar ${bedWord}${typeWord}`; }
      fairSrc = 'Microburbs listings';
    }
    let priceLevel = null;
    if (L.price && fair) {
      const diff = L.price - fair, pct = diff / fair;
      priceLevel = pct > 0.08 ? 'red' : pct > 0.03 ? 'amber' : 'green';
      add({
        id: 'price', finding: 1, level: priceLevel,
        title: pct > 0.08 ? 'Bad value: above similar homes' : pct > 0.03 ? 'A little above similar homes' : pct < -0.03 ? 'Good value: below similar homes' : 'Fair price for the area',
        tag: pct > 0.03 ? 'Pricey' : 'Good value',
        line: `Asks ${M(L.price)}. Similar homes here ask ${M(fair)}.`,
        anchors: [{ type: 'price' }],
        // items keeps the old two-bar shape for the hero meter; the detail view draws the whole market.
        proof: { kind: 'market', items: [{ label: 'This ad', v: L.price, me: true }, { label: 'Similar', v: fair }], me: L.price, median: fair, prices: F.comps?.prices || [], comps: F.comps?.sample || [], note: `Similar is the middle of ${basis} in ${sub}.` },
        meaning: diff > 0 ? `About ${M(diff)} a week more than similar homes. That is ${M(diff * 52)} over a year.` : diff < 0 ? `About ${M(-diff)} a week under similar homes. That is ${M(-diff * 52)} a year saved. Good value if the rest checks out.` : 'Right on the going rate.',
        next: diff > 0 ? `Offer closer to ${M(Math.round(fair / 10) * 10)}, and ask Lumo for the similar ones.` : 'Apply early. Homes under the going rate go fast.',
        questions: ['Which similar homes are cheaper?', 'What should I offer?', 'Will the price drop?'],
        sources: [fairSrc]
      });
    } else if (!L.price) {
      add({ id: 'price', finding: 1, level: 'grey', title: 'No price shown', line: 'The ad hides the rent, so Lumo can’t compare it.', anchors: [], questions: ['What do similar homes ask?'], sources: [] });
    } else {
      add({ id: 'price', finding: 1, level: 'grey', title: 'Fair rent not checked yet', line: 'Connect Microburbs or your rent model in Settings.', anchors: [{ type: 'price' }], sources: [] });
    }

    // "Great value" claim (finding 2)
    if (has('value') && priceLevel) {
      const bad = priceLevel !== 'green';
      add({
        id: 'value', finding: 2, dup: true, level: bad ? priceLevel : 'green',
        title: bad ? 'Says great value, isn’t' : 'Value claim holds up',
        line: bad ? `It asks ${M(L.price - fair)} a week over similar homes.` : 'The rent is in line with similar homes.',
        anchors: [{ type: 'claim', key: 'value' }], proof: out[0].proof, meaning: out[0].meaning, next: out[0].next,
        questions: out[0].questions, sources: out[0].sources
      });
    }

    // Over budget (personal)
    if (L.price && P.onboarded && P.budget && L.price > P.budget) {
      add({ id: 'budget', level: L.price > P.budget * 1.05 ? 'red' : 'amber', title: 'Over your budget', line: `${M(L.price - P.budget)} a week over your ${M(P.budget)}.`, anchors: [{ type: 'price' }], meaning: 'Rent above a third of your income gets hard fast.', next: 'Look at the similar homes Lumo found, or split with a housemate.', questions: ['Find homes like this in my budget', 'What should I offer?'], sources: ['Your profile'] });
    }

    // ---------- 2. Quiet street (finding 51) ----------
    if (Array.isArray(F.venues150)) {
      const v = F.venues150, n = v.length;
      const closest = v[0];
      const src = F.sources.some((s) => s.name.startsWith('Microburbs')) ? 'Microburbs places' : 'OpenStreetMap';
      const proof = { kind: 'map', home: F.home, ring: 150, points: v.slice(0, 24).map((p) => ({ ...p, kind: 'venue' })) };
      const q = ['Which venues are closest?', 'Is the back of the building quieter?', 'Find a quieter street nearby'];
      if (has('quiet')) {
        add({
          id: 'quiet', finding: 51, level: n >= 3 ? 'red' : n ? 'amber' : 'green',
          title: n >= 3 ? 'Not a quiet street' : n ? 'Some licensed places close by' : 'Quiet holds up',
          line: n ? `${n} liquor-licensed place${n > 1 ? 's' : ''} within 150 m. Closest ${closest.d} m.` : 'No pubs or bars within 150 m.',
          anchors: [{ type: 'claim', key: 'quiet' }], proof,
          meaning: n >= 3 ? 'Liquor licences this close (pubs, bars, restaurants, bottle shops) usually mean late noise on Friday and Saturday.' : n ? 'One or two venues can be loud on weekends, depending on the side you face.' : 'Nothing that trades late is right next door.',
          next: n ? 'Visit on a Friday night, and ask for a flat facing away from the street.' : 'Still check for a main road or bus stop outside.',
          questions: q, sources: [src]
        });
      } else if (n >= 3) {
        add({ id: 'quiet', finding: 51, level: 'amber', title: 'Licensed places next door', line: `${n} liquor-licensed places within 150 m.`, anchors: [], proof, meaning: 'Some may be restaurants or bottle shops. Pubs and bars are the loud ones on weekend nights.', next: 'Visit on a Friday night before you apply.', questions: q, sources: [src] });
      }
    }

    // ---------- 3. Close to transport (finding 41) ----------
    const mbT = F.transport?.nearest || {};
    const rail = [mbT.train && { name: mbT.train.label, d: mbT.train.distance_m, lat: mbT.train.lat, lng: mbT.train.lng, mode: 'train' },
      mbT.tram && { name: mbT.tram.label, d: mbT.tram.distance_m, lat: mbT.tram.lat, lng: mbT.tram.lng, mode: 'light rail' },
      ...(F.stations || []), S.station && { ...S.station, sample: true }].filter(Boolean).sort((a, b) => a.d - b.d)[0];
    const bus = (mbT.bus && { name: mbT.bus.label, d: mbT.bus.distance_m, lat: mbT.bus.lat, lng: mbT.bus.lng }) || F.busStop || S.busStop;
    if (rail) {
      const w = LUMO.walk(rail.d), busNear = bus && bus.d <= 200;
      const level = w <= 8 ? 'green' : w <= 15 ? 'amber' : busNear ? 'amber' : 'red';
      const nw = F.nightWalk && F.nightWalk.from?.name === rail.name ? F.nightWalk : null;
      const proof = nw ? { kind: 'route', home: F.home, route: nw, to: rail, label: `${nw.minutes} min walk`, mode: 'walking' }
        : { kind: 'map', home: F.home, points: [{ ...rail, kind: 'station' }, bus && { ...bus, name: bus.name || 'Bus stop', kind: 'bus' }].filter(Boolean) };
      const src = rail.sample ? 'Sample data' : F.transport ? 'Microburbs transport' : 'OpenStreetMap';
      if (has('transport') || w <= 8) {
        add({
          id: 'transport', finding: 41, level: has('transport') ? level : 'green', sample: !!rail.sample,
          title: w <= 8 ? 'Station is close' : level === 'red' ? 'Not close to a station' : busNear ? 'Bus close, station far' : 'Station is a fair walk',
          line: `${rail.name} is about ${w} min on foot (${LUMO.dist(rail.d)}).` + (busNear && w > 8 ? (bus.d < 40 ? ' A bus stop is right outside.' : ` A bus stop is ${bus.d} m away.`) : ''),
          anchors: has('transport') ? [{ type: 'claim', key: 'transport' }] : [], proof,
          meaning: w <= 8 ? 'Easy to get around without a car.' : busNear ? 'Buses are at the door, but the train is a real walk, worse in rain or late at night.' : 'A long walk to the train, every day you commute.',
          next: 'Check your own commute at the time you leave.',
          questions: ['How long is my commute?', 'Is there a night bus home?', 'Which station is best for me?'], sources: [src]
        });
      }
    } else if (has('transport')) {
      add({ id: 'transport', finding: 41, level: 'grey', title: 'Transport not checked yet', line: 'Lumo needs the exact location to time the walk.', anchors: [], sources: [] });
    }

    // ---------- 4. Light (finding 62) and views (finding 63), on the photos ----------
    if (has('light')) {
      if (S.light) add({ id: 'light', finding: 62, sample: true, ...S.light, anchors: [{ type: 'claim', key: 'light' }, { type: 'photo', match: S.light.photo }], questions: ['How many hours of sun in winter?', 'Which rooms get the morning sun?', 'Is a higher floor brighter?'], sources: ['Sample data'] });
      else add({ id: 'light', finding: 62, level: 'grey', title: '“Light-filled” not checked yet', line: 'Needs building heights around the address.', anchors: [], questions: ['Which way does it face?'], sources: [] });
    }
    // ---------- Building work nearby (NSW Planning Portal, findings 55, 63, 81) ----------
    const das = F.das || [];
    if (das.length) {
      const big = das.filter((d) => d.storeys >= 4 || d.dwellings >= 6);
      const close = das.filter((d) => d.d <= 120);
      const top = big[0] || das[0];
      const lv = big.some((d) => d.d <= 150) || close.length >= 2 ? 'red' : big.length || close.length ? 'amber' : 'info';
      const what = (d) => `${d.storeys ? d.storeys + '-storey ' : ''}${/demolition/i.test(d.kinds) ? 'rebuild' : /residential flat|shop top|mixed/i.test(d.kinds) ? 'apartment block' : 'building work'}${d.dwellings ? `, ${d.dwellings} home${d.dwellings > 1 ? 's' : ''}` : ''}`;
      const yr = (d) => (d.date || '').slice(0, 4);
      add({
        id: 'build', finding: 55, level: lv, tag: 'Building',
        title: lv === 'red' ? 'Big building work next door' : lv === 'amber' ? 'Building work nearby' : 'Some building work nearby',
        line: `${das.length} approved or pending ${das.length > 1 ? 'projects' : 'project'} within 300 m. Biggest: ${what(top)}, ${top.d} m away.`,
        anchors: has('views') ? [{ type: 'claim', key: 'views' }] : [],
        // Impact: red = big and close, amber = big or close, grey = small and further away.
        proof: { kind: 'das', home: F.home, ring: 300, items: das.map((d) => {
          const bigOne = d.storeys >= 4 || d.dwellings >= 6, near = d.d <= 120;
          const impact = bigOne && d.d <= 150 ? 'red' : bigOne || near ? 'amber' : 'grey';
          const state = /determined|approved/i.test(d.status) ? 'Approved' : /assessment|information|exhibition|lodg/i.test(d.status) ? 'Pending' : title(d.status);
          return { name: d.address.replace(/ \d{4}$/, '').replace(/ (Bondi Beach|Bondi Junction|Bondi|North Bondi)$/, ''), suburb: (d.address.match(/(Bondi Beach|Bondi Junction|North Bondi|Bondi)$/) || [])[1] || '',
            lat: d.lat, lng: d.lng, d: d.d, storeys: d.storeys, dwellings: d.dwellings, what: what(d).replace(/^\d+-storey /, ''), state, year: yr(d), impact };
        }) },
        meaning: lv === 'info' ? 'Small projects. Some noise during work hours.' : 'Expect construction noise, trucks and dust for a year or more, and taller neighbours after. Views and sun can change.',
        next: 'Ask the agent when work starts, and look up the DA on the NSW Planning Portal.',
        questions: ['When does the building work start?', 'Will it block my view?'], sources: ['NSW Planning Portal DAs']
      });
    }

    if (has('views')) {
      const bigNear = das.find((d) => d.storeys >= 3 && d.d <= 200);
      if (bigNear) add({ id: 'views', finding: 63, level: 'amber', tag: 'View', title: 'View could be built out', line: `A ${bigNear.storeys}-storey project is ${bigNear.d} m away (${bigNear.status.toLowerCase()}).`, anchors: [{ type: 'claim', key: 'views' }], proof: { kind: 'map', home: F.home, points: [{ name: bigNear.address, lat: bigNear.lat, lng: bigNear.lng, d: bigNear.d, kind: 'da' }] }, meaning: 'If it rises between you and the view, the view may go.', next: 'Check which side of the building the view is on.', sources: ['NSW Planning Portal DAs'] });
      else if (S.view) add({ id: 'views', finding: 63, sample: true, ...S.view, anchors: [{ type: 'claim', key: 'views' }, { type: 'photo', match: S.view.photo }], questions: ['When would building start?', 'Which floors keep the view?'], sources: ['Sample data'] });
      else add({ id: 'views', finding: 63, level: 'grey', title: 'View not checked yet', line: 'Needs nearby approved buildings.', anchors: [], sources: [] });
    }

    // ---------- 5. Car space (findings 11, 13) ----------
    let worth = null;
    if (F.model?.with && F.model?.without) worth = F.model.with - F.model.without;
    else if (F.comps?.withPark.n >= 2 && F.comps?.without.n >= 2) worth = F.comps.withPark.median - F.comps.without.median;
    if (worth != null && worth <= 0) worth = null;
    if (L.parking > 0) {
      if (P.car === false) add({ id: 'parking', finding: 13, level: 'amber', title: 'Paying for parking you won’t use', line: worth ? `A space here adds about ${M(worth)} a week.` : 'This rent includes a car space.', anchors: [{ type: 'claim', key: 'parking' }], proof: worth ? { kind: 'bars', items: [{ label: 'With a space', v: F.comps?.withPark.median || F.model.with, me: true }, { label: 'Without', v: F.comps?.without.median || F.model.without }], note: `Similar ${bedWord}${typeWord} in ${sub}.` } : null, meaning: worth ? `That is ${M(worth * 52)} a year for a space you don’t need.` : 'You may be paying for something you don’t need.', next: 'Ask if the space can be leased out or taken off the rent.', questions: ['What is a car space worth here?', 'Find similar homes without parking'], sources: [fairSrc || 'Your profile'] });
      else if (worth) add({ id: 'parking', finding: 11, level: 'green', title: 'Car space included', line: `Worth about ${M(worth)} a week here.`, anchors: [{ type: 'claim', key: 'parking' }], sources: [fairSrc] });
    } else if (P.car === true) {
      add({ id: 'parking', finding: 14, level: 'amber', title: 'No car space', line: 'You drive, and this home has no parking listed.', anchors: [], questions: ['Is street parking easy here?'], sources: ['Your profile'] });
    }

    // ---------- 6. Listing history (findings 31, 36, 37) ----------
    const hist = (F.history && F.history.length ? F.history : S.history || []).filter((h) => h.date);
    const isSample = !(F.history && F.history.length) && !!S.history;
    if (hist.length) {
      const since = Date.now() - 3 * 365 * 864e5;
      const recent = hist.filter((h) => new Date(h.date) > since);
      const sorted = hist.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
      // The last lease before this ad: the newest priced record older than two months.
      const prev = sorted.find((h) => h.price && Date.now() - new Date(h.date) > 60 * 864e5);
      const rows = sorted.slice(0, 5).map((h) => ({ date: h.date, price: h.price }));
      if (recent.length >= 3) add({ id: 'relisted', finding: 31, level: 'red', sample: isSample, title: 'Relisted often', line: `Advertised ${recent.length} times in 3 years.`, anchors: [{ type: 'address' }], proof: { kind: 'history', rows }, meaning: 'Tenants keep leaving. Ask why: noise, damp, or a hard landlord are common reasons.', next: 'Ask how long the last tenants stayed.', questions: ['Why might tenants leave?', 'What did it rent for before?'], sources: [isSample ? 'Sample data' : 'Microburbs rent history'] });
      if (prev && prev.price && L.price) {
        const jump = (L.price - prev.price) / prev.price;
        add({ id: 'lastRent', finding: 36, level: jump > 0.12 ? 'red' : jump > 0.06 ? 'amber' : 'green', sample: isSample, title: jump > 0.06 ? `Up ${Math.round(jump * 100)}% since last lease` : 'Close to last rent', line: `Last leased for ${M(prev.price)} in ${yr(prev.date)}.`, anchors: [{ type: 'price' }], proof: { kind: 'history', rows }, meaning: jump > 0.06 ? 'A big jump at relisting. Asking for the old rent is fair.' : 'The rent has stayed steady.', next: jump > 0.06 ? `Offer near ${M(Math.round(prev.price * 1.05 / 10) * 10)}.` : 'No pushback needed on this.', questions: ['What should I offer?', 'Will the price drop?'], sources: [isSample ? 'Sample data' : 'Microburbs rent history'] });
      }
    }

    // ---------- 7. Safety and risk (findings 73, 71) ----------
    if (F.crime && Number.isFinite(F.crime.vs_national_pct)) {
      const p = F.crime.vs_national_pct;
      if (p >= 10 || p <= -10 || has('safe')) add({ id: 'crime', finding: 73, level: p >= 25 ? 'red' : p >= 10 ? 'amber' : 'green', title: p >= 10 ? 'Crime above average' : 'Lower crime than average', line: `${sub} is ${Math.abs(p)}% ${p >= 0 ? 'above' : 'below'} the national median.`, anchors: has('safe') ? [{ type: 'claim', key: 'safe' }] : [], meaning: p >= 10 ? 'Mostly theft and late-night incidents in busy areas. Street level varies.' : 'Fewer incidents than most of Australia.', next: p >= 10 ? 'Walk the route home after dark once.' : 'No action needed.', questions: ['Is the walk home safe at night?', 'Show the night walk'], sources: ['Microburbs crime'] });
    }
    // Night walk home from the station, with street lighting along the way (findings 77, 78).
    const nw = F.nightWalk;
    if (nw && nw.line) {
      const known = nw.knownPct >= 50 && nw.litPct != null;
      const lv = !known ? 'grey' : nw.litPct >= 80 ? 'green' : nw.litPct >= 50 ? 'amber' : 'red';
      add({
        id: 'night', finding: 77, level: lv,
        title: !known ? 'Night walk: lighting not mapped' : lv === 'green' ? 'Well-lit walk home' : lv === 'amber' ? 'Some dark stretches on the walk home' : 'Dark walk home',
        line: `${nw.minutes} min from ${nw.from.name}${known ? ` · ${nw.litPct}% lit${nw.mainPct ? ' or on main roads' : ''}` : ` · lighting mapped on ${nw.knownPct || 0}% of it`}${nw.lampCount ? `, ${nw.lampCount} street light${nw.lampCount > 1 ? 's' : ''}` : ''}.`,
        anchors: [], proof: { kind: 'route', home: F.home, route: nw, to: nw.from, night: true, label: `${nw.minutes} min walk`, mode: 'walking' },
        meaning: !known ? 'OpenStreetMap has little lighting data on this walk, so Lumo can’t say how dark it is.' : lv === 'green' ? 'Street lights most of the way from the station to the door.' : 'Gaps in the lighting are marked red on the map. Those are the stretches to avoid late at night.',
        next: known && lv !== 'green' ? 'Walk it once after dark, or take the bus that stops closer.' : 'Walk it once after dark before you sign.',
        questions: ['Is the walk home safe at night?', 'Is there a night bus home?'], sources: ['OpenStreetMap lighting and routes' + (nw.lightSource === 'snapshot' ? ' (saved copy)' : '')]
      });
    }

    const fl = F.risks?.flood?.[0];
    if (fl) add({ id: 'flood', finding: 71, level: fl.on_property ? 'red' : 'green', title: fl.on_property ? 'Flood overlay on this property' : 'Not in a flood zone', line: fl.value || '', anchors: [], meaning: fl.on_property ? 'Ground floors and basement parking are most at risk.' : 'The nearest flood area is not on this property.', sources: ['Microburbs risks'] });
    else if (F.suburbRisks?.flood) add({ id: 'flood', finding: 71, level: F.suburbRisks.flood.coverage_pct > 5 ? 'amber' : 'green', title: F.suburbRisks.flood.coverage_pct > 5 ? 'Parts of the suburb flood' : 'No flood zone nearby', line: `${F.suburbRisks.flood.coverage_pct}% of ${sub} is flood-prone.`, anchors: [], sources: ['Microburbs risks'] });

    // ---------- Local incomes and rents (ABS Census 2021, findings 9, 86) ----------
    const C = F.census;
    if (C && L.price && C.householdIncome) {
      const share = Math.round((L.price / C.householdIncome) * 100);
      const rise = C.medianRent ? Math.round(((L.price - C.medianRent) / C.medianRent) * 100) : null;
      add({
        id: 'census', finding: 9, level: share >= 45 ? 'amber' : 'info',
        title: `${share}% of a local household's income`,
        line: `Typical household income here was ${M(C.householdIncome)} a week at the 2021 Census.`,
        anchors: [], proof: { kind: 'bars', items: [{ label: 'This rent', v: L.price, me: true }, { label: '2021 median rent', v: C.medianRent }, { label: 'Household income', v: C.householdIncome }], note: `ABS Census 2021, postcode ${C.postcode}. The 2021 median rent covers all rentals in the postcode, old and new leases.` },
        meaning: share >= 45 ? 'Rent this high relative to local incomes usually means share houses or high turnover.' : 'In line with what locals earn.',
        next: rise != null ? `This ad is ${rise}% above the area's 2021 median rent of ${M(C.medianRent)}.` : '',
        sources: ['ABS Census 2021']
      });
    }
    // City of Sydney: street trees and late-night trading streets
    if (F.cos?.trees100 >= 15) add({ id: 'trees', finding: 64, level: 'green', title: 'Leafy street', line: `${F.cos.trees100} street trees within 100 m.`, anchors: [], meaning: 'More shade in summer and cooler streets.', sources: ['City of Sydney trees'] });
    if (F.cos?.lateNightStreet) add({ id: 'latenight', finding: 59, level: 'amber', title: 'On a late-night trading street', line: 'The council allows late trading on this street.', anchors: has('quiet') ? [{ type: 'claim', key: 'quiet' }] : [], meaning: 'Venues here can trade late, so expect noise and foot traffic after midnight.', sources: ['City of Sydney planning'] });
    // Mapillary: recent street photos
    if (F.photos?.length) add({ id: 'photos', finding: 70, level: 'info', title: 'See the street', line: `${F.photos.length} real photos of the street, the closest ${F.photos[0].d < 999 ? F.photos[0].d + ' m' : ''} from the door.`.replace('  ', ' '), anchors: [], proof: { kind: 'photos', photos: F.photos }, sources: ['Mapillary'] });

    // ---------- 8. Your life (findings 92, 93, 42, 33) ----------
    const life = (key, f, what, wanted) => {
      if (!f || !f.nearest) return;
      const p = f.mine || f.nearest, w = LUMO.walk(p.d);
      const mine = !!f.mine;
      const route = key === 'gym' ? F.routeGym : F.routeShop;
      add({ id: key, finding: key === 'gym' ? 92 : 93, level: w <= 10 ? 'green' : 'info', title: (mine ? 'Your ' + what : what.replace(/^./, (x) => x.toUpperCase())) + (w <= 10 ? ' is close' : ' is a walk'), line: `${p.name}, about ${route?.minutes || w} min on foot.`, anchors: key === 'shops' && has('shops') ? [{ type: 'claim', key: 'shops' }] : [],
        proof: route ? { kind: 'route', home: F.home, route, to: p, label: `${route.minutes} min walk`, mode: 'walking' } : { kind: 'map', home: F.home, points: [{ ...p, kind: key }] }, sources: ['Microburbs places'], meaning: wanted && !mine ? `No ${wanted} found in ${sub}. This is the nearest ${what}.` : '' });
    };
    const mine = (key, list, route, what, fallback) => {
      const found = (list || []).filter((x) => !x.missing).sort((a, b) => a.d - b.d);
      if (!found.length) { life(key, fallback, what); return; }
      const best = found[0], w = route?.minutes || LUMO.walk(best.d);
      const missing = (list || []).filter((x) => x.missing).map((x) => x.brand);
      add({
        id: key, finding: key === 'gym' ? 92 : 93, level: w <= 10 ? 'green' : w <= 20 ? 'info' : 'amber',
        title: `Your ${what}${found.length > 1 ? 's' : ''}: ${best.brand} ${w} min`,
        line: found.map((x) => `${x.brand} ${route && x === best ? route.minutes : LUMO.walk(x.d)} min`).join(' · ') + (missing.length ? ` · no ${missing.join(', ')} nearby` : ''),
        anchors: key === 'shops' && has('shops') ? [{ type: 'claim', key: 'shops' }] : [],
        proof: route ? { kind: 'route', home: F.home, route, to: best, label: `${route.minutes} min walk`, mode: 'walking', rows: found.map((x) => [x.name, LUMO.dist(x.d)]) }
          : { kind: 'map', home: F.home, points: found.map((x) => ({ ...x, kind: key })) },
        sources: ['Microburbs places', 'OpenStreetMap']
      });
    };
    mine('gym', F.myGyms, F.routeGym, 'gym', F.gym);
    mine('shops', F.myShops, F.routeShop, 'supermarket', F.supermarket);
    // Your places, timed (finding 42). Google Maps when a key is set, otherwise an honest estimate.
    for (const c of F.commute || []) {
      const hrs = Math.round(((c.minutes * 2 * c.days) / 60) * 10) / 10, real = c.source !== 'estimate';
      add({
        id: 'commute-' + c.name, finding: 42, level: c.minutes <= 30 ? 'green' : c.minutes <= 50 ? 'info' : 'amber',
        title: `${real ? '' : 'About '}${c.minutes} min to ${c.name}`,
        line: `${hrs} hours a week on ${c.days} day${c.days === 1 ? '' : 's'}.${c.source === 'tfnsw' ? ` ${c.how}, leaving 8 am Monday.` : c.source === 'google' ? ' Transit, leaving 8 am Monday.' : ' Estimate from distance.'}`,
        anchors: [], proof: { kind: 'commute', home: F.home, place: c },
        meaning: c.minutes <= 30 ? 'An easy trip. You get time back every week.' : `That is ${Math.round(hrs * 45)} hours a year getting to ${c.label === 'Work' ? 'work' : c.label === 'Uni' ? 'uni' : c.name}.`,
        next: 'Open the trip in Google Maps to see the exact route.',
        questions: ['How long is my commute?', 'Is there a night bus home?'], sources: [c.source === 'tfnsw' ? 'Transport for NSW' : c.source === 'google' ? 'Google Maps' : 'Lumo estimate']
      });
    }
    // After a night out: the first ride home from the city after 12:30 am Saturday (Transport for NSW).
    if (F.nightRide) {
      const n = F.nightRide, t = (x) => new Date(x).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '\u00a0');
      const wait = Math.round((new Date(n.dep) - new Date(n.asked)) / 60000), ok = wait <= 40 && n.minutes <= 70;
      add({
        id: 'nightRide', finding: 47, level: ok ? 'green' : 'amber',
        title: ok ? 'Easy to get home late' : 'Hard to get home late',
        line: `From Town Hall after midnight: leave ${t(n.dep)}, home by ${t(n.arr)}. ${n.how}.`,
        anchors: [], proof: { kind: 'commute', home: F.home, place: { name: 'Town Hall', lat: n.from.lat, lng: n.from.lng, minutes: n.minutes, days: 1 } },
        meaning: ok ? 'Public transport gets you home after a night out.' : wait > 40 ? `Nothing leaves for ${wait} minutes after 12:30 am, so expect a taxi or rideshare.` : 'It is a long trip home after midnight.',
        next: 'Check the trip in the Opal Travel app before a late night.',
        questions: ['Is there a night bus home?', 'Is the walk home safe at night?'], sources: ['Transport for NSW']
      });
    }
    // Good things the ad says, checked where we can (findings 95, 89, 97, 68).
    if (has('beach') && F.beach?.nearest) {
      const w = LUMO.walk(F.beach.nearest.d);
      add({ id: 'beach', finding: 95, level: w <= 15 ? 'green' : 'amber', title: w <= 15 ? 'Beach is close' : 'Beach is a trek', line: `${F.beach.nearest.name}, about ${w} min on foot.`, anchors: [{ type: 'claim', key: 'beach' }], proof: { kind: 'map', home: F.home, points: [{ ...F.beach.nearest, kind: 'park' }] }, sources: ['Microburbs places'] });
    }
    if (has('cafes') && F.cafes300 != null) {
      add({ id: 'cafes', finding: 89, level: F.cafes300 >= 5 ? 'green' : 'info', title: F.cafes300 >= 5 ? 'Cafes on your doorstep' : 'A few cafes nearby', line: `${F.cafes300} cafes and restaurants within 300 m.`, anchors: [{ type: 'claim', key: 'cafes' }], sources: ['Microburbs places'] });
    }
    if (has('laundry')) add({ id: 'laundry', finding: 97, level: 'green', title: 'Laundry inside', line: 'No laundromat trips. Saves time every week.', anchors: [{ type: 'claim', key: 'laundry' }], sources: ['The ad'] });
    if (has('aircon')) add({ id: 'aircon', finding: 68, level: 'green', title: 'Air conditioning', line: 'Cooler through Sydney summers.', anchors: [{ type: 'claim', key: 'aircon' }], sources: ['The ad'] });

    if (S.commute && !(F.commute || []).length) add({ id: 'commute', finding: 42, level: S.commute.minutes <= 35 ? 'green' : 'amber', sample: true, title: `${S.commute.minutes} min to ${S.commute.to}`, line: S.commute.how, anchors: [], proof: { kind: 'commute', home: F.home, place: { name: S.commute.to, lat: S.commute.lat, lng: S.commute.lng, minutes: S.commute.minutes, days: 3 } }, questions: ['How long is my commute?', 'Is there a night bus home?'], sources: ['Sample data'] });
    if (F.daysOnMarket) {
      const d = /house/i.test(typeWord) ? F.daysOnMarket.house : F.daysOnMarket.unit;
      if (d) add({ id: 'dom', finding: 33, level: 'info', title: `Leases in about ${Math.round(d)} days`, line: `Typical for ${typeWord} in ${sub}.`, anchors: [], meaning: 'If this one has been up longer, the agent has room to move.', next: 'Ask how long it has been listed.', questions: ['Will the price drop?', 'What should I offer?'], sources: ['Microburbs market'] });
    }

    // ---------- 9. Claims Lumo can't test yet ----------
    if (has('renovated')) add({ id: 'renovated', finding: 40, level: 'grey', title: '“Renovated” not confirmed', line: 'Ask for the year of the work, or check the photos are recent.', anchors: [], sources: [] });

    // No area data: say why, and how to switch it on.
    if (!F.comps && !F.venues150 && !L.demo) add({ id: 'nodata', level: 'grey', title: 'Area data locked for this suburb', line: 'The free test key covers Bondi and a few others. Add your Microburbs key in Settings for all of Sydney.', anchors: [], sources: [] });

    // Most serious first. One check per id.
    const seen = new Set();
    return out.filter((c) => !seen.has(c.id) && seen.add(c.id)).sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  };

  // The pill counts distinct problems; a claim that repeats another check ("great value") doesn't count twice.
  LUMO.counts = (checks) => {
    const c = checks.filter((x) => !x.dup);
    return { red: c.filter((x) => x.level === 'red').length, amber: c.filter((x) => x.level === 'amber').length, green: c.filter((x) => x.level === 'green').length };
  };

  LUMO.verdict = (checks) => {
    const n = LUMO.counts(checks);
    if (n.red) return `${n.red} red flag${n.red > 1 ? 's' : ''}`;
    if (n.amber) return `${n.amber} thing${n.amber > 1 ? 's' : ''} to check`;
    return n.green ? 'Looks good' : 'Not checked yet';
  };
})();
