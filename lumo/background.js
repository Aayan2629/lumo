// Lumo service worker. The page talks to it with chrome.runtime.sendMessage.
// It holds the API keys, calls the data sources, and never exposes keys to the page.
import { getAll } from './lib/store.js';
import { gatherFacts } from './lib/providers.js';
import { askLLM, speak, knowledge } from './lib/ai.js';

const LISTING_SITES = /^https:\/\/www\.(domain|realestate)\.com\.au\//;
const CONTENT = ["content/core.js", "content/extract.js", "content/rules.js", "content/invest.js", "content/anchor.js", "content/ui.css.js", "content/ui.js", "content/chat.js", "content/main.js"];

// Chrome only adds content scripts to pages loaded after the extension. Add Lumo to tabs already open.
async function inject(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/highlights.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT });
    return true;
  } catch (e) { console.warn('[Lumo] could not add to tab', tabId, e); return false; }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
  const tabs = await chrome.tabs.query({ url: ['https://www.domain.com.au/*', 'https://www.realestate.com.au/*'] });
  for (const t of tabs) inject(t.id);
});

// Toolbar icon: open or close Lumo on the page. Off a listing, show the demo.
chrome.action.onClicked.addListener(async (tab) => {
  try { await chrome.tabs.sendMessage(tab.id, { type: 'toggle' }); return; } catch {}
  // Lumo isn't on this tab yet (it was open before Lumo loaded): add it now.
  if (LISTING_SITES.test(tab.url || '') && (await inject(tab.id))) return;
  // Not a listing site: open real rentals in Bondi, a suburb the free Microburbs test key covers.
  chrome.tabs.create({ url: 'https://www.domain.com.au/rent/bondi-nsw-2026/?ptype=apartment-unit-flat' });
});

const handlers = {
  async state() { return getAll(); },
  async knowledge() { return knowledge(); },
  async facts({ listing }) {
    const { settings, profile } = await getAll();
    return gatherFacts(listing, settings, profile);
  },
  async ask({ ctx, history }) {
    const { settings } = await getAll();
    return { text: await askLLM(settings, ctx, history) };
  },
  async speak({ text }) {
    const { settings } = await getAll();
    return { audio: await speak(settings, text) };
  },
  async save({ item }) {
    const { saved } = await getAll();
    const next = [item, ...saved.filter((s) => s.url !== item.url)].slice(0, 60);
    await chrome.storage.local.set({ saved: next });
    return next;
  },
  async unsave({ url }) {
    const { saved } = await getAll();
    const next = saved.filter((s) => s.url !== url);
    await chrome.storage.local.set({ saved: next });
    return next;
  },
  async openOptions() { chrome.runtime.openOptionsPage(); return true; },
  // Investor settings from the Numbers tab (deposit, rate, loan type). Kept for every home.
  async setInvest({ invest }) {
    const { profile } = await getAll();
    const clean = { deposit: Math.max(0, Math.min(100, +invest.deposit || 20)), rate: Math.max(0, Math.min(20, +invest.rate || 6)), io: !!invest.io, mgmt: Math.max(0, Math.min(20, +(invest.mgmt ?? 7))) };
    await chrome.storage.local.set({ profile: { ...profile, invest: clean } });
    return clean;
  }
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const h = msg && handlers[msg.type];
  if (!h) return false;
  // Only accept messages from our own scripts.
  if (sender.id !== chrome.runtime.id) return false;
  h(msg).then((v) => reply({ ok: true, v }), (e) => reply({ ok: false, error: String(e && e.message || e) }));
  return true;
});
