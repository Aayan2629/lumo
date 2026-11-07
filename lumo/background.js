// Lumo service worker. The page talks to it with chrome.runtime.sendMessage.
// It reads the API keys from lumo/.env, calls the data sources, and never exposes keys to the page.
import { getAll, noteKey } from './lib/store.js';
import { gatherFacts } from './lib/providers.js';
import { askLLM, knowledge } from './lib/ai.js';
import { loadEnv, envSettings, demoArea } from './lib/env.js';

const LISTING_SITES = /^https:\/\/www\.(domain|realestate)\.com\.au\//;
const CONTENT = ["content/core.js", "content/extract.js", "content/rules.js", "content/invest.js", "content/anchor.js", "content/ui.css.js", "content/ui.js", "content/voice.js", "content/chat.js", "content/main.js"];

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
  // Not a listing site: open real rentals in a suburb the Microburbs key covers.
  const a = demoArea(await loadEnv());
  chrome.tabs.create({ url: `https://www.domain.com.au/rent/${a.slug}/?ptype=apartment-unit-flat` });
});

// Notes: every change reads, edits and writes the whole map, one at a time, so two quick writes
// (or two tabs) can't overwrite each other. Each handler returns the new map.
const NOTE_MAX = 2000;
let noteQueue = Promise.resolve();
const serial = (fn) => (noteQueue = noteQueue.then(fn, fn));
const noteId = () => 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const cleanText = (t) => String(t || '').trim().slice(0, NOTE_MAX);
const cleanHome = (h) => h && { address: String(h.address || ''), photo: String(h.photo || ''), price: h.price == null || !Number.isFinite(+h.price) ? null : +h.price, sale: !!h.sale };
function changeNotes(fn) {
  return serial(async () => {
    const { notes, saved } = await getAll();
    fn(notes, saved);
    await chrome.storage.local.set({ notes });
    return notes;
  });
}

const handlers = {
  async state() { return getAll(); },
  async knowledge() { return knowledge(); },
  async facts({ listing }) {
    const [{ settings, profile }, env] = await Promise.all([getAll(), loadEnv()]);
    return gatherFacts(listing, { ...settings, ...envSettings(env) }, profile);
  },
  async ask({ ctx, history }) { return askLLM(await loadEnv(), ctx, history); },
  // Content scripts can't open extension pages, so the page asks us to open the mic setup tab.
  async openMicSetup() { await chrome.tabs.create({ url: chrome.runtime.getURL('mic/allow.html') }); return true; },
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
  async addNote({ url, home, text, by }) {
    const t = cleanText(text);
    if (!url || !t) throw new Error('empty note');
    return changeNotes((notes, saved) => {
      const key = noteKey(url), now = Date.now();
      const r = notes[key] || { key, url, home: null, t: now, entries: [] };
      // On the listing itself: refresh the snapshot. Otherwise keep it, or copy it from Saved if there is none.
      if (home) { r.home = cleanHome(home); r.url = url; }
      if (!r.home) {
        const s = saved.find((x) => noteKey(x.url) === key);
        r.home = cleanHome(s || { address: '' });
      }
      r.entries.unshift({ id: noteId(), text: t, t: now, ...(by === 'lumo' ? { by: 'lumo' } : {}) });
      r.t = now;
      notes[key] = r;
    });
  },
  async editNote({ key, id, text }) {
    const t = cleanText(text);
    if (!t) throw new Error('empty note');
    return changeNotes((notes) => {
      const r = notes[key], e = r?.entries.find((x) => x.id === id);
      if (!e) return;
      e.text = t; e.edited = r.t = Date.now();
    });
  },
  async removeNote({ key, id }) {
    return changeNotes((notes) => {
      const r = notes[key];
      if (!r) return;
      r.entries = r.entries.filter((x) => x.id !== id);
      if (r.entries.length) r.t = Date.now(); else delete notes[key];
    });
  },
  async removeHome({ key }) { return changeNotes((notes) => { delete notes[key]; }); },
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
