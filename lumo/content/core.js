// Shared bits for every Lumo content script. Everything hangs off one object so nothing leaks into the page.
var LUMO = (globalThis.LUMO = globalThis.LUMO || {});

(() => {
  // Talk to the service worker. Resolves with the value, or null if anything fails.
  LUMO.send = (type, data = {}) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, ...data }, (r) => {
          if (chrome.runtime.lastError || !r) return resolve(null);
          if (!r.ok) console.debug('[Lumo]', type, r.error);
          resolve(r.ok ? r.v : null);
        });
      } catch { resolve(null); }
    });

  LUMO.money = (n) => (n == null ? '' : '$' + Math.round(n).toLocaleString('en-AU'));
  LUMO.dist = (m) => (m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km');
  LUMO.walk = (m) => Math.max(1, Math.round((m * 1.3) / 80));
  LUMO.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  LUMO.reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Brand fallback font. On a Mac the panel uses SF Pro; elsewhere Schibsted Grotesk.
  LUMO.loadFonts = () => {
    if (LUMO._fonts) return;
    LUMO._fonts = true;
    try {
      for (const w of [400, 500, 600, 700]) {
        const f = new FontFace('Lumo Grotesk', `url(${chrome.runtime.getURL(`fonts/schibsted-grotesk-latin-${w}-normal.woff2`)}) format("woff2")`, { weight: String(w) });
        f.load().then((x) => document.fonts.add(x)).catch(() => {});
      }
    } catch {}
  };

  // The Beam mark, inline so it never depends on the page.
  LUMO.logo = (size = 22) => `<svg class="logo" viewBox="0 0 512 512" width="${size}" height="${size}" aria-hidden="true">
    <defs><linearGradient id="lgA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1C1C1E"/><stop offset="1" stop-color="#2C2C30"/></linearGradient>
    <linearGradient id="lgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3D58C"/><stop offset="1" stop-color="#B98F4F"/></linearGradient></defs>
    <rect width="512" height="512" rx="116" fill="url(#lgA)"/>
    <path d="M120 236 L256 124 L392 236" fill="none" stroke="url(#lgB)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M196 230 V384 H324" fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="330" cy="296" r="22" fill="#F3D58C"/></svg>`;

  // Tiny line icons, drawn to match SF Symbols weight.
  const P = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    fold: '<path d="M6 12h12"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
    shrink: '<path d="M20 10h-6V4M4 14h6v6M14 10l6.5-6.5M10 14l-6.5 6.5"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    street: '<circle cx="12" cy="5" r="2"/><path d="M12 8v6M12 14l-3 7M12 14l3 7M8 11h8"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
  };
  LUMO.icon = (n, s = 16) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
})();
