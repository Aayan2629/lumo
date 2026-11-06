// When the demo opens from inside the extension, load Lumo by hand
// (Chrome doesn't inject content scripts into extension pages).
// On localhost the manifest injects them, so this does nothing there.
(async () => {
  if (location.protocol !== 'chrome-extension:') return;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = '../content/highlights.css';
  document.head.appendChild(css);
  for (const f of ['core', 'extract', 'rules', 'anchor', 'ui.css', 'ui', 'chat', 'main']) {
    await new Promise((ok) => { const s = document.createElement('script'); s.src = `../content/${f}.js`; s.onload = s.onerror = ok; document.body.appendChild(s); });
  }
})();
