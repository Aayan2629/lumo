# Anchoring marks on third-party pages from a Chrome MV3 extension (words, sentences, images; React/Next.js hosts)

Scope note: findings come from developer.chrome.com, MDN, the Chromium blink-dev "Intent to Ship" thread, the web-features dataset, the Hypothesis engineering blog and one dev.to post on React/DOM-mutation crashes. Items under "Inferences" are engineering judgement or general platform knowledge that I did not re-verify against a fetched page in this session; treat them as such. Code sketches are self-written.

## 1. How to mark text: wrapping elements vs CSS Custom Highlight API vs overlay boxes, and hover/click on highlights

### Takeaway
Use the CSS Custom Highlight API as the default text-marking mechanism: it paints Ranges without inserting DOM nodes, so it reflows and scrolls with the text for free and cannot desync React's virtual DOM. It only allows a small set of text-level styles (color, background-color, text-decoration, text-shadow, text-stroke/fill), so any "glow box", pill, rounded corner or badge has to be drawn as an overlay positioned from `Range.getClientRects()`. For hover/click, Chrome 140+ ships `CSS.highlights.highlightsFromPoint(x, y)`, which returns the highlights and the specific ranges under a point; `document.caretPositionFromPoint()` is the fallback hit test.

### Cited Findings
- `::highlight()` accepts only: `color`, `background-color`, `text-decoration` and its longhands, `text-shadow`, `-webkit-text-stroke-color`, `-webkit-text-fill-color`, `-webkit-text-stroke-width`. `background-image` is explicitly ignored. `box-shadow`, `outline`, `border`, `padding`, `border-radius` are not on the list, so they do not apply. — [MDN ::highlight()](https://developer.mozilla.org/en-US/docs/Web/CSS/::highlight)
- `::highlight()` is marked Baseline 2026 (newly available since March 2026). The Custom Highlight API as a whole is listed Baseline 2025 (June 2025). Feature-detect with `if (CSS.highlights)`. — [MDN ::highlight()](https://developer.mozilla.org/en-US/docs/Web/CSS/::highlight); [MDN CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
- Usage: `const h = new Highlight(range1, range2); CSS.highlights.set("name", h);` style with `::highlight(name) { ... }`; registry supports `set`, `delete`, `clear`. The API highlights text "without affecting the DOM structure in the page". `Highlight.type` can expose semantics (e.g. spelling/grammar) to assistive tech, but support varies, so pair with other accessible cues. — [MDN CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
- `highlightsFromPoint(x, y, options)` returns `sequence<HighlightHitResult>`; each result has `highlight` and `ranges` (the ranges hit under the point). Ranges were added after CSSWG discussion. Highlights hidden beneath other content are not returned. Motivation: tooltips, context menus, click/hover on custom highlights. — [blink-dev Intent to Ship: highlightsFromPoint](https://groups.google.com/a/chromium.org/g/blink-dev/c/8OpfR1m_zjU)
- `highlightsFromPoint` support: Chrome 140, Edge 140, Firefox 150; Safari not supported; not Baseline. Spec: CSS Highlight API L1 `#dom-highlightregistry-highlightsfrompoint`. — [web-features: highlightsfrompoint](https://web-platform-dx.github.io/web-features-explorer/features/highlightsfrompoint.json)
- `document.caretPositionFromPoint(x, y, { shadowRoots: [...] })` returns a `CaretPosition` (`offsetNode`, `offset`) or `null` (outside viewport / no insertion point). It is Baseline 2025 (Dec 2025). If the caret falls in a shadow root not passed in `shadowRoots`, the result is remapped to the host. `caretRangeFromPoint` is the non-standard WebKit fallback (returns a Range: `startContainer`/`startOffset`). — [MDN caretPositionFromPoint](https://developer.mozilla.org/en-US/docs/Web/API/Document/caretPositionFromPoint)
- Wrapping/modifying text nodes under React is a known crash source: Google Translate wraps each text node in `<font>` elements; React still holds the original text node and later calls `parent.removeChild(textNode)` on a node that is no longer a child, throwing `Failed to execute 'removeChild' on 'Node'` or `'insertBefore'` and potentially blanking the app. Mitigations on the site side (wrapping text in spans, `translate="no"`, monkey-patching `removeChild` per React issue #11538) are not available to an extension. — [dev.to: Preventing React crashes from Google Translate](https://dev.to/ivanturashov/preventing-react-crashes-handling-google-translate-5bi0)

### Inferences
- **Decision matrix (my synthesis):**
  | Approach | Stays glued on scroll/reflow | Risk to host page | Styling freedom | Events |
  |---|---|---|---|---|
  | Wrap text in custom element (`<lumo-mark>`) | Yes (it is in flow) | High on React/Next: reconciler crashes (see above), hydration mismatch warnings if done before hydration, host CSS selectors like `p > span` may match | Full CSS | Native listeners |
  | CSS Custom Highlight API | Yes (painted by engine with the text) | ~None (no DOM mutation) | Text-level only (list above) | `highlightsFromPoint` (Chrome 140+) or caret hit-test |
  | Overlay boxes from `Range.getClientRects()` | Only if you recompute on scroll/resize/mutation; rAF-throttled | Low (overlay lives in your own shadow root) | Full CSS (glow, rounded, badges) | Native on overlay, but overlay must be `pointer-events:none` to not block page, so still hit-test |
- **Recommended hybrid:** Highlight API for the base tint/underline (`background-color` + `text-decoration: underline wavy`), plus optional overlay chips/badges only for the currently hovered/selected mark. This keeps per-frame geometry work tiny.
- Live `Range` objects collapse when React replaces the text node they point to (React often reuses text nodes on prop changes via `nodeValue` updates, but replaces them on keyed re-mounts). So each mark must be re-anchored after mutations (see section 4); check `range.collapsed` or `range.toString() !== expected` to detect staleness. (General DOM behaviour; MDN fetch summary described this as general knowledge, not page content.)
- Hover detection with `highlightsFromPoint` needs a document-level `pointermove` listener (passive, rAF-throttled). `pointer-events` is irrelevant because highlights are not elements; clicks still reach the host page, so to "own" a click on a mark you must decide whether to `preventDefault` (risky on links) or just show your UI alongside.
- `Range.getClientRects()` returns one rect per line box fragment in viewport coordinates, so a multi-line sentence yields several rects; draw one overlay per rect, and convert to document coordinates (`+ scrollX/scrollY`) only if the overlay container is absolutely positioned in the document; with a `position:fixed` container, re-read rects on every scroll frame.

### Code sketch (self-written)
```js
// content.js — isolated world
const HL = new Highlight();            // one Highlight per "kind" of mark
HL.priority = 10;                      // beat site's own highlights if any
CSS.highlights.set('lumo-flag', HL);
// inject once (document-level stylesheet; ::highlight cannot be scoped into a shadow root for page text)
const css = new CSSStyleSheet();
css.replaceSync(`::highlight(lumo-flag){background-color:rgb(255 200 0 / .35);text-decoration:underline 2px rgb(255 140 0);}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, css];

const marks = new Map(); // range -> {id, quote}
function addMark(range, meta){ HL.add(range); marks.set(range, meta); }

let pending = null;
document.addEventListener('pointermove', e => {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = null;
    let hitRange = null;
    if (CSS.highlights.highlightsFromPoint) {           // Chrome 140+
      const hits = CSS.highlights.highlightsFromPoint(e.clientX, e.clientY);
      const h = hits.find(r => r.highlight === HL);
      hitRange = h?.ranges[0] ?? null;
    } else {                                              // fallback
      const cp = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (cp) for (const r of marks.keys())
        if (r.isPointInRange(cp.offsetNode, cp.offset)) { hitRange = r; break; }
    }
    showTooltipFor(hitRange ? marks.get(hitRange) : null, hitRange);
  });
}, { passive: true });
```
Note: the caret fallback reports the nearest insertion point even in whitespace beside text, so also confirm the pointer is inside one of `range.getClientRects()`.

### Gaps
- I did not find an authoritative statement on whether `::highlight()` styles can be defined inside an extension's shadow root to style page text; by spec the pseudo is matched on the originating element's tree, so the stylesheet must be in the document (or adopted on `document`). Verify in testing.
- Did not find Chrome-specific performance numbers for thousands of ranges in one Highlight.
- Exact shape of `HighlightsFromPointOptions` (blink-dev thread mentions it but does not list members; likely `shadowRoots`, mirroring caretPositionFromPoint) is unverified.

## 2. Finding text robustly: TreeWalker, whitespace normalisation, cross-element phrases, hidden nodes

### Takeaway
Build a flat "text map": walk visible text nodes with a TreeWalker, concatenate their (whitespace-normalised) contents into one string while recording each node's start offset, search that string for the phrase (exact first, then fuzzy), and map the match back to a DOM Range that may span several text nodes/elements. Store each mark with redundant selectors (quote + prefix/suffix context, plus position), as Hypothesis does, so it can re-anchor after re-renders.

### Cited Findings
- Hypothesis anchors each annotation with three selectors: RangeSelector (XPaths + offsets; breaks when structure changes), TextPositionSelector (start/end offsets in full page text; survives structural change but not text edits), TextQuoteSelector (`exact` + 32 chars `prefix`/`suffix`). — [Hypothesis: Fuzzy Anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/)
- Re-anchoring order: (1) XPath range + verify quote; (2) text position + verify quote; (3) context-first fuzzy: find prefix near expected start, suffix near expected end, compare middle to `exact` within a threshold; (4) fuzzy search for `exact` across whole document. Fuzzy matching uses a modified google-diff-match-patch (Bitap for approximate match, Myers diff for scoring). — [Hypothesis: Fuzzy Anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/)
- Lessons: "documents are both trees and strings" — search needs a string, highlighting needs DOM nodes, so keep a two-way mapping; some DOM content never renders (CSS-hidden, whitespace quirks); building the mapping on long pages can take seconds and it goes stale when the page changes externally. — [Hypothesis: Fuzzy Anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/)

### Inferences
- For Lumo, structural selectors (XPath) are nearly worthless on Next.js listing pages because class names are hashed and trees re-render; prefer TextQuote (exact + prefix/suffix) as primary and position as a hint.
- Hidden-node filtering: in the TreeWalker `acceptNode`, reject text inside `SCRIPT, STYLE, NOSCRIPT, TEMPLATE, TEXTAREA, INPUT`, inside your own extension host, and whose parent has `checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })` false (Chrome 105+ API; cheap compared to `getComputedStyle`). Also reject `aria-hidden` subtrees if you only want user-visible copy. Collapsed carousel slides may be `visibility:hidden`/off-screen: decide per feature whether off-screen-but-rendered counts.
- Whitespace: normalise each node's text by collapsing `\s+` to a single space and keep a per-character offset table (normalised index -> [node, rawOffset]) so the match maps back exactly. Insert a virtual space at block-element boundaries (`display` block/flex/grid parents, `<br>`) so "Price" + "$950,000" in adjacent divs does not become "Price$950,000".
- Also normalise Unicode (NFKC), curly quotes/apostrophes, non-breaking spaces (` `) and soft hyphens (`­`) on both needle and haystack, and lowercase for matching.
- For LLM-supplied phrases (likely Lumo's case: model returns a quote it wants highlighted), the quote may be slightly paraphrased; use exact match, then a fuzzy fallback (diff-match-patch `match_main` or a simple token-level Levenshtein window) with a threshold, and reject ambiguous multi-hits unless prefix/suffix disambiguate.
- Scope the walk to the listing's main content root (e.g. `main`, or the description container) to cut cost and false positives from nav/footers/recommended-listings carousels.

### Code sketch (self-written)
```js
function buildTextMap(root) {
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','TEXTAREA','INPUT','SELECT']);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || SKIP.has(p.tagName) || p.closest('#lumo-host')) return NodeFilter.FILTER_REJECT;
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
      if (!p.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let text = '', map = [];              // map[i] = [node, rawOffset] for text[i]
  let prevBlock = null;
  for (let n; (n = w.nextNode());) {
    const blk = n.parentElement.closest('p,div,li,h1,h2,h3,h4,td,section,article');
    if (text && blk !== prevBlock && !text.endsWith(' ')) { text += ' '; map.push(map.at(-1)); }
    prevBlock = blk;
    const raw = n.nodeValue;
    for (let i = 0; i < raw.length; i++) {
      let ch = raw[i].replace(/[\s ]/, ' ');
      if (ch === '­') continue;
      if (ch === ' ' && text.endsWith(' ')) continue;   // collapse runs
      text += ch.toLowerCase(); map.push([n, i]);
    }
  }
  return { text, map };
}
function rangeFor({ text, map }, quote) {
  const q = quote.normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
  const i = text.indexOf(q);            // then fuzzy fallback if -1
  if (i < 0) return null;
  const [sn, so] = map[i], [en, eo] = map[i + q.length - 1];
  const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo + 1);
  return r;
}
```

### Gaps
- No fetched benchmark for TreeWalker + text-map build time on a typical domain.com.au / realestate.com.au listing; Hypothesis only says "several seconds" on long pages (with their older, heavier implementation).
- Did not fetch an authoritative source for `Element.checkVisibility()` options/support in this session (I believe Chrome 105+).

## 3. Outlining an image (gallery/carousel photo) with an edge-only glow that follows it

### Takeaway
Prefer an overlay box (in the extension's own shadow-root layer) whose geometry is driven by `getBoundingClientRect()` of the target `<img>`, recomputed on scroll (rAF), ResizeObserver and IntersectionObserver callbacks; this gives full styling (box-shadow glow, inner-only ring, rounded corners, animated pulse) without touching the host's element. Applying `outline`/`box-shadow` directly to the `<img>` is simpler and follows perfectly, but is frequently clipped by carousel containers with `overflow:hidden` and can be wiped by React re-renders that reset `style`/`className`.

### Cited Findings
- No source fetched in this session specifically covers overlay-vs-outline for images, ResizeObserver or IntersectionObserver semantics. The top-layer finding (section 5) is relevant: popovers placed in the top layer sit above all other page content. — [MDN Using the Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using)

### Inferences
- **Direct style on img** (`outline: 3px solid; outline-offset: -3px` for an inside-edge ring, or `box-shadow: inset 0 0 0 3px ..., 0 0 16px ...`): zero positioning code; follows transforms/animations in carousels exactly. Problems: `box-shadow` on `<img>` (a replaced element) works for outer shadows but `inset` box-shadow is painted under the image content, so it is hidden; outer glow gets clipped by `overflow:hidden` slide containers (very common in carousels); React may overwrite `style` on re-render; Next.js `<Image>` often wraps the img in a span/div with its own sizing. A safer direct option: add a data-attribute (`img[data-lumo-glow]`) and style it from an injected document stylesheet with `outline` + negative `outline-offset` (outline is drawn inside the box, so it is not clipped and doesn't affect layout). React does not remove unknown attributes it didn't set unless the element is re-created, but re-creation does happen on slide changes, so re-apply on mutation.
- **Overlay**: a `position:fixed` div in the extension's shadow root, sized to `img.getBoundingClientRect()`, `pointer-events:none`, with `box-shadow: inset 0 0 0 2px color, inset 0 0 18px color` (edge-only glow that stays inside the photo edges) and `border-radius` copied from `getComputedStyle(img).borderRadius`. Clip to the visible part by intersecting with the nearest `overflow:hidden` ancestor's rect (or use IntersectionObserver `intersectionRect`), otherwise the glow will float over neighbouring slides.
- Keep-in-sync loop: ResizeObserver on the img (size changes, responsive srcset swaps), IntersectionObserver on the img (hide overlay when out of view; `thresholds: [0, 0.01, 1]`), `scroll` listener with `{capture:true, passive:true}` on `document` (catches scrolls of inner carousel scrollers too), and `resize` on window — all funnel into one rAF update. Carousels that move slides with CSS `transform` animations fire none of those events, so while an image is "marked", run a short rAF loop comparing rects (cheap for a handful of elements) or listen for `transitionend`/`animationend` on the track.
- Identify "the same photo" across re-renders by `currentSrc`/`src` basename (listing photo CDNs typically encode an image id in the URL), not by element identity.
- CSS anchor positioning (`anchor-name` on the img, `position-anchor` on the overlay) could in principle remove the JS geometry loop, but requires writing `anchor-name` onto a host element and the overlay must be in the same tree scope; treat as experimental for this use.

### Code sketch (self-written)
```js
function glow(img, layer /* element inside our shadow root, position:fixed; inset:0; pointer-events:none */) {
  const box = document.createElement('div');
  box.className = 'glow';   // .glow{position:fixed;pointer-events:none;box-shadow:inset 0 0 0 2px #7cf,inset 0 0 18px #7cf;border-radius:var(--r)}
  layer.append(box);
  let visible = true, raf = 0;
  const update = () => { raf = 0;
    if (!img.isConnected || !visible) { box.hidden = true; return; }
    let r = img.getBoundingClientRect();
    const clip = img.closest('[style*="overflow"], .swiper, .slick-list') ; // heuristic; better: walk ancestors checking computed overflow
    if (clip) { const c = clip.getBoundingClientRect();
      r = new DOMRect(Math.max(r.left,c.left), Math.max(r.top,c.top),
        Math.min(r.right,c.right)-Math.max(r.left,c.left), Math.min(r.bottom,c.bottom)-Math.max(r.top,c.top)); }
    box.hidden = r.width <= 0 || r.height <= 0;
    Object.assign(box.style, { left: r.left+'px', top: r.top+'px', width: r.width+'px', height: r.height+'px' });
    box.style.setProperty('--r', getComputedStyle(img).borderRadius);
  };
  const schedule = () => raf ||= requestAnimationFrame(update);
  const ro = new ResizeObserver(schedule); ro.observe(img);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); }, { threshold: [0, 0.01] });
  io.observe(img);
  addEventListener('scroll', schedule, { capture: true, passive: true });
  addEventListener('resize', schedule, { passive: true });
  img.closest('[class*="track"], [class*="carousel"]')?.addEventListener('transitionend', schedule);
  schedule();
  return () => { ro.disconnect(); io.disconnect(); removeEventListener('scroll', schedule, true); box.remove(); };
}
```

### Gaps
- Not verified in this session: exact painting behaviour of inset box-shadow on `<img>` (stated from platform knowledge), and how domain.com.au / realestate.com.au galleries are built (which carousel library, overflow containers, lightbox in top layer or not). Needs inspection of the live pages.

## 4. Keeping up with SPA re-renders: MutationObserver, debouncing, URL change detection

### Takeaway
Treat every mark as a declarative "intent" (selectors + kind) and run an idempotent reconcile pass: one MutationObserver on the content root (childList + subtree + characterData), debounced ~150-300 ms and run in `requestIdleCallback`/rAF, which re-validates each live Range and re-anchors stale ones from the stored selectors. Detect client-side navigations both in the page (Navigation API events, polling `location.href` as a fallback) and from the service worker via `chrome.webNavigation.onHistoryStateUpdated`, then wipe and recompute marks for the new listing.

### Cited Findings
- Content scripts declared in the manifest run on document load (`run_at`: `document_idle` default, `document_start`, `document_end`); the docs do not say they re-run on `history.pushState`. — [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- `chrome.webNavigation.onHistoryStateUpdated` fires when a frame's history changes to a new URL, e.g. via `history.pushState()`; `onReferenceFragmentUpdated` fires on `#hash` changes. Both need the `"webNavigation"` permission, accept `filters: { url: [UrlFilter...] }`, and give `tabId`, `frameId`, `url`, `documentId`, `transitionType`, etc. — [Chrome: webNavigation API](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)
- Hypothesis's text mapping goes stale when the page changes externally and was only refreshed on Hypothesis's own DOM changes — a cautionary example of why external-mutation handling is needed. — [Hypothesis: Fuzzy Anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/)
- Modifying React-owned DOM (wrapping text nodes) causes `removeChild`/`insertBefore` crashes during commit. — [dev.to: Preventing React crashes](https://dev.to/ivanturashov/preventing-react-crashes-handling-google-translate-5bi0)

### Inferences
- **Next.js specifics:** content scripts at `document_idle` usually run after hydration starts but can still race it; any DOM mutation before hydration completes causes hydration mismatch errors and React may discard and re-render the subtree, dropping your nodes. Using the Highlight API avoids this because it doesn't mutate. Still wait for content to stabilise (e.g., first MutationObserver quiet period of ~500 ms, or presence of a known listing element) before the first anchoring pass.
- **Observer config:** `observe(root, { childList: true, subtree: true, characterData: true })`. Ignore mutations whose target is inside your own host element (filter by `#lumo-host`) to avoid feedback loops. Don't use `attributes: true` on the whole subtree (very noisy on React pages with animations); observe attributes only on specific marked images (`attributeFilter: ['src','srcset','class','style']`).
- **Debounce/reconcile:** collect dirty flag, then `setTimeout(…, 200)` → `requestIdleCallback(reconcile, { timeout: 500 })`. In reconcile: for each mark, if `range.collapsed || !range.startContainer.isConnected || normalise(range.toString()) !== mark.quote` → rebuild text map lazily (once per pass) and re-anchor. Highlight API ranges can be swapped in place (`HL.delete(old); HL.add(new)`).
- **URL change in content script (isolated world):** the isolated world shares the DOM but not JS globals, so monkey-patching `history.pushState` from the isolated world does not intercept the page's calls (would require a MAIN-world script). Options: (a) `window.navigation?.addEventListener('navigatesuccess', …)` — Navigation API object is part of the window/DOM and should be visible to isolated-world scripts (unverified in docs; test); (b) `popstate` listener for back/forward; (c) cheap fallback: in the MutationObserver callback compare `location.href` to last seen; (d) service worker `webNavigation.onHistoryStateUpdated` filtered by `hostSuffix: 'domain.com.au'` / `'realestate.com.au'`, then `chrome.tabs.sendMessage(tabId, {type:'url-changed', url})`. (d) is the most reliable but adds the webNavigation permission (likely a "read your browsing history" install warning; unverified).
- On URL change: clear `HL`, disconnect image observers, remove overlays, cancel in-flight LLM requests (AbortController via the service worker), then re-run the listing pipeline when the new content has settled.

### Code sketch (self-written)
```js
const root = document.querySelector('main') ?? document.body;
let timer = 0, lastUrl = location.href;
const mo = new MutationObserver(muts => {
  if (muts.every(m => m.target.closest?.('#lumo-host') || m.target.parentElement?.closest('#lumo-host'))) return;
  if (location.href !== lastUrl) { lastUrl = location.href; onRoute(lastUrl); return; }
  clearTimeout(timer);
  timer = setTimeout(() => requestIdleCallback(reconcile, { timeout: 500 }), 200);
});
mo.observe(root, { childList: true, subtree: true, characterData: true });
window.navigation?.addEventListener('navigatesuccess', () => { if (location.href !== lastUrl) { lastUrl = location.href; onRoute(lastUrl); } });
addEventListener('popstate', () => { lastUrl = location.href; onRoute(lastUrl); });
chrome.runtime.onMessage.addListener(m => { if (m?.type === 'url-changed' && m.url !== lastUrl) { lastUrl = m.url; onRoute(m.url); } });

function reconcile() {
  let tm = null;
  for (const mark of state.marks) {
    const ok = mark.range && !mark.range.collapsed && mark.range.startContainer.isConnected &&
               norm(mark.range.toString()) === mark.quoteNorm;
    if (ok) continue;
    tm ??= buildTextMap(root);
    const r = rangeFor(tm, mark.quote);  // + prefix/suffix disambiguation
    if (mark.range) HL.delete(mark.range);
    mark.range = r; if (r) HL.add(r);
  }
}
// service worker
chrome.webNavigation.onHistoryStateUpdated.addListener(d => {
  if (d.frameId === 0) chrome.tabs.sendMessage(d.tabId, { type: 'url-changed', url: d.url }).catch(() => {});
}, { url: [{ hostSuffix: 'domain.com.au' }, { hostSuffix: 'realestate.com.au' }] });
```

### Gaps
- Did not find official confirmation that the Navigation API's `navigate`/`navigatesuccess` events fire for isolated-world listeners in content scripts, nor the exact install warning text for `webNavigation`.
- No fetched source on MutationObserver performance budgets on heavy React pages.

## 5. Isolating extension UI from host CSS: Shadow DOM, adoptedStyleSheets, fonts, z-index/top layer, pointer-events

### Takeaway
Mount all UI (tooltips, overlays, floating panel) under one host element appended to `document.documentElement`, with a closed shadow root, styles via constructable `adoptedStyleSheets`, an `all: initial` reset on the internal root, and `@font-face` declared at document level (not inside the shadow root). Put transient UI (tooltip, floating panel) into the top layer with `popover="manual"`/`"hint"` so it beats any host z-index and ancestor clipping; keep the geometry layer `pointer-events:none` and re-enable pointer events only on interactive children.

### Cited Findings
- Content scripts run in an isolated world (JS globals separate from the page), but they share the page's DOM. A script injected into the MAIN world shares the page's JS environment and the page's CSP applies to it. — [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- Because they share the DOM, a page can post messages to content scripts via `window.postMessage`; check `event.source` before trusting. — [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- Popover API: `popover`/`popover="auto"` (light-dismiss, Esc, one auto at a time), `popover="manual"` (no light dismiss, many can be open), `popover="hint"` (light-dismissible, doesn't close auto popovers; meant for hover tooltips; falls back to manual where unsupported). `showPopover()`/`hidePopover()`/`togglePopover()`; calling show on an open popover throws — check `:popover-open`. When shown, a popover is placed in the top layer "on top of all other page content". Auto popovers are dismissed when another element calls `showModal()` or `requestFullscreen()`. Invoker-associated popovers get an implicit anchor for CSS anchor positioning (`position-area`, or `position-anchor: auto` + `anchor()`; set `margin:0`). — [MDN: Using the Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using)
- `@font-face` rules inside a shadow-root stylesheet historically failed to load; workaround is to declare `@font-face` globally (document level) and only reference the family inside the shadow tree. (2013 post; still the commonly cited behaviour.) — [Rob Dodson: @font-face doesn't work in the Shadow DOM](https://robdodson.github.io/blog/2013/11/19/at-font-face-doesnt-work-in-shadow-dom)

### Inferences
- **Closed vs open shadow root:** closed hides `host.shadowRoot` from page scripts (mild privacy/anti-tamper benefit), but the page can still see/remove the host element and read its rendered output; it is not a security boundary. Open is easier to debug and to pass into `caretPositionFromPoint({shadowRoots})`/`highlightsFromPoint` options. Reasonable default: closed in production, keep your own reference.
- **Inheritance leak:** inherited properties (`font`, `color`, `line-height`, `letter-spacing`, `direction`, `cursor`, `visibility`) still flow from the host page into the shadow tree; reset with `:host { all: initial; }` and set explicit fonts/colors. Host page rules like `html * { … }` or `div { … }` cannot reach inside, but rules targeting your host element itself (e.g. `body > div { display:none }`) can; use a custom-element tag name (`lumo-root`) and set its styles with `!important` inline (`position:fixed; inset:0; z-index:2147483647; pointer-events:none; display:block`).
- **adoptedStyleSheets:** `const s = new CSSStyleSheet(); s.replaceSync(cssText); shadow.adoptedStyleSheets = [s];` — no `<style>` element, not affected by page CSP style-src (constructable sheets set from extension script) — the CSP claim is unverified, test on sites with strict CSP. Bundle CSS as a string or fetch `chrome.runtime.getURL('ui.css')` (needs `web_accessible_resources` if loaded via `<link>`).
- **Fonts:** ship font files in the extension, list them in `web_accessible_resources` with `matches` limited to the target sites, and inject `@font-face { src: url(chrome-extension://<id>/fonts/x.woff2) }` into a document-level adopted stylesheet, or use `new FontFace(name, url).load()` + `document.fonts.add()`. Use a unique family name (`LumoInter`) to avoid colliding with the site's fonts.
- **Stacking:** fixed-position host with max z-index works on most pages but loses to site elements already in the top layer (modal `<dialog>`, fullscreen gallery lightboxes) and can be trapped if the host is placed inside a transformed ancestor (keep it as child of `<html>`). For tooltips and the floating panel, use `popover="manual"` elements inside the shadow root and call `showPopover()`; re-call (hide then show) when a site lightbox opens to bring yours back on top, since top-layer order is last-shown-on-top (behaviour stated from spec knowledge; the MDN page does not state visual order explicitly). Avoid `popover="auto"` for persistent UI because site `showModal()` will light-dismiss it.
- **pointer-events:** overlay layer `pointer-events:none`; only tooltip/panel `pointer-events:auto`. Stop propagation of events originating in your UI (`keydown`, `wheel`, `pointerdown`) so site-wide hotkeys/gallery swipe handlers don't trigger, but listen in the bubbling phase on your host so you don't break the site's capture listeners.

### Code sketch (self-written)
```js
const host = document.createElement('lumo-root');
host.id = 'lumo-host';
host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;';
const shadow = host.attachShadow({ mode: 'closed' });
const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host{all:initial}
  .layer{position:fixed;inset:0;pointer-events:none;font:14px/1.4 LumoInter,system-ui,sans-serif;color:#111}
  .tip{pointer-events:auto;margin:0;inset:auto;position:fixed;border:0;border-radius:10px;padding:8px 10px;background:#fff;box-shadow:0 6px 24px #0003}
`);
shadow.adoptedStyleSheets = [sheet];
const fontSheet = new CSSStyleSheet();
fontSheet.replaceSync(`@font-face{font-family:LumoInter;src:url(${chrome.runtime.getURL('fonts/inter.woff2')}) format('woff2');font-display:swap}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, fontSheet];
shadow.innerHTML = `<div class="layer"></div><div class="tip" popover="manual"></div>`; // static, no untrusted data
document.documentElement.append(host);
const tip = shadow.querySelector('.tip');
function showTooltipAt(rect, text) {
  tip.textContent = text;                       // never innerHTML with model output
  tip.style.left = `${rect.left}px`; tip.style.top = `${rect.bottom + 6}px`;
  if (!tip.matches(':popover-open')) tip.showPopover();
}
for (const t of ['keydown','wheel','pointerdown']) host.addEventListener(t, e => e.stopPropagation());
```

### Gaps
- No current (2025-2026) authoritative doc found confirming `@font-face` inside shadow roots is still ignored in Chrome; the cited post is from 2013. Declaring at document level is the safe path regardless.
- Not verified: whether `document.adoptedStyleSheets` set from an isolated-world content script is subject to the host page's `style-src` CSP; and exact top-layer ordering rules.

## 6. Side panel vs injected floating panel; messaging; API key storage; host_permissions; MV3 CSP

### Takeaway
Use `chrome.sidePanel` for the main Lumo UI (an extension page with full Chrome API access, immune to host CSS/CSP, survives SPA navigations in the tab), enabled per tab only on matching listing URLs, opened by the toolbar action; keep in-page UI to small tooltips. Route all external API calls (LLM etc.) through the service worker, which has `host_permissions` for the API origin; content scripts are subject to the page's CORS. Store the user's API key in `chrome.storage.local` (or `session` for memory-only) and never expose it to content scripts. MV3 forbids remotely hosted code; bundle everything.

### Cited Findings
- **sidePanel manifest:** `"permissions": ["sidePanel"]`, `"side_panel": { "default_path": "sidepanel.html" }`; declare `"action"` so users can open it from the toolbar. `setPanelBehavior({ openPanelOnActionClick: true })` makes the action icon toggle the panel (default false). — [Chrome: sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- **Per-tab enablement:** `chrome.sidePanel.setOptions({ tabId, path, enabled })`; omitting `tabId` sets defaults. Documented pattern: listen to `tabs.onUpdated`, check the URL, `setOptions({tabId, path, enabled:true})` on matching sites, `enabled:false` elsewhere; the panel hides when switching to a tab where it's disabled and reappears on return. — [Chrome: sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- **open/close/events:** `sidePanel.open({tabId|windowId})` (Chrome 116+) must be called in response to a user action — action click, keyboard shortcut, context menu, or a user gesture on an extension page or content script. `close()` Chrome 141+ (Chrome 145: closing by `tabId` rejects if only the global panel is open). `onOpened` Chrome 141+, `onClosed` Chrome 142+. `getLayout()` (Chrome 140+) returns `"left"`/`"right"`. Side panels are extension pages with access to all Chrome APIs. `browser.*` namespace supported from Chrome 148. — [Chrome: sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- **Messaging:** `runtime.sendMessage()` (content script -> extension), `tabs.sendMessage(tabId, msg)` (extension page/SW -> content script); both return promises. Long-lived: `runtime.connect()` / `tabs.connect()` give a `Port` with `postMessage`, `onMessage`, `onDisconnect`; name ports to distinguish channels. For async `sendResponse`, return literal `true`; returning a Promise from `onMessage` is supported from Chrome 148 with gradual rollout (feature-check; `return true` always works); Chrome 146 propagates rejected `Error` messages. Messages are JSON-serialised (`undefined` -> `null`), max 64 MiB. — [Chrome: Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- **Messaging security:** content scripts are less trustworthy than the service worker; validate/sanitise all messages from them and limit privileged actions they can trigger; assume data sent to a content script may leak to the page; use `JSON.parse`/`innerText`, avoid `eval`/`innerHTML` with untrusted data. — [Chrome: Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- **Cross-origin requests:** service workers and extension pages can fetch cross-origin hosts listed in `host_permissions` (host or match pattern; path ignored; per scheme). Content scripts make requests on behalf of the page and are subject to the page's same-origin policy — always treated as cross-origin even if the extension has host permissions. Don't let content scripts request arbitrary URLs (a malicious page could forge messages); accept limited inputs and build the URL in the handler; avoid `innerHTML` with fetched data; prefer HTTPS; be careful if customising `connect-src`. — [Chrome: Cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- **Storage:** `storage.local` 10 MB (unlimited with `unlimitedStorage`), removed on uninstall, exposed to content scripts by default; `storage.session` in-memory, 10 MB, cleared on disable/reload/update/browser restart, not exposed to content scripts by default; `setAccessLevel()` changes exposure; `sync` ~100 KB / 8 KB per item / 512 items, write-rate limited. Docs recommend `storage.session` for sensitive data (not written to disk) and suggest restricting access for `local` if content-script exposure is a concern. Docs don't state whether data is encrypted. `storage.onChanged(changes, areaName)` for reacting to settings changes. — [Chrome: storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- **Remote code:** MV3 forbids remotely hosted JS/WASM (remote `<script>` tags, fetching then executing code), including inside third-party libs (example given: Firebase Auth); fetching data (JSON, CSS) is not RHC. `eval()` not supported by default; evaluation of strings is possible only in a sandboxed iframe page (not in the service worker). — [Chrome: Remotely hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
- **Extension CSP:** default `extension_pages`: `script-src 'self'; object-src 'self';`. Minimum (most permissive) allowed: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';` — adding `'unsafe-eval'` is an install-time error. Default sandbox CSP allows `'unsafe-inline' 'unsafe-eval'`. — [Chrome: Manifest CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)

### Inferences
- **Side panel vs floating panel:** side panel wins for Lumo's main UI: no host CSS/z-index fights, no CSP issues, persists across SPA route changes and across reloads of the tab, can use all chrome.* APIs and talk to the SW directly; costs: it narrows the page viewport (triggers responsive reflow on the listing — another reason marks must be reflow-proof), and it can't be opened programmatically without a user gesture. An injected floating panel is only worth it for inline, positionally-anchored UI (tooltips next to marks).
- **Message topology:** content script <-> SW via `runtime.sendMessage`/Port; side panel <-> content script directly via `chrome.tabs.sendMessage(tabId)` / `tabs.connect(tabId)` (side panel gets the tab via `chrome.tabs.query({active:true, currentWindow:true})`); side panel <-> SW via `runtime.sendMessage`. Use a Port from the side panel to the content script for streaming (hover events -> panel scrolls to the explanation; panel click -> content script scrolls to and pulses the mark). Port disconnects on navigation; reconnect on `onDisconnect`.
- **MV3 SW lifetime:** the SW can be terminated when idle; don't hold state in SW globals—keep per-tab analysis results in `storage.session` keyed by tabId+URL. Long LLM streaming fetches keep the SW alive while events/fetch are active (general MV3 behaviour; not re-verified here).
- **API key handling:** `storage.local` with `chrome.storage.local.setAccessLevel` cannot restrict `local` (only... unverified — the docs say `setAccessLevel` "changes which contexts can access" an area; verify whether it applies to `local` or only `session`). Practical rule: only the side panel/options page and SW read the key; content scripts never request it; the SW attaches it to outbound requests. For a hackathon demo a better pattern is a small backend proxy (e.g., Cloudflare Worker) so no third-party key ships in the extension; a key bundled in extension files is extractable by anyone.
- **host_permissions** should list only the API origin(s) (e.g. `https://api.anthropic.com/*` or your proxy) plus the two listing sites; content-script `matches` already grants host access to those sites.
- Model output rendered in tooltips/panel: use `textContent` or a vetted markdown renderer that sanitises; never `innerHTML` raw model text (prompt-injection from listing text could otherwise inject markup).

### Code sketch (self-written)
```js
// service-worker.js
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
const LISTING = /^https:\/\/www\.(domain\.com\.au\/[^/?#]+-\d{6,}|realestate\.com\.au\/property-[^/?#]+-\d+)/;
async function syncPanel(tabId, url) {
  const on = !!url && LISTING.test(url);
  await chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: on });
  await chrome.action.setBadgeText({ tabId, text: on ? 'ON' : '' });
}
chrome.tabs.onUpdated.addListener((tabId, info, tab) => { if (info.url || info.status === 'complete') syncPanel(tabId, tab.url); });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'analyse' || typeof msg.text !== 'string' || msg.text.length > 50_000) return; // validate
  (async () => {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    const r = await fetch('https://api.example-llm.com/v1/analyse', {   // origin must be in host_permissions
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ text: msg.text, url: sender.tab?.url })
    });
    sendResponse(await r.json());   // only send back what the content script needs (quotes + labels), never the key
  })().catch(e => sendResponse({ error: String(e) }));
  return true;                       // keep channel open (works on all versions)
});
```

### Gaps
- Not verified whether `storage.setAccessLevel` can restrict `storage.local` (docs summary only confirmed it for `session` default).
- Did not fetch docs on MV3 service-worker lifetime limits for long streaming fetches.

## 7. Activating only on domain.com.au and realestate.com.au listing URLs, plus a toolbar action

### Takeaway
Declare content scripts with `matches` covering the whole of both hosts (because navigation between search results and listings is client-side and content scripts don't re-run on pushState), then gate behaviour in code with a listing-URL regex that is re-evaluated on every route change. Use the toolbar `action` to open the side panel (via `openPanelOnActionClick`), and per-tab `sidePanel.setOptions`/badge to signal when the current page is a supported listing.

### Cited Findings
- `matches` (required) uses match patterns like `https://*.nytimes.com/*`; `exclude_matches` removes URLs; `include_globs`/`exclude_globs` apply looser globs (`*`, `?`) after `matches`; a script runs only if URL matches `matches` and `include_globs` and not the excludes. `all_frames: true` injects into subframes. Dynamic registration via `scripting.registerContentScripts` etc. (Chrome 96+). Programmatic injection needs `scripting` + host permission (manifest or temporary `activeTab`). — [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- Content scripts are not documented to re-run on `history.pushState`; `webNavigation.onHistoryStateUpdated` can be used to detect those navigations. — [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts); [Chrome: webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)
- Side panel can be enabled per tab with `setOptions({tabId, enabled})` based on URL in `tabs.onUpdated`; action click can toggle the panel via `setPanelBehavior({openPanelOnActionClick:true})`. — [Chrome: sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

### Inferences
- Listing URL shapes (from my familiarity, not verified this session): domain.com.au listings are like `https://www.domain.com.au/<address-slug>-<numeric id>`; realestate.com.au buy listings are like `https://www.realestate.com.au/property-<type>-<state>-<suburb>-<numeric id>`. Match patterns cannot express "ends with digits", so gate with a regex in code (or `include_globs` such as `*://www.realestate.com.au/property-*`), but keep `matches` broad so the script is present when the user clicks from search results into a listing client-side.
- Alternative minimal-permission design: no static content scripts; use `activeTab` + `scripting.executeScript` when the user clicks the action. Lower install warnings, but loses automatic activation and SPA-navigation awareness; not a good fit if Lumo should "just work" on listings.
- `tabs.onUpdated` `tab.url` requires the `tabs` permission or host permission for that URL; host permission for the two sites (implied by content-script matches) is sufficient for those tabs.

### Code sketch (self-written)
```json
{
  "manifest_version": 3,
  "name": "Lumo",
  "version": "0.1.0",
  "action": { "default_title": "Open Lumo" },
  "background": { "service_worker": "service-worker.js", "type": "module" },
  "side_panel": { "default_path": "sidepanel.html" },
  "permissions": ["sidePanel", "storage", "webNavigation"],
  "host_permissions": ["https://api.example-llm.com/*"],
  "content_scripts": [{
    "matches": ["https://www.domain.com.au/*", "https://www.realestate.com.au/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "web_accessible_resources": [{
    "resources": ["fonts/*"],
    "matches": ["https://www.domain.com.au/*", "https://www.realestate.com.au/*"]
  }]
}
```
```js
// content.js entry
const isListing = u => /^https:\/\/www\.(domain\.com\.au\/[^/?#]+-\d{6,}|realestate\.com\.au\/property-[^/?#]+-\d+)/.test(u);
function onRoute(url) { teardownMarks(); if (isListing(url)) waitForStableThen(runPipeline); }
onRoute(location.href);
```

### Gaps
- The listing URL regexes above are unverified against live sites; confirm by inspecting real listing URLs (and check whether either site uses iframes for galleries/floorplans, which would need `all_frames`).
- Did not verify the install-time permission warning text for `webNavigation` or the host permissions.
