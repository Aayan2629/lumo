// Settings, profile and a small cache, all kept in chrome.storage.local.
// Nothing here leaves the browser unless a provider sends it to an API you switched on.

export const DEFAULT_SETTINGS = {
  microburbsKey: 'test',          // 'test' = free public sandbox (only some suburbs). Paste your own key in Settings.
  rentModelUrl: '',               // Your rent model endpoint (Task 4). POST listing -> { with, without }
  anthropicKey: '',               // Optional. Lets Lumo answer in its own words.
  anthropicModel: 'claude-haiku-5-5',
  googleKey: '',
  mapillaryToken: '',             // Optional. Free street photos (mapillary.com/developer).                  // Optional. Real transit times to your places (Google Routes API).
  tfnswKey: '',                   // Optional. Real commute times (Trip Planner API).
  elevenLabsKey: '',              // Optional. Voice replies for the demo video.
  elevenLabsVoice: '',
  useOsm: true,                   // Free OpenStreetMap lookups when Microburbs has no data
  photoEdges: true,
  introScan: true,
  voice: false
};

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
  onboarded: false
};

export async function getAll() {
  const r = await chrome.storage.local.get(['settings', 'profile', 'saved']);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(r.settings || {}) },
    profile: { ...DEFAULT_PROFILE, ...(r.profile || {}) },
    saved: r.saved || []
  };
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
