// Ask Lumo. Answers come from the LLM (see lib/ai.js) using the knowledge files, the listing and the checks.
// With no LLM key in lumo/.env, every question gets "Insert key".
(() => {
  const M = LUMO.money;

  LUMO.opening = (D) => {
    if (D.mode === 'invest') {
      const m = LUMO.investModel(D.L, D.F, D.state.profile), red = D.checks.filter((c) => c.level === 'red');
      const lead = red.length ? `Main thing: ${red[0].title.toLowerCase()}. ${red[0].line}` : 'Nothing serious so far.';
      return `${lead}${m?.rent ? ` I expect about ${M(m.rent)} a week in rent, ${LUMO.pct(m.gross)} gross.` : ''} Ask me about the price, the rent, the costs or the area.`;
    }
    const red = D.checks.filter((c) => c.level === 'red'), good = D.checks.filter((c) => c.level === 'green');
    const lead = red.length ? `Main thing: ${red[0].title.toLowerCase()}. ${red[0].line}` : 'Nothing serious so far.';
    return `${lead}${good.length ? ` On the plus side: ${good.slice(0, 2).map((c) => c.title.toLowerCase()).join(', ')}.` : ''} Ask me anything about this home.`;
  };

  LUMO.starters = (D) => {
    if (D.mode === 'invest') return ['What will it really sell for?', 'What does it cost to hold?', 'Is this a growth or a rent play?'];
    const qs = [];
    if (D.checks.some((c) => c.id === 'night' && c.proof)) qs.push('Is the walk home safe at night?');
    for (const c of D.checks.filter((x) => x.level === 'red' || x.level === 'amber')) for (const q of c.questions || []) if (!qs.includes(q)) qs.push(q);
    return (qs.length ? qs : ['What should I offer?', 'How long is my commute?', 'Is it quiet at night?']).slice(0, 3);
  };

  // Investor answers, from the investor checks and Lumo's sums.
  function investAnswer(q, D) {
    const { L, F, checks } = D, s = q.toLowerCase(), I = F.inv || {}, V = I.value || {};
    const get = (id) => checks.find((c) => c.id === id);
    const m = LUMO.investModel(L, F, D.state.profile);
    const S = LUMO.short, pct = LUMO.pct;
    if (/sell for|worth|value|really|offer|pay|guide|underquot/.test(s)) {
      if (!V.mid) return 'I need Microburbs sales data for this suburb to value it. Add your key in Settings.';
      const c = V.comps;
      const g = L.sale?.kind === 'hidden' ? 'There is no price in the ad.' : `The ad says ${L.priceText}.`;
      return `${g} Similar homes sold for about ${S(V.mid)}${c?.n ? ` (${c.n} sales of ${c.basis} in the last year)` : ''}${V.avm ? `, and the Microburbs valuation is ${S(V.avm.low)} to ${S(V.avm.high)}` : ''}. ${/offer/.test(s) ? `I would start near ${S(Math.round(Math.min(V.mid, L.sale?.price || V.mid) * 0.97 / 5000) * 5000)} and not go far past ${S(V.mid)} without a reason.` : `Plan your budget around ${S(V.mid)}.`}`;
    }
    if (/cost|hold|cash ?flow|each week|a week|negative|gear|afford|repay|loan|mortgage/.test(s) && m) {
      return `At ${S(m.price)} with ${m.set.deposit}% down at ${m.set.rate}%${m.set.io ? ' interest only' : ''}: rent ${M(m.rent)} a week in, loan ${M(m.loanWeek)} and costs ${M(m.costsWeek)} out, so ${m.weekly >= 0 ? `you keep ${M(m.weekly)}` : `you top up about ${M(-m.weekly)}`} a week. Change the settings in Numbers.`;
    }
    if (/cash|deposit|stamp|duty|upfront|need to buy/.test(s) && m) return `About ${S(m.upfront.total)}: ${S(m.upfront.deposit)} deposit, ${M(m.upfront.duty)} stamp duty at NSW 2026–27 rates, and about ${M(m.upfront.other)} for legal work and inspections.${m.upfront.lmi ? ' Under 20% down, add mortgage insurance.' : ''}`;
    if (/rent|appraisal|tenant|lease/.test(s)) { const a = get('appraisal') || get('rent'); return a ? `${a.line} ${a.meaning || ''}` : 'I could not estimate the rent yet.'; }
    if (/yield|return/.test(s)) { const y = get('yield'); return y ? `${y.line} ${y.meaning}` : 'I need a rent estimate first.'; }
    if (/growth|rise|play|future|forecast|long term/.test(s)) {
      const g = get('growth'), y = get('yield');
      const play = g && y ? (g.level === 'green' && y.level !== 'green' ? 'It looks more like a growth play than a rent play.' : y.level === 'green' && g.level !== 'green' ? 'It looks more like a rent play than a growth play.' : 'It is a mix of both.') : '';
      return `${g ? g.line + ' ' + (g.next || '') : 'No growth data yet.'} ${play}`.trim();
    }
    if (/supply|new homes|oversupply|being built|tower/.test(s)) { const c = get('supply'); return c ? `${c.line} ${c.meaning}` : 'No supply data for this suburb yet.'; }
    if (/strata|levy|levies|body corp/.test(s)) { const c = get('strata'); return c ? `${c.line} ${c.next}` : 'This is a house, so there are no strata levies.'; }
    if (/history|sold before|last sold|selling|why/.test(s)) { const c = get('history'); return c ? `${c.line} ${c.meaning}` : 'I have no sale history for this address.'; }
    if (/land|zon|develop|subdivid|granny|duplex/.test(s)) { const c = get('zoning') || get('land') || get('site'); return c ? `${c.line} ${c.meaning}` : 'I have no land or zoning data for this lot.'; }
    if (/score/.test(s)) { const sc = LUMO.investScore(L, F, m); return sc.total != null ? `${sc.total} out of 100. ${sc.parts.map((p) => `${p.label} ${p.score}`).join(', ')}. It weighs price and rent return most. It is a way to compare homes, not advice.` : 'Not enough data for a score yet.'; }
    return null;
  }

  // Rule answers: match the question to what Lumo knows, answer in two or three sentences.
  // Not called any more (LUMO.reply always asks the LLM). Kept as an offline backup. It never makes up a number.
  function rules(q, D) {
    if (D.mode === 'invest') { const a = investAnswer(q, D); if (a) return a; }
    const { L, F, checks } = D, s = q.toLowerCase(), P = D.state.profile, S = F.sample || {};
    const get = (id) => checks.find((c) => c.id === id);
    const price = get('price');
    const fair = price?.proof?.items?.[1]?.v;

    if (/closest|which (venue|pub|bar)|venues/.test(s)) {
      const v = F.venues150 || [];
      return v.length ? `Within 150 m: ${v.slice(0, 4).map((x) => `${x.name} (${x.d} m)`).join(', ')}${v.length > 4 ? `, and ${v.length - 4} more` : ''}. Most trade late on Friday and Saturday.` : 'No pubs or bars within 150 m on the data I have.';
    }
    if (/back of|quieter side|which side/.test(s)) return 'Flats at the back usually rent for a little more and are much quieter on venue streets. Ask which way this unit faces; if the bedroom faces the road, expect weekend noise.';
    if (/quiet(er)? street|quieter|is it quiet|noise|loud/.test(s)) {
      const q = get('quiet');
      return q ? `${q.line} ${q.meaning} I would look one or two streets back from the main road for the same rent.` : 'I have not found late venues next to it. A main road or bus stop outside can still be loud.';
    }
    if (/similar|cheaper|comparable|in my budget/.test(s)) {
      const rows = price?.proof?.rows || [];
      return rows.length ? `Similar homes asking now: ${rows.slice(0, 3).map((r) => `${r[0]} at ${r[1]}`).join('; ')}. ${fair ? `The middle of the market is ${M(fair)}.` : ''}` : 'I need Microburbs listings or your rent model connected to find similar homes.';
    }
    if (/offer|negotiat|how much should/.test(s)) {
      if (!fair || !L.price) return 'I need a fair rent first. Connect Microburbs or your rent model in Settings.';
      const target = Math.round(Math.min(L.price, fair * 1.01) / 10) * 10;
      const dom = F.daysOnMarket?.unit;
      return L.price > fair ? `Offer around ${M(target)}. That is in line with similar homes${dom ? `, and places here lease in about ${Math.round(dom)} days, so if it has sat longer you have room` : ''}. Point to the ${M(L.price - fair)} gap.` : `The asking rent is already fair. Offer the asking rent and apply quickly.`;
    }
    if (/drop|come down|lower the price|reduce/.test(s)) {
      const lr = get('lastRent'), dom = F.daysOnMarket?.unit;
      return `${lr ? lr.line + ' ' : ''}${dom ? `Similar homes lease in about ${Math.round(dom)} days here. ` : ''}${price?.level === 'red' ? 'It is priced above similar homes, so a cut is likely if it sits past that.' : 'It is priced close to the market, so a big cut is unlikely.'}`;
    }
    if (/commute|uni|work|how long|get to/.test(s)) {
      if (F.commute?.length) return F.commute.map((c) => `${c.source === 'estimate' ? 'About ' : ''}${c.minutes} min to ${c.name}${c.source === 'tfnsw' ? ` (${c.how.toLowerCase()}), leaving 8 am Monday` : c.source === 'google' ? ' by transit, leaving 8 am Monday' : ''}, ${Math.round(((c.minutes * 2 * c.days) / 60) * 10) / 10} hours a week`).join('. ') + `.${F.commute.some((c) => c.source === 'estimate') ? ' Some of that is an estimate from distance. Add a free Transport for NSW key in Settings for real timetables.' : ''}`;
      if (S.commute) return `${S.commute.minutes} minutes to ${S.commute.to}: ${S.commute.how.replace(/\.$/, '')}. That is sample data until you add your places in Settings.`;
      const t = get('transport');
      return t ? `${t.line} Add your uni or work in Settings and a Transport for NSW key for a real door-to-door time.` : 'Add your uni or work in Settings and I will time the trip.';
    }
    if (/night bus|late|after midnight|get home/.test(s)) {
      const n = get('nightRide');
      return n ? `${n.line} ${n.meaning}` : 'Add a free Transport for NSW key in Settings and I will check the first ride home from the city after midnight.';
    }
    if (/station|train|transport|bus/.test(s)) { const t = get('transport'); return t ? `${t.line} ${t.meaning || ''}` : 'I could not place the nearest station yet.'; }
    if (/light|sun|bright|dark|winter/.test(s)) { const c = get('light'); return c ? `${c.line} ${c.meaning || ''}` : 'I cannot check sunlight here yet. It needs building heights around the address.'; }
    if (/build|construction|develop|DA\b|work start/i.test(s) && get('build')) {
      const b = get('build');
      return `${b.line} ${b.meaning} Lodgement dates are in the Checks tab; the NSW Planning Portal has start dates and plans.`;
    }
    if (/income|afford|earn|census/.test(s) && get('census')) { const c = get('census'); return `${c.title}. ${c.line} ${c.next}`; }
    if (/view|tower|build|construction/.test(s)) { const c = get('views'); return c ? `${c.line} ${c.meaning || ''}` : 'I have no approved buildings near this address on file.'; }
    if (/night walk|walk home|safe at night|lit|street light|dark/.test(s)) {
      const n = get('night'), c = get('crime');
      if (n) return `${n.title}. ${n.line} ${n.meaning}${c ? ' ' + c.line : ''} On the map below, gold is lit and red is dark.`;
    }
    if (/safe|crime/.test(s)) { const c = get('crime'); return c ? `${c.line} ${c.meaning} ${c.next}` : 'I have no crime data for this suburb yet.'; }
    if (/flood/.test(s)) { const c = get('flood'); return c ? `${c.title}. ${c.line}` : 'No flood data yet.'; }
    if (/park|car/.test(s)) { const c = get('parking'); return c ? `${c.line} ${c.meaning || ''}` : (L.parking ? 'It has parking. I could not price the space yet.' : 'No parking is listed.'); }
    if (/gym/.test(s)) { const c = get('gym'); return c ? c.line : `I could not find ${P.gym || 'a gym'} nearby.`; }
    if (/shop|supermarket|grocer|coles|woolies|aldi/.test(s)) { const c = get('shops'); return c ? c.line : 'I could not find a supermarket nearby.'; }
    if (/tenant|why.*leave|relist/.test(s)) { const c = get('relisted'); return c ? `${c.line} ${c.meaning}` : 'I have no relisting history for this address.'; }
    if (/before|last rent|used to/.test(s)) { const c = get('lastRent'); return c ? c.line : 'I have no past rent for this address.'; }
    if (/worth|should i|good deal|apply/.test(s)) {
      const red = checks.filter((c) => c.level === 'red');
      return red.length ? `I would hold off until you have answers on: ${red.map((c) => c.title.toLowerCase()).join(', ')}. ${fair ? `Fair rent looks like ${M(fair)}.` : ''}` : 'Nothing serious stands out. Inspect it and apply if it feels right.';
    }
    return `I can check rent, noise, transport, light, parking, safety and your daily places for this home. Try "What should I offer?" or "Is it quiet at night?"`;
  }

  // Which check a question is about, so the answer can carry its map or chart.
  LUMO.visualFor = (q, D) => {
    const s = q.toLowerCase(), has = (id) => D.checks.find((c) => c.id === id && c.proof) && id;
    const commute = D.checks.find((c) => c.id.startsWith('commute') && c.proof);
    return (/night bus|after midnight|get home late/.test(s) && has('nightRide')) ||
      (/safe|night|dark|light|walk home|crime/.test(s) && (has('night') || has('crime'))) ||
      (/quiet|noise|loud|venue|pub|bar/.test(s) && has('quiet')) ||
      (/build|construction|develop|view|tower|da\b/.test(s) && (has('build') || has('views'))) ||
      (D.mode === 'invest' && /sell for|worth|value|offer|guide|price/.test(s) && has('value')) ||
      (D.mode === 'invest' && /cost|hold|week|cash|loan/.test(s) && has('cashflow')) ||
      (D.mode === 'invest' && /growth|play|rise|forecast/.test(s) && has('growth')) ||
      (D.mode === 'invest' && /rent|appraisal/.test(s) && (has('appraisal') || has('rent'))) ||
      (/similar|cheaper|offer|price|value|rent|drop/.test(s) && has('price')) ||
      (/commute|uni|work|how long/.test(s) && (commute?.id || has('transport'))) ||
      (/station|train|transport|bus/.test(s) && has('transport')) ||
      (/gym/.test(s) && has('gym')) || (/shop|supermarket|grocer|coles|woolies|aldi/.test(s) && has('shops')) ||
      (/park|car/.test(s) && has('parking')) || (/income|afford|census/.test(s) && has('census')) || null;
  };

  LUMO.reply = async (q, D, chat) => {
    const ctx = {
      mode: D.mode,
      profile: D.state.profile,
      numbers: D.mode === 'invest' ? LUMO.investModel(D.L, D.F, D.state.profile) : undefined,
      listing: { address: D.L.address, price: D.L.price, priceText: D.L.priceText, forSale: D.mode === 'invest', beds: D.L.beds, baths: D.L.baths, parking: D.L.parking, type: D.L.type, description: (D.L.description || '').slice(0, 2500) },
      checks: D.checks.map(({ id, level, title, line, meaning, next, sources, sample }) => ({ id, level, title, line, meaning, next, sources, sample })),
      facts: { ...D.F, sample: D.F.sample }
    };
    // Lumo's opening line and its notes aren't part of the conversation (and a model wants a user turn first).
    const history = chat.filter((m) => !m.opening && !m.note).map((m) => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text }));
    const r = await LUMO.send('ask', { ctx, history });
    if (r?.noKey) return 'Insert key';
    if (r?.text) return r.text;
    return "Lumo couldn't reach the model.";
  };
})();
