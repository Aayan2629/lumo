// Lumo settings and onboarding. Everything saves as you go.
import { getAll, DEFAULT_SETTINGS } from '../lib/store.js';

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
const DOCS = [['photoId', 'Photo ID', 40], ['secondId', 'Second ID', 30], ['income', 'Proof of income', 30], ['history', 'Rental history', 0], ['bank', 'Bank statement', 0]];

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
const tabs = ['you', 'places', 'id', 'data'];
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
$('#name').oninput = (e) => { P.name = e.target.value; save(); drawId(); };
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
function places() {
  $('#places').innerHTML = P.places.map((p, i) => `<div class="place" data-i="${i}">
    <select data-f="label">${['Uni', 'Work', 'Other'].map((l) => `<option ${p.label === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select data-f="name">${Object.keys(PLACES).map((n) => `<option ${p.name === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <div class="step"><button data-d="-1" aria-label="Fewer days">&minus;</button><b class="num">${p.days}d</b><button data-d="1" aria-label="More days">+</button></div>
    <button class="x" data-rm aria-label="Remove">&times;</button></div>`).join('') || '<p class="hint">No places yet.</p>';
}
$('#places').onchange = (e) => {
  const row = e.target.closest('.place'); const p = P.places[+row.dataset.i];
  p[e.target.dataset.f] = e.target.value;
  if (e.target.dataset.f === 'name') [p.lat, p.lng] = PLACES[p.name];
  save();
};
$('#places').onclick = (e) => {
  const row = e.target.closest('.place'); if (!row) return;
  const i = +row.dataset.i;
  if (e.target.closest('[data-rm]')) P.places.splice(i, 1);
  const d = e.target.closest('[data-d]'); if (d) P.places[i].days = Math.max(1, Math.min(7, P.places[i].days + +d.dataset.d));
  places(); save();
};
$('#addPlace').onclick = () => { const n = 'UNSW Kensington'; P.places.push({ label: 'Uni', name: n, lat: PLACES[n][0], lng: PLACES[n][1], days: 3 }); places(); save(); };
places();

// ---------- Renter ID ----------
const R = P.renterId;
$('#job').value = R.job; $('#employer').value = R.employer;
$('#job').oninput = (e) => { R.job = e.target.value; save(); drawId(); };
$('#employer').oninput = (e) => { R.employer = e.target.value; save(); drawId(); };
$('#share').value = R.incomeShare;
const share = () => ($('#shareOut').textContent = R.incomeShare + '%');
$('#share').oninput = (e) => { R.incomeShare = +e.target.value; share(); save(); drawId(); };
share();
const points = () => DOCS.reduce((n, [k, , p]) => n + (R.documents[k] ? p : 0), 0);
function docs() {
  $('#docs').innerHTML = DOCS.map(([k, label, p]) => `<label class="doc toggle"><span>${label}${p ? `<em>${p} pts</em>` : ''}</span><input type="checkbox" data-doc="${k}" ${R.documents[k] ? 'checked' : ''}><i></i></label>`).join('');
  $('#points').textContent = Math.min(100, points()) + ' / 100 pts';
}
$('#docs').onchange = (e) => { R.documents[e.target.dataset.doc] = e.target.checked; docs(); save(); drawId(); };
docs();
function refs() {
  $('#refs').innerHTML = R.references.map((r, i) => `<div class="ref" data-i="${i}"><input data-f="name" value="${r.name || ''}" placeholder="Name"><input data-f="relation" value="${r.relation || ''}" placeholder="Past landlord, employer"><button class="x" data-rm aria-label="Remove">&times;</button></div>`).join('') || '<p class="hint">Past landlords or employers who can vouch for you.</p>';
}
$('#refs').oninput = (e) => { const i = +e.target.closest('.ref').dataset.i; R.references[i][e.target.dataset.f] = e.target.value; save(); };
$('#refs').onclick = (e) => { if (e.target.closest('[data-rm]')) { R.references.splice(+e.target.closest('.ref').dataset.i, 1); refs(); save(); drawId(); } };
$('#addRef').onclick = () => { R.references.push({ name: '', relation: '' }); refs(); save(); drawId(); };
refs();
function drawId() {
  const pts = Math.min(100, points());
  $('#idcard').innerHTML = `<div><div class="k">Renter ID</div><div class="nm">${(P.name || 'Your name').replace(/</g, '')}</div></div>
    <div class="meta"><div><span class="k">Role</span><b>${(R.job || '—').replace(/</g, '')}</b></div><div><span class="k">Rent share</span><b>${R.incomeShare}%</b></div><div><span class="k">References</span><b>${R.references.length}</b></div></div>
    <div><div class="k" style="display:flex;justify-content:space-between"><span>ID points</span><span>${pts} / 100</span></div><div class="bar100"><i style="width:${pts}%"></i></div></div>`;
}
drawId();

// ---------- Data ----------
for (const k of ['microburbsKey', 'rentModelUrl', 'anthropicKey', 'anthropicModel', 'googleKey', 'mapillaryToken', 'tfnswKey', 'elevenLabsKey', 'elevenLabsVoice']) {
  const el = $('#' + k); el.value = S[k] ?? ''; el.oninput = () => { S[k] = el.value.trim() || (k === 'microburbsKey' ? DEFAULT_SETTINGS.microburbsKey : ''); save(); };
}
for (const k of ['photoEdges', 'introScan', 'voice', 'useOsm']) {
  const el = $('#' + k); el.checked = !!S[k]; el.onchange = () => { S[k] = el.checked; save(); };
}
// A custom rent model URL needs permission to reach that host.
$('#rentModelUrl').onchange = async (e) => {
  try { const u = new URL(e.target.value); await chrome.permissions.request({ origins: [u.origin + '/*'] }); } catch {}
};
$('#mbTest').onclick = async () => {
  const st = $('#mbStatus'); st.className = 'status'; st.textContent = 'Checking';
  try {
    const r = await fetch('https://api.microburbs.com.au/v1/suburbs/Bondi/market/median-rent', { headers: { Authorization: 'Bearer ' + (S.microburbsKey || 'test') } });
    st.textContent = r.ok ? 'Connected' : 'Key not accepted (' + r.status + ')'; st.classList.add(r.ok ? 'ok' : 'bad');
  } catch { st.textContent = 'No connection'; st.classList.add('bad'); }
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

$('#demo').onclick = () => chrome.tabs.create({ url: 'https://www.domain.com.au/rent/bondi-nsw-2026/?ptype=apartment-unit-flat' });
$('#offline').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('demo/listing.html') });

// Every key gets a live status next to its name: checked when the page opens and again as you paste.
// Each test is a free call that costs nothing.
const TESTS = {
  tfnswKey: (k) => fetch('https://api.transport.nsw.gov.au/v1/tp/stop_finder?outputFormat=rapidJSON&type_sf=any&name_sf=Central%20Station&coordOutputFormat=EPSG%3A4326&TfNSWSF=true&version=10.2.1.42', { headers: { Authorization: 'apikey ' + k } }),
  mapillaryToken: (k) => fetch('https://graph.mapillary.com/images?limit=1&fields=id&bbox=151.270,-33.893,151.276,-33.888&access_token=' + encodeURIComponent(k)),
  anthropicKey: (k) => fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } }),
  elevenLabsKey: (k) => fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': k } }),
  googleKey: null   // no free test call, so it just shows Saved
};
async function checkKey(k) {
  const el = document.querySelector(`[data-st="${k}"]`); if (!el) return;
  const v = S[k]; el.className = 'status';
  if (!v) { el.textContent = 'Not added'; return; }
  if (!TESTS[k]) { el.textContent = 'Saved'; return; }
  el.textContent = 'Checking';
  try {
    const r = await TESTS[k](v);
    if (S[k] !== v) return;   // changed while checking
    el.textContent = r.ok ? 'Connected' : r.status === 401 || r.status === 403 ? 'Key not accepted' : 'Error ' + r.status;
    el.classList.add(r.ok ? 'ok' : 'bad');
  } catch { el.textContent = 'No connection'; el.classList.add('bad'); }
}
const timers = {};
for (const k of Object.keys(TESTS)) {
  checkKey(k);
  $('#' + k).addEventListener('input', () => { clearTimeout(timers[k]); timers[k] = setTimeout(() => checkKey(k), 700); });
}
