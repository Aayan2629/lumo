// Voice input: speak a question and it is typed into the chat box. Nothing is sent until you press Enter.
//
//  ⌥1 (hold)  push to talk: the mic is on while the keys are held.
//  ⌥2 (tap)   toggle: tap to start, tap again to stop. It never stops by itself after a pause.
//  Esc        stops the mic in either mode and keeps the words.
//  Mic button works like ⌥2. Shortcuts can be changed in Settings.
//
// Speech recognition runs in a hidden frame that belongs to the extension (mic/mic.html), so the mic is
// approved once for Lumo, not once per site. We talk to it over a private MessageChannel.
(() => {
  if (LUMO.voice) return;                     // added twice (manifest + toolbar): run once
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const DEFAULTS = { ptt: 'Alt+Digit1', toggle: 'Alt+Digit2' };
  const PLACEHOLDER = 'Ask about this home';

  // ---------- shortcuts ----------
  // 'Alt+Shift+Digit3' -> { alt, shift, ctrl, meta, code }. Matched on e.code: on a Mac ⌥1 types "¡", so e.key is no use.
  const parse = (sc) => { const p = String(sc).split('+'), code = p.pop(); return { code, alt: p.includes('Alt'), ctrl: p.includes('Ctrl'), shift: p.includes('Shift'), meta: p.includes('Meta') }; };
  let keys = { ptt: parse(DEFAULTS.ptt), toggle: parse(DEFAULTS.toggle) };
  LUMO.send('state').then((s) => {
    const sc = { ...DEFAULTS, ...(s?.settings?.shortcuts || {}) };
    keys = { ptt: parse(sc.ptt), toggle: parse(sc.toggle) };
  });
  const matches = (k, e) => e.code === k.code && e.altKey === k.alt && e.ctrlKey === k.ctrl && e.shiftKey === k.shift && e.metaKey === k.meta;
  const MOD_KEYS = { alt: 'Alt', ctrl: 'Control', shift: 'Shift', meta: 'Meta' };

  // ---------- state ----------
  // idle -> starting (opening the panel, loading the frame) -> listening -> stopping (waiting for the last words) -> idle
  let state = 'idle', mode = null, base = '', text = '';
  let gen = 0;                                // bumped whenever a start is called off
  let stopTimer = 0;

  // ---------- the hidden frame ----------
  let frame = null, port = null, ready = null, readyResolve = null;
  function ensureFrame() {
    if (frame && frame.isConnected && ready) return ready;
    frame?.remove();
    port?.close(); port = null;
    const token = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    ready = new Promise((r) => (readyResolve = r));
    frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('mic/mic.html') + '#' + token;
    frame.allow = 'microphone';
    frame.width = '0'; frame.height = '0'; frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    // Fires again if the page moves Lumo in the DOM (that reloads the frame): reconnect, and drop a session that died with it.
    frame.addEventListener('load', () => {
      if (port) { port.close(); port = null; if (state !== 'idle') idle(); ready = new Promise((r) => (readyResolve = r)); }
      const ch = new MessageChannel();
      port = ch.port1;
      port.onmessage = (e) => onMsg(e.data || {});
      frame.contentWindow.postMessage({ type: 'lumo-mic-init', token }, chrome.runtime.getURL(''), [ch.port2]);
    });
    LUMO.ui.attachFrame(frame);
    return ready;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

  function onMsg(m) {
    if (m.type === 'ready') { readyResolve?.(port); readyResolve = null; return; }
    if (m.type === 'text') { if (state === 'listening' || state === 'stopping') { text = m.text; write(); } return; }
    if (m.type === 'end') { if (state === 'listening' || state === 'stopping') idle(); return; }
    if (m.type === 'denied') {
      if (state === 'idle') return;
      idle();
      chrome.storage.local.remove('micGranted');
      LUMO.send('openMicSetup');
      LUMO.ui.chatNote('Allow the microphone in the tab that just opened, then try again.');
      return;
    }
    if (m.type === 'error') {
      if (state === 'idle') return;
      console.debug('[Lumo] voice:', m.error);
      idle();
    }
  }

  // ---------- the chat box ----------
  // The words go after whatever was already in the box when listening started.
  function write() {
    const c = LUMO.ui.composer();
    if (!c) return;
    c.input.value = base + (base && text && !/\s$/.test(base) ? ' ' : '') + text;
    c.send.disabled = !c.input.value.trim();
    c.input.focus({ preventScroll: true });
    const end = c.input.value.length;
    c.input.setSelectionRange(end, end);
    c.input.scrollLeft = c.input.scrollWidth;
  }
  // Show the listening state on the mic button and the box. Called after every panel render too.
  function paint() {
    const c = LUMO.ui.composer();
    const on = state === 'listening' || state === 'starting';
    if (!c) { if (state === 'listening') stop(); return; }   // the chat was closed or left: stop listening
    c.form.classList.toggle('live', on);
    c.input.placeholder = on ? 'Listening…' : PLACEHOLDER;
    if (c.mic) {
      c.mic.classList.toggle('live', on);
      c.mic.setAttribute('aria-pressed', String(on));
      c.mic.setAttribute('aria-label', on ? 'Stop listening' : 'Speak');
    }
  }
  function idle() {
    clearTimeout(stopTimer);
    const was = state;
    state = 'idle'; mode = null;
    paint();
    if (was !== 'idle') LUMO.ui.composer()?.input.focus({ preventScroll: true });
  }

  // ---------- start and stop ----------
  async function start(m) {
    if (state !== 'idle' || !SR) return;
    // Start the scan if it hasn't run. That can take Lumo's panel down and back up (reset() below),
    // so only claim the "starting" state afterwards.
    if (!LUMO.ensureStarted()) { LUMO.ui.note('Open a listing and ask Lumo'); return; }   // not a listing
    const g = ++gen;
    state = 'starting'; mode = m; text = '';
    LUMO.ui.openChat();
    // The panel may still be mounting (the scan only just started). Wait for the chat box, up to about a second.
    let c = LUMO.ui.composer();
    for (let i = 0; !c && i < 60 && g === gen; i++) { await new Promise((r) => requestAnimationFrame(r)); c = LUMO.ui.composer(); }
    if (g !== gen) return;
    if (!c) { state = 'idle'; mode = null; return; }
    paint();
    // First time: approve the mic once for Lumo in its own tab.
    const { micGranted } = await chrome.storage.local.get('micGranted');
    if (g !== gen) return;
    if (!micGranted) {
      state = 'idle'; mode = null; paint();
      LUMO.send('openMicSetup');
      LUMO.ui.chatNote('Allow the microphone in the tab that just opened, then try again.');
      return;
    }
    base = c.input.value;
    const p = await withTimeout(ensureFrame(), 4000);
    if (g !== gen) return;
    if (!p || !port) { console.debug('[Lumo] voice: the mic frame did not load'); state = 'idle'; mode = null; paint(); return; }
    port.postMessage({ cmd: 'start' });
    state = 'listening';
    paint();
  }

  // Stop and keep every word (the frame sends the last words, then "end").
  function stop() {
    if (state === 'starting') { gen++; state = 'idle'; mode = null; paint(); return; }
    if (state !== 'listening') return;
    state = 'stopping';
    paint();
    port?.postMessage({ cmd: 'stop' });
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => { if (state === 'stopping') idle(); }, 2500);   // never stay stuck
  }
  // Esc: same as stop, keeping the text. stop (not abort) so the last words aren't lost.
  const cancel = stop;
  // The question was sent: switch the mic off and drop anything still on its way, so the sent words don't come back.
  function abandon() {
    if (state === 'idle') return;
    if (state === 'starting') { gen++; state = 'idle'; mode = null; paint(); return; }
    port?.postMessage({ cmd: 'cancel' });
    idle();
  }
  const toggle = () => (state === 'idle' ? start('toggle') : stop());

  // Lumo's panel was taken down (new page, new scan): the frame went with it.
  function reset() {
    gen++; clearTimeout(stopTimer);
    if (state !== 'idle') port?.postMessage({ cmd: 'cancel' });
    state = 'idle'; mode = null;
    port?.close(); port = null; frame?.remove(); frame = null; ready = null; readyResolve = null;
  }

  // ---------- keyboard ----------
  // Capture phase on window: we see the keys before the site and before ui.js (which closes the panel on Esc).
  const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
  addEventListener('keydown', (e) => {
    if (matches(keys.ptt, e)) { swallow(e); if (!e.repeat && state === 'idle') start('ptt'); return; }
    if (matches(keys.toggle, e)) { swallow(e); if (!e.repeat) toggle(); return; }
    if (e.key === 'Escape' && state !== 'idle') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); }
  }, { capture: true });
  addEventListener('keyup', (e) => {
    if (mode !== 'ptt' || state === 'idle') return;
    const k = keys.ptt;
    if (e.code === k.code) { swallow(e); stop(); return; }
    if (Object.entries(MOD_KEYS).some(([f, name]) => k[f] && e.key === name)) stop();
  }, { capture: true });
  // A missed key-up must never leave the mic on.
  addEventListener('blur', () => { if (mode === 'ptt') stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'ptt') stop(); });

  LUMO.voice = {
    supported: !!SR,
    start, stop, cancel, toggle, abandon, reset, paint,
    get listening() { return state !== 'idle'; }
  };
})();
