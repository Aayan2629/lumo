// Lumo's microphone. Runs inside a hidden extension frame on the listing page, so the mic is approved
// once for Lumo (mic/allow.html) and not once per site.
//
// The content script opens a private MessageChannel and hands us one end. Everything after that goes
// over the port, never window.postMessage, so the listing site's own scripts can't read the words.
// The frame's URL carries a one-off token (#...) that the init message must repeat: the page can reach
// this frame through window.frames, but it can't read our URL.
(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const token = location.hash.slice(1);
  let port = null;

  let rec = null;
  let want = false;        // the user still wants the mic on
  let done = '';           // text from earlier sessions (Chrome ends long sessions; we restart and keep it)
  let heard = '';          // this session's text so far
  let restarts = [];       // times of recent restarts, to stop a restart loop

  const post = (m) => port && port.postMessage(m);
  const join = (...parts) => parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');

  addEventListener('message', (e) => {
    if (port || !e.data || e.data.type !== 'lumo-mic-init' || !token || e.data.token !== token || !e.ports[0]) return;
    port = e.ports[0];
    port.onmessage = (ev) => {
      const c = ev.data && ev.data.cmd;
      if (c === 'start') start();
      else if (c === 'stop') stop(false);
      else if (c === 'cancel') stop(true);
    };
    post({ type: 'ready', supported: !!SR });
  });

  function start() {
    if (!SR) { post({ type: 'error', error: 'not-supported' }); post({ type: 'end' }); return; }
    if (want) return;
    // A session that is still shutting down (after cancel) must not end the new one.
    if (rec) { const old = rec; rec = null; old.onresult = old.onerror = old.onend = null; try { old.abort(); } catch {} }
    want = true; done = ''; heard = ''; restarts = [];
    session();
  }

  function session() {
    heard = '';
    const r = (rec = new SR());
    r.lang = 'en-AU';
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => {
      let t = '';
      for (const x of e.results) t += x[0].transcript;
      heard = t;
      post({ type: 'text', text: join(done, heard) });
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { want = false; post({ type: 'denied' }); return; }
      // Silence and network blips end the session; onend restarts it while the user still wants the mic.
      if (e.error === 'no-speech' || e.error === 'network' || e.error === 'aborted') return;
      want = false; post({ type: 'error', error: e.error });
    };
    r.onend = () => {
      if (r !== rec) return;
      done = join(done, heard); heard = '';
      rec = null;
      if (want) {
        const now = Date.now();
        restarts = restarts.filter((t) => now - t < 5000).concat(now);
        if (restarts.length <= 4) { try { session(); return; } catch {} }
        want = false; post({ type: 'error', error: 'restart-loop' });
      }
      post({ type: 'end' });
    };
    r.start();
  }

  // stop() hands over the last words; abort() drops them.
  function stop(abort) {
    want = false;
    if (!rec) { post({ type: 'end' }); return; }
    try { abort ? rec.abort() : rec.stop(); } catch { post({ type: 'end' }); }
  }
})();
