// Keys live in lumo/.env (git-ignored), never in chrome.storage. See lumo/.env.example.
// The file ships inside the unpacked extension, so the service worker and settings page can fetch it.

let ENV = null;

function parse(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const k = line.slice(0, i).trim().replace(/^export\s+/, '');
    let v = line.slice(i + 1).trim();
    if (v.length > 1 && (v[0] === '"' || v[0] === "'") && v.endsWith(v[0])) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

// Cached for the life of the worker. A restarted worker loads it again on the next call.
export function loadEnv() {
  if (!ENV) ENV = (async () => {
    try {
      const res = await fetch(chrome.runtime.getURL('.env'));
      if (!res.ok) throw new Error(res.status);
      return parse(await res.text());
    } catch {
      console.warn('[Lumo] no .env found');
      return {};
    }
  })();
  return ENV;
}

// The names lib/providers.js already reads from its settings object.
export function envSettings(env) {
  return {
    microburbsKey: env.MICROBURBS_KEY || 'test',
    googleKey: env.GOOGLE_MAPS_KEY || '',
    tfnswKey: env.TFNSW_KEY || '',
    mapillaryToken: env.MAPILLARY_TOKEN || ''
  };
}

// Every variable the settings page reports on.
export const ENV_KEYS = ['LLM_API_KEY', 'LLM_MODEL', 'LLM_ENDPOINT', 'MICROBURBS_KEY', 'GOOGLE_MAPS_KEY', 'TFNSW_KEY', 'MAPILLARY_TOKEN'];
