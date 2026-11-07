// Lumo settings and onboarding. Everything saves as you go.
import { getAll, DEFAULT_SETTINGS } from '../lib/store.js';
import { loadEnv, ENV_KEYS, demoArea } from '../lib/env.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let { settings: S, profile: P } = await getAll();

const GYMS = ['Anytime Fitness', 'Plus Fitness', 'Fitness First', 'Snap Fitness', 'F45', 'Jetts', 'Goodlife', 'Revo', 'Crunch', 'Virgin Active', 'UFC Gym', 'None'];
const SHOPS = ['Coles', 'Woolworths', 'Aldi', 'IGA', 'Harris Farm', 'Costco', 'Thomas Dux'];
const MATTERS = { value: 'Fair rent', transport: 'Transport', quiet: 'Quiet', safety: 'Safety', light: 'Light', parking: 'Parking', gym: 'Near my gym', shops: 'Near shops', pets: 'Pets' };
const PLACES = {
  'UNSW Kensington': [-33.9173, 151.2313], 'University of Sydney': [-33.8886, 151.1873], 'UTS': [-33.8832, 151.2005],
  'Macquarie University': [-33.7738, 151.1126], 'WSU Parramatta': [-33.815, 151.0011], 'ACU North Sydney': [-33.8389, 151.2072],
  'Sydney CBD': [-33.8731, 151.2071], 'Parramatta CBD': [-33.815, 151.003], 'North Sydney': [-33.8395, 151.2074]
};

// ---------- save ----------
let t = 0;
function save() {
  clearTimeout(t);
  t = setTimeout(async () => {
    P.onboarded = true;
    await chrome.storage.local.set({ settings: S, profile: P });
    const s = $('#saved'); s.classList.add('on'); setTimeout(() => s.classList.remove('on'), 1200);
  }, 250);
}

// ---------- tabs ----------
const tabs = ['you', 'places', 'invest', 'data'];
function show(name) {
  $$('.seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('section.tab').forEach((s) => (s.hidden = s.dataset.tab !== name));
  $('.thumb').style.transform = `translateX(${tabs.indexOf(name) * 100}%)`;
  history.replaceState(null, '', '#' + name);
}
$$('.seg button').forEach((b) => (b.onclick = () => show(b.dataset.tab)));
show(tabs.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'you');

// ---------- You ----------
$('#name').value = P.name;
$('#name').oninput = (e) => { P.name = e.target.value; save(); };
const role = () => $$('#role button').forEach((b) => b.classList.toggle('on', b.dataset.v === P.role));
$$('#role button').forEach((b) => (b.onclick = () => { P.role = b.dataset.v; role(); save(); }));
role();
const budget = () => ($('#budgetOut').textContent = '$' + P.budget.toLocaleString('en-AU') + ' / wk');
$('#budget').value = P.budget; budget();
$('#budget').oninput = (e) => { P.budget = +e.target.value; budget(); save(); };
const beds = () => ($('#beds').textContent = P.beds === 0 ? 'Studio' : P.beds);
$$('[data-step]').forEach((b) => (b.onclick = () => { P.beds = Math.max(0, Math.min(5, P.beds + +b.dataset.step)); beds(); save(); }));
beds();
$('#car').checked = !!P.car; $('#car').onchange = (e) => { P.car = e.target.checked; save(); };

// Pick as many gyms and supermarkets as you use. Lumo times the nearest branch of each.
function multi(el, list, key, legacy) {
  if (!Array.isArray(P[key])) P[key] = P[legacy] ? [P[legacy]] : [];
  const draw = () => (el.innerHTML = list.map((n) => `<button class="${P[key].includes(n) ? 'on' : ''}" aria-pressed="${P[key].includes(n)}">${n}</button>`).join(''));
  el.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const n = b.textContent;
    P[key] = P[key].includes(n) ? P[key].filter((x) => x !== n) : [...P[key], n];
    P[legacy] = P[key][0] || '';
    draw(); save();
  };
  draw();
}
multi($('#gym'), GYMS.filter((g) => g !== 'None'), 'gyms', 'gym');
multi($('#supermarket'), SHOPS, 'supermarkets', 'supermarket');

function ranks() {
  $('#priorities').innerHTML = Object.entries(MATTERS).map(([k, v]) => {
    const i = P.priorities.indexOf(k);
    return `<button data-k="${k}" class="${i >= 0 ? 'on' : ''}">${i >= 0 ? `<span class="n">${i + 1}</span>` : ''}${v}</button>`;
  }).join('');
}
$('#priorities').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.k;
  P.priorities = P.priorities.includes(k) ? P.priorities.filter((x) => x !== k) : [...P.priorities, k];
  ranks(); save();
};
ranks();

// ---------- Places ----------
// Each place: what it is (Uni, Work, Other), where it is (pick a suggestion or type any address), and how
// many days a week you go. A typed address is found with OpenStreetMap, and the pin is what Lumo times trips to.
const KINDS = ['Uni', 'Work', 'Other'];
const UNIS = ['UNSW Kensington', 'University of Sydney', 'UTS', 'Macquarie University', 'WSU Parramatta', 'ACU North Sydney'];
const SUGGEST = { Uni: UNIS, Work: ['Sydney CBD', 'Parramatta CBD', 'North Sydney'], Other: Object.keys(PLACES) };
for (const k of KINDS) $('#pl-' + k).innerHTML = SUGGEST[k].map((n) => `<option value="${n}">`).join('');
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const status = {};   // row index -> { text, kind } while finding an address
function whereLine(p, i) {
  const st = status[i];
  if (st) return `<p class="where ${st.kind}">${esc(st.text)}</p>`;
  if (!p.name) return `<p class="where">Type an address or pick a place.</p>`;
  if (!(p.lat && p.lng)) return `<p class="where bad">Lumo couldn't find this place. Try the full address with the suburb.</p>`;
  return PLACES[p.name] ? '' : `<p class="where ok">${esc(p.address || p.name)}</p>`;
}
function places() {
  $('#places').innerHTML = P.places.map((p, i) => `<div class="place" data-i="${i}">
    <div class="pills kind" role="radiogroup" aria-label="Kind of place">${KINDS.map((k) => `<button type="button" role="radio" data-k="${k}" class="${p.label === k ? 'on' : ''}" aria-checked="${p.label === k}">${k}</button>`).join('')}</div>
    <input data-f="name" list="pl-${KINDS.includes(p.label) ? p.label : 'Other'}" value="${esc(p.name)}" spellcheck="false" autocomplete="off"
      placeholder="${p.label === 'Work' ? 'Work address, e.g. 1 Epping Road, North Ryde' : p.label === 'Uni' ? 'Pick a uni or type an address' : 'Any address'}">
    <div class="step"><button type="button" data-d="-1" aria-label="Fewer days">&minus;</button><b class="num">${p.days}d</b><button type="button" data-d="1" aria-label="More days">+</button></div>
    <button type="button" class="x" data-rm aria-label="Remove">&times;</button>
    ${whereLine(p, i)}</div>`).join('') || '<p class="hint">No places yet.</p>';
}
// Find a typed address. Sydney first, then anywhere in Australia.
async function findAddress(q) {
  const ask = async (text) => {
    const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=au&limit=1&addressdetails=0&q=' + encodeURIComponent(text);
    const r = await fetch(u, { headers: { 'Accept-Language': 'en-AU' } });
    return r.ok ? (await r.json())[0] : null;
  };
  const hit = (/\b(NSW|New South Wales|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i.test(q) ? null : await ask(q + ', NSW')) || (await ask(q));
  if (!hit) return null;
  const short = hit.display_name.split(',').map((x) => x.trim()).filter((x) => !/^(Sydney|New South Wales|Australia|\d{4})$/.test(x)).slice(0, 3).join(', ').replace(/^(\d+[a-z]?), /i, '$1 ');
  return { lat: +hit.lat, lng: +hit.lon, address: short };
}
async function setPlace(i, raw) {
  const p = P.places[i], name = raw.trim();
  if (name === p.name && p.lat) return;
  p.name = name; p.lat = p.lng = null; p.address = '';
  if (!name) { delete status[i]; places(); save(); return; }
  if (PLACES[name]) { [p.lat, p.lng] = PLACES[name]; delete status[i]; places(); save(); return; }
  status[i] = { text: 'Finding the address…', kind: '' }; places();
  try {
    const f = await findAddress(name);
    if (P.places[i] !== p || p.name !== name) return;      // changed again while we looked
    if (f) Object.assign(p, f);
  } catch {}
  delete status[i]; places(); save();
}
$('#places').addEventListener('change', (e) => {
  const row = e.target.closest('.place'); if (!row || e.target.dataset.f !== 'name') return;
  setPlace(+row.dataset.i, e.target.value);
});
$('#places').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.f === 'name') e.target.blur(); });
$('#places').onclick = (e) => {
  const row = e.target.closest('.place'); if (!row) return;
  const i = +row.dataset.i, p = P.places[i];
  const k = e.target.closest('[data-k]');
  if (k) {
    if (p.label === k.dataset.k) return;
    p.label = k.dataset.k;
    // A uni left over from the default doesn't belong under Work: clear it so you can type the address.
    if (p.label === 'Work' && UNIS.includes(p.name)) { p.name = ''; p.lat = p.lng = null; p.address = ''; }
    places(); save();
    if (!p.name) $('#places').querySelector(`.place[data-i="${i}"] input`)?.focus();
    return;
  }
  if (e.target.closest('[data-rm]')) { P.places.splice(i, 1); for (const key in status) delete status[key]; }
  const d = e.target.closest('[data-d]'); if (d) p.days = Math.max(1, Math.min(7, p.days + +d.dataset.d));
  if (e.target.closest('[data-rm], [data-d]')) { places(); save(); }
};
$('#addPlace').onclick = () => {
  const has = (l) => P.places.some((p) => p.label === l);
  const label = !has('Uni') ? 'Uni' : !has('Work') ? 'Work' : 'Other';
  const n = label === 'Uni' ? 'UNSW Kensington' : '';
  P.places.push({ label, name: n, lat: n ? PLACES[n][0] : null, lng: n ? PLACES[n][1] : null, days: 3 });
  places(); save();
  if (!n) $('#places .place:last-child input')?.focus();
};
places();

// ---------- Data ----------
{ const el = $('#rentModelUrl'); el.value = S.rentModelUrl ?? ''; el.oninput = () => { S.rentModelUrl = el.value.trim(); save(); }; }
for (const k of ['photoEdges', 'introScan', 'useOsm']) {
  const el = $('#' + k); el.checked = !!S[k]; el.onchange = () => { S[k] = el.checked; save(); };
}
// Keys come from lumo/.env. Show which are there, never their values.
loadEnv().then((env) => {
  $('#envKeys').innerHTML = ENV_KEYS.map((k) => `<div class="field sub"><span><code>${k}</code></span><b class="status ${env[k] ? 'ok' : ''}">${env[k] ? 'Loaded' : 'Missing'}</b></div>`).join('');
});
// A custom rent model URL needs permission to reach that host.
$('#rentModelUrl').onchange = async (e) => {
  try { const u = new URL(e.target.value); await chrome.permissions.request({ origins: [u.origin + '/*'] }); } catch {}
};
// Import the hackathon CSV: gnaf_id, rent_with_car_space, rent_without_car_space
$('#csv').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  const lines = (await f.text()).split(/\r?\n/);
  const head = lines[0].toLowerCase().split(',').map((s) => s.trim());
  const gi = head.indexOf('gnaf_id'), wi = head.indexOf('rent_with_car_space'), oi = head.indexOf('rent_without_car_space');
  if (gi < 0 || wi < 0 || oi < 0) { $('#csvStatus').textContent = 'Wrong columns'; $('#csvStatus').className = 'status bad'; return; }
  const map = {};
  for (const line of lines.slice(1)) { const c = line.split(','); if (c[gi]) map[c[gi].trim()] = [Math.round(+c[wi]), Math.round(+c[oi])]; }
  await chrome.storage.local.set({ rentcsv: map });
  $('#csvStatus').textContent = Object.keys(map).length.toLocaleString() + ' homes loaded'; $('#csvStatus').className = 'status ok';
};
chrome.storage.local.get('rentcsv').then(({ rentcsv }) => { if (rentcsv) { $('#csvStatus').textContent = Object.keys(rentcsv).length.toLocaleString() + ' homes loaded'; $('#csvStatus').className = 'status ok'; } });

// Real listings in a suburb the Microburbs key covers: Surry Hills with a hackathon key, Bondi with the sandbox.
// Open any home for sale and Lumo switches to Investor mode.
loadEnv().then((env) => {
  const a = demoArea(env);
  $('#demo').textContent = `Try it on real ${a.name} rentals`;
  $('#demoSale span').textContent = `${a.name} homes for sale`;
  $('#demo').onclick = () => chrome.tabs.create({ url: `https://www.domain.com.au/rent/${a.slug}/?ptype=apartment-unit-flat` });
  $('#demoSale').onclick = () => chrome.tabs.create({ url: `https://www.domain.com.au/sale/${a.slug}/` });
});
$('#offline').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('demo/listing.html') });
$('#offlineSale').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('demo/sale.html') });

// ---------- Investor ----------
const V = (P.invest = { deposit: 20, rate: 6.0, io: true, mgmt: 7, ...(P.invest || {}) });
const inv = () => {
  $('#depOut').textContent = V.deposit + '%';
  $('#rateOut').textContent = (+V.rate).toFixed(2) + '%';
  $('#mgmtOut').textContent = V.mgmt + '% of rent';
  $$('#io button').forEach((b) => b.classList.toggle('on', (b.dataset.v === '1') === !!V.io));
};
$('#dep').value = V.deposit; $('#rate').value = V.rate; $('#mgmt').value = V.mgmt; inv();
$('#dep').oninput = (e) => { V.deposit = +e.target.value; inv(); save(); };
$('#rate').oninput = (e) => { V.rate = +e.target.value; inv(); save(); };
$('#mgmt').oninput = (e) => { V.mgmt = +e.target.value; inv(); save(); };
$$('#io button').forEach((b) => (b.onclick = () => { V.io = b.dataset.v === '1'; inv(); save(); }));

// ---------- Voice ----------
// The mic is approved once for Lumo on its own page (mic/allow.html), then works on every listing.
$('#micSetup').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('mic/allow.html') });
async function micStatus() {
  const st = $('#micStatus');
  const show = (state) => { st.textContent = state === 'granted' ? 'Allowed' : 'Not allowed yet'; st.className = 'status ' + (state === 'granted' ? 'ok' : state === 'denied' ? 'bad' : ''); };
  try { const p = await navigator.permissions.query({ name: 'microphone' }); show(p.state); p.onchange = () => show(p.state); }
  catch { show('prompt'); }
}
micStatus();

// Shortcuts are stored as 'Alt+Shift+Digit3' (modifiers, then KeyboardEvent.code) and shown Mac style.
const SC = (S.shortcuts = { ...DEFAULT_SETTINGS.shortcuts, ...(S.shortcuts || {}) });
const MODS = [['Ctrl', '⌃'], ['Alt', '⌥'], ['Shift', '⇧'], ['Meta', '⌘']];
const keyName = (code) => code.replace(/^Digit|^Key|^Numpad/, '').replace('Arrow', '');
const pretty = (sc) => { const p = sc.split('+'), code = p.pop(); return MODS.filter(([m]) => p.includes(m)).map(([, g]) => g).join('') + keyName(code); };
const scMsg = (t, bad) => { const m = $('#scMsg'); m.textContent = t; m.style.color = bad ? '#d70015' : ''; };
function drawShortcuts() { for (const k of ['ptt', 'toggle']) $('#sc-' + k).value = pretty(SC[k]); }
for (const k of ['ptt', 'toggle']) {
  const el = $('#sc-' + k);
  el.onfocus = () => { el.value = 'Press keys…'; scMsg('Press the new combination, with ⌥, ⌃ or ⌘.'); };
  el.onblur = () => { drawShortcuts(); };
  el.onkeydown = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) return;   // wait for the real key
    if (e.code === 'Escape' || e.code === 'Tab') { el.blur(); return; }
    const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta'].filter(Boolean);
    const sc = [...mods, e.code].join('+');
    if (!e.ctrlKey && !e.altKey && !e.metaKey) return scMsg('Add ⌥, ⌃ or ⌘ so typing in the page is not caught.', true);
    if (e.metaKey && /^Digit\d$/.test(e.code)) return scMsg('⌘ and a number switch Chrome tabs. Pick another.', true);
    const other = k === 'ptt' ? 'toggle' : 'ptt';
    if (sc === SC[other]) return scMsg('That is already the other shortcut.', true);
    SC[k] = sc; save(); scMsg('Saved. Reload the listing to use it.'); el.blur();
  };
}
$('#scReset').onclick = () => { Object.assign(SC, DEFAULT_SETTINGS.shortcuts); save(); drawShortcuts(); scMsg('Back to ⌥1 and ⌥2.'); };
drawShortcuts();
