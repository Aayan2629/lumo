// Settings, profile and a small cache, all kept in chrome.storage.local.
// Nothing here leaves the browser unless a provider sends it to an API you switched on.

// Keys are not settings: they live in lumo/.env (see lib/env.js).
export const DEFAULT_SETTINGS = {
  rentModelUrl: '',               // Your rent model endpoint (Task 4). POST listing -> { with, without }
  useOsm: true,                   // Free OpenStreetMap lookups when Microburbs has no data
  photoEdges: true,
  introScan: true,
  shortcuts: { ptt: 'Alt+Digit1', toggle: 'Alt+Digit2' }   // Voice: hold to talk, tap to talk
};

// Old fields that held keys or spoken replies. Dropped from storage so they never reach a page.
const OLD = ['microburbsKey', 'anthropicKey', 'anthropicModel', 'googleKey', 'mapillaryToken', 'tfnswKey', 'elevenLabsKey', 'elevenLabsVoice', 'voice'];

export const DEFAULT_PROFILE = {
  name: '',
  role: 'student',
  places: [],                     // [{ label: 'Uni', name: 'UNSW Kensington', lat, lng, days: 3 }]
  car: false,
  gym: '',
  supermarket: '',
  gyms: [],                       // every gym chain you use
  supermarkets: [],               // every supermarket you use
  budget: 700,
  beds: 1,
  priorities: ['value', 'transport', 'quiet', 'safety', 'light'],
  renterId: { job: '', employer: '', incomeShare: 30, references: [], documents: {} },
  invest: { deposit: 20, rate: 6.0, io: true, mgmt: 7 },   // Investor mode: your loan settings (Numbers tab and Settings)
  onboarded: false
};

export async function getAll() {
  const r = await chrome.storage.local.get(['settings', 'profile', 'saved', 'notes']);
  const stored = { ...(r.settings || {}) };
  if (OLD.some((k) => k in stored)) {
    for (const k of OLD) delete stored[k];
    await chrome.storage.local.set({ settings: stored });
  }
  return {
    settings: { ...DEFAULT_SETTINGS, ...stored, shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(stored.shortcuts || {}) } },
    profile: { ...DEFAULT_PROFILE, ...(r.profile || {}) },
    saved: r.saved || [],
    notes: r.notes || {}
  };
}

// Notes are kept per home, keyed by the listing's address on the web: no query, no hash, no trailing slash.
// Same logic as LUMO.noteKey in content/core.js.
export function noteKey(url) {
  try { const u = new URL(url); return (u.protocol + '//' + u.host + u.pathname).replace(/\/+$/, ''); }
  catch { return String(url || '').split(/[?#]/)[0].replace(/\/+$/, ''); }
}

// Cache API answers so the same listing never costs twice (Microburbs charges per call).
const DAY = 864e5;
export async function cached(key, maxAgeDays, fn) {
  const k = 'c:' + key;
  const hit = (await chrome.storage.local.get(k))[k];
  if (hit && Date.now() - hit.t < maxAgeDays * DAY) return hit.v;
  const v = await fn();
  if (v !== undefined && v !== null) chrome.storage.local.set({ [k]: { t: Date.now(), v } });
  return v;
}
