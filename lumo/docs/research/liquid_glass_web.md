# Recreating Apple's Liquid Glass on the Web (Chrome extension overlay: tooltips, floating pill, side panel)

Scope: Chrome desktop, current (Nov 2026). Safari/Firefox noted only briefly. All code snippets below were written for these notes (not copied); values are drawn from the cited sources unless marked as my own starting points.

## 1. What Liquid Glass consists of, and what Apple's HIG says about using it

### Takeaway
Liquid Glass is a *lensing* material (it bends light at its edges rather than just scattering/blurring it), adapts its tint, shadow and light/dark appearance to the content beneath, and is meant only for a floating "functional layer" (controls/navigation) above content, used sparingly, never stacked glass-on-glass, with color reserved for one emphasized element or status indicators. For a text-heavy overlay (tooltips, side panel), Apple's own guidance points to the **regular** (more frosted, luminosity-adjusted) variant, not the clear one.

### Cited Findings
**Material properties**
- Apple contrasts it with previous materials: "Previous materials focused on scattering light, while liquid glass bends light"; it is described as a material that "bends and shapes light", with rounded forms floating over content and moving "with gel-like flexibility in tandem with interactions." — [WWDC25 "Meet Liquid Glass" notes](https://wwdcnotes.com/documentation/wwdc25-219-meet-liquid-glass/)
- Adaptive behavior: "As text scrolls underneath, shadows become more prominent to create separation"; components can independently flip light/dark; light from nearby colorful content can spill onto the surface. — [WWDC25 notes](https://wwdcnotes.com/documentation/wwdc25-219-meet-liquid-glass/)
- Size-dependent: "Larger elements simulate a thicker more substantial material"; shadows and light scattering increase with size. — [WWDC25 notes](https://wwdcnotes.com/documentation/wwdc25-219-meet-liquid-glass/)
- HIG Color: "By default, Liquid Glass has no inherent color, and instead takes on colors from the content directly behind it." Small elements (toolbars, tab bars) adapt between light and dark appearance in response to underlying content; symbols/text on them are monochromatic, "becoming darker when the underlying content is light, and lighter when it's dark." "Liquid Glass appears more opaque in larger elements like sidebars to preserve legibility over complex backgrounds." — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Specular highlight on the web reconstructions is modeled as a rim light whose intensity depends on the surface normal relative to a fixed light direction (demo default angle −60°). — [kube.io, Liquid Glass in the Browser](https://kube.io/blog/liquid-glass-css-svg)

**Variants**
- *Regular*: "blurs and adjusts the luminosity of background content to maintain legibility of text and other foreground elements … Most system components use this variant. Use the regular variant when background content might create legibility issues, or when components have a significant amount of text, such as alerts, sidebars, or popovers." — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- *Clear*: "highly translucent … Use this variant for components that float above media backgrounds — such as photos and videos." HIG: "Only use clear Liquid Glass for components that appear over visually rich backgrounds." — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- Dimming layer for clear glass: "If the underlying content is bright, consider adding a dark dimming layer of 35% opacity"; not needed when content is already dark. — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- WWDC: Clear has "no adaptive behaviors"; use only when content is media-rich, unharmed by a dimming layer, and bold/bright. "Do not mix the variants." — [WWDC25 notes](https://wwdcnotes.com/documentation/wwdc25-219-meet-liquid-glass/)

**Usage rules**
- Liquid Glass "forms a distinct functional layer for controls and navigation elements … that floats above the content layer." — [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- "Don't use Liquid Glass in the content layer" (exception: transient controls like sliders/toggles while active). — [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- "Use Liquid Glass effects sparingly … overusing this material in multiple custom controls can provide a subpar user experience … Limit these effects to the most important functional elements." — [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- "Avoid stacking glass on glass." "When placing elements on top of Liquid Glass use fills and transparency for visual separation." — [WWDC25 notes](https://wwdcnotes.com/documentation/wwdc25-219-meet-liquid-glass/)
- Variant appearance changes with system settings that "reduce transparency or increase contrast." — [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- Standard materials guidance: "Thicker materials, which are more opaque, can provide better contrast for text and other elements with fine features. Thinner materials … help people retain their context." Use "vibrant colors on top of materials" for legibility; avoid lowest-contrast (quaternary) labels on thin/ultraThin materials. — [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)

**Tinting (HIG Color, "Liquid Glass color", updated Dec 16 2025)**
- Color gives "the appearance of colored or stained glass … useful for drawing emphasis to a specific control, like a primary call to action." — [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- "Apply color sparingly … reserve it for elements that truly benefit from emphasis, such as status indicators or primary actions. To emphasize primary actions, apply color to the background rather than to symbols or text … Refrain from adding color to the background of multiple controls." — [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- WWDC: "Tints should only be used to bring emphasis to primary elements." — [WWDC25 notes](https://wwdcnotes.com/documentation/wwdc25-219-meet-liquid-glass/)
- Over colorful backgrounds, "prefer a monochromatic appearance" for controls or an accent with sufficient differentiation. — [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- "Avoid relying solely on color to differentiate … provide the same information in alternative ways … text labels or glyph shapes." Red means danger in some cultures but positive in others (e.g. Chinese stock charts). — [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Custom colors should supply light, dark, and increased-contrast variants. System reference values (light / dark / increased-contrast light / increased-contrast dark): Red 255,56,60 / 255,66,69 / 233,21,45 / 255,97,101; Orange 255,141,40 / 255,146,48 / 197,83,0 / 255,160,86; Yellow 255,204,0 / 255,214,0 / 161,106,0 / 254,223,67; Green 52,199,89 / 48,209,88 / 0,137,50 / 74,217,104. HIG says not to hard-code these in native apps (they shift between releases), but they are useful design references. — [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Note: Apple added a user-facing "Tinted" (more opaque) Liquid Glass option in iOS 26.1 after legibility complaints — reported by [Gulf News](https://gulfnews.com/technology/companies/apple-yields-tinted-control-in-ios-261-beta-4-tones-down-liquid-glass-after-backlash-1.500315176) (search snippet only; not fetched). The HIG also references people choosing "a preferred look for Liquid Glass in their device's settings" — [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md).

### Inferences
- For an extension overlay sitting on arbitrary pages (unknown, often text-heavy, often white backgrounds), the right analogue is the **regular** variant: noticeable blur + luminosity normalization + a fairly opaque fill, especially for the side panel ("more opaque in larger elements"). Reserve "clear" lensing for the small pill only.
- Map Apple's rules onto the three surfaces: side panel = thickest/most opaque; tooltips = medium; pill = thinnest with the most visible lensing/specular. Don't put a glass button inside the glass panel; use flat translucent fills inside it ("no glass on glass").
- Semantic tints (problem/check/good) qualify as "status indicators," which the HIG explicitly allows, but should appear on one element at a time and always be paired with an icon/label.

### Gaps
- Apple publishes no numeric parameters (blur radius, IOR, tint opacity) for Liquid Glass; all web values below are community reverse-engineering.
- The HIG Accessibility page was not fetched; specifics of how Reduce Transparency/Increase Contrast change glass rendering come only from the general statements above.
- WWDC session "Get to know the new design system" (356) transcript was not fetched.

## 2. Web techniques: recipes, parameters and what works in Chrome today

### Takeaway
Build it in three tiers: (1) an opaque/near-opaque fallback; (2) "frosted" glass with `backdrop-filter: blur() saturate()` plus a translucent fill, a 1px light border and an inset top highlight (works in every modern browser); (3) Chromium-only true refraction via `backdrop-filter: url(#svgFilter)` with an `feImage` displacement map into `feDisplacementMap`. The biggest gotchas for an extension are the "Backdrop Root" rule (any ancestor with filter/opacity<1/mask/clip-path/backdrop-filter/mix-blend-mode cuts off what you can sample), that `@supports` can't detect the url() variant, and that SVG refraction maps must match element size.

### Cited Findings
**Frosted base values (community recipes)**
- Base: background `rgba(255,255,255,0.12)`, `backdrop-filter: blur(16px) saturate(180%)`, border `1px solid rgba(255,255,255,0.28)` with top border `rgba(255,255,255,0.55)`, radius 24px, `box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 12px 40px rgba(0,0,0,0.35)`. Workable ranges: blur 12–30px, saturate 140–200%. — [buildmvpfast, backdrop-filter recipes 2026](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026)
- Alternative card: `blur(16px) saturate(180%)`, `rgba(255,255,255,0.08)` fill, `1px solid rgba(255,255,255,0.12)` border, `0 8px 32px rgba(0,0,0,0.2)` shadow; saturation is "the whole trick" because blur drains color. — [devyatov, 6 ways (DEV)](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)
- Josh Comeau: main backdrop `blur(16px)` (12px for calmer); `blur(8px) brightness(90%) saturate(140%)` example; saturation reduces blur muddiness; glassy edge as a 3–6px masked strip with `hsl(0 0% 100% / 0.1)` and `blur(12px) brightness(0.96)`; tint `hsl(0 0% 100% / 0.5–0.6)`. — [Josh W. Comeau, Next-level frosted glass](https://www.joshwcomeau.com/css/backdrop-filter/)
- `backdrop-filter` only samples pixels directly behind the element; to get realistic bleed, put it on an oversized absolutely-positioned child (e.g. `height: 200%`) and clip with `overflow: hidden` (works correctly in **Chrome 142+**, which fixed an ordering bug) or with `mask-image` + `pointer-events: none` for older versions. — [Josh W. Comeau](https://www.joshwcomeau.com/css/backdrop-filter/)
- Spec: when the filter list includes `blur()`, edges use `edgeMode="mirror"` based on the element's clipped, transformed border box. — [CSSWG Filter Effects Level 2](https://drafts.csswg.org/filter-effects-2/)

**Refraction via SVG `backdrop-filter: url()`**
- "Chromium-based browsers (Chrome, Edge, Brave, and others) currently support using SVG filters as inputs for `backdrop-filter`"; Safari and Firefox do not. — [LogRocket](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/); same conclusion in [kube.io](https://kube.io/blog/liquid-glass-css-svg) and [ekino/Medium](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)
- `@supports` reports success in Safari for the url() form even though nothing renders, so engine detection is needed. — [devyatov (DEV)](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)
- Displacement encoding: channel value 128 = no shift; 0 → −1, 255 → +1, multiplied by `scale`; solid `#808080` = no displacement. — [ekino/Medium](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d); 8-bit gives roughly −128..127 px range at scale. — [kube.io](https://kube.io/blog/liquid-glass-css-svg)
- LogRocket button (300×56, radius 60px) filter chain: `feGaussianBlur stdDeviation=1` → `feImage` (displacement map sized to element) → `feDisplacementMap scale=55 R/G` → `feColorMatrix saturate` → second `feImage` specular rim (1–few px stroke at ~50% opacity) blurred `stdDeviation=1`, `feComposite in`, `feBlend normal`; CSS `backdrop-filter: url(#liquid-glass-button) brightness(150%)`, fill `hsl(0 100% 100% / 15%)`. Displacement map designed as stacked rounded rects with blur starting ~32px and decreasing inward. — [LogRocket](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)
- Physically-based approach: Snell's law with n=1.5, surface profile "convex squircle" y = (1−(1−x)⁴)^(1/4) preferred for smooth gradients; displacement computed along one radius (~127 samples) and rotated; vector encoded R=128+x·127, G=128+y·127; `scale` = max displacement and can be animated without rebuilding the map; specular rim rendered as a separate `feImage` blended in. Reported per-component values, e.g. Searchbox: specular opacity 0.20, specular saturation 4, refraction level 0.70, blur 1.0; Slider: 0.40/7/1.0/0. Map must be rebuilt on any size/shape change; filter image must match element dimensions. — [kube.io](https://kube.io/blog/liquid-glass-css-svg)
- Simpler noise-based variants: `feTurbulence type=turbulence baseFrequency=0.05 numOctaves=2` → `feDisplacementMap scale=20` (ekino); backdrop variant `baseFrequency=0.012 numOctaves=3 seed=2`, filter region −20%/140%, element overscan `inset:-20px` to avoid transparent gutters. — [ekino/Medium](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d); [devyatov (DEV)](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)
- Combined refraction + frost: `backdrop-filter: url(#lens) blur(2px) saturate(160%)` with `feDisplacementMap scale=60`. — [buildmvpfast](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026)
- SVG displacement lacks super-sampling and looks pixelated; blur softens but doesn't fully fix it. — [ekino/Medium](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)
- Generate unique filter IDs per instance. — [devyatov (DEV)](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)
- Safari-only native: `-apple-visual-effect: -apple-system-glass-material` (iOS 26 Safari only). — [devyatov (DEV)](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)

**Backdrop Root (the main stacking gotcha)**
- A Backdrop Root is formed by: the root element; an element with `filter` ≠ none; `opacity` < 1; `mask`, `mask-image`, `mask-border` or `clip-path` ≠ none; `backdrop-filter` ≠ none; `mix-blend-mode` ≠ normal; or `will-change` naming any of those. The backdrop only includes content up to the nearest Backdrop Root. (Spec notes this lacks full WG consensus.) — [CSSWG Filter Effects Level 2](https://drafts.csswg.org/filter-effects-2/)
- Rationale: only the nearest ancestor render surface needs readback, avoiding extra rasterization; Chromium shipped backdrop-filter in M76. — [mfreed7 backdrop-filter explainer](https://github.com/mfreed7/backdrop-filter-feature)
- `transform` is **not** in the Backdrop Root list. — [CSSWG Filter Effects Level 2](https://drafts.csswg.org/filter-effects-2/)

**Escaping host-page stacking for the overlay**
- Popovers are placed in the top layer and "will sit on top of all other page content"; `popover="manual"` allows multiple simultaneous independent popovers and no light-dismiss; `popover="hint"` is designed for tooltips (falls back to manual). UA styles to reset: `position: fixed; inset: 0; margin: auto; border: solid; padding: .25em; overflow: auto; color: CanvasText; background-color: Canvas`. Popover invokers become implicit anchors for CSS anchor positioning (`position-area`, or `position-anchor: auto` with `anchor()`); set `margin: 0` when using `anchor()`. — [MDN: Using the Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using)
- Shadow DOM tooltips: can reuse host-page fonts (no FOUT, unlike iframes); host-page rules like broad `all: initial` can still leak in some cases, so explicitly set every needed property on the shadow container. — [palo_alto_ai (DEV)](https://dev.to/palo_alto_ai/shadow-dom-vs-iframe-for-browser-extension-tooltips-a-build-note-33c5)

### Recipes (written for these notes)

Tokens + frosted tier (works everywhere; this is the default render path):
```css
:host { all: initial; }            /* reset inherited host styles, then set everything */
.glass {
  --fill: rgb(255 255 255 / .55);  /* regular variant over unknown pages: start opaque-ish */
  --rim:  rgb(255 255 255 / .55);
  --edge: rgb(255 255 255 / .22);
  position: relative; isolation: isolate;
  border-radius: 18px;
  background: var(--fill);
  backdrop-filter: blur(16px) saturate(170%);
  border: 1px solid var(--edge);
  box-shadow:
    inset 0 1px 0 var(--rim),                 /* top specular line */
    inset 0 -1px 0 rgb(255 255 255 / .08),    /* faint bottom catch-light */
    inset 0 0 0 .5px rgb(255 255 255 / .18),  /* hairline inner rim */
    0 1px 2px rgb(0 0 0 / .08),
    0 10px 30px rgb(0 0 0 / .18);             /* lift; scale with element size */
}
/* gradient specular rim on a pseudo element (masked to the border ring) */
.glass::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
  background: linear-gradient(160deg, rgb(255 255 255 / .7), rgb(255 255 255 / 0) 40%,
                                      rgb(255 255 255 / 0) 60%, rgb(255 255 255 / .25));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none;
}
```
Note: putting `mask` on `::before` is fine; putting `mask`, `opacity<1` or `filter` on the `.glass` element's *ancestors* would make them Backdrop Roots and empty the blur.

Dark-page variant (luminosity adaptation, approximating "regular" glass):
```css
.glass[data-tone="dark"] {
  --fill: rgb(28 28 32 / .55);
  --rim:  rgb(255 255 255 / .22);
  --edge: rgb(255 255 255 / .10);
  color: #f5f5f7;
}
```
(Detect tone in JS by sampling the computed background color of `document.elementFromPoint()` under the overlay, or of `body`; this is my suggestion, not from a source.)

Chromium refraction tier (pill only):
```html
<svg width="0" height="0" style="position:absolute">
  <filter id="lumo-lens-1" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feImage href="data:image/png;base64,..." x="0" y="0" width="160" height="40" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="40"
                       xChannelSelector="R" yChannelSelector="G" result="bent"/>
    <feGaussianBlur in="bent" stdDeviation="1.5"/>
  </filter>
</svg>
```
```css
.pill.lens { backdrop-filter: url(#lumo-lens-1) saturate(160%) brightness(1.05); }
```
Generate the map on an OffscreenCanvas at the pill's exact pixel size (×devicePixelRatio), neutral 128,128 in the flat center and outward-pointing vectors only within a ~8–12px bezel (squircle profile), then set as data URL. Regenerate only on resize; animate `scale` for press/hover. Gate this tier on `navigator.userAgentData?.brands` containing Chromium, not `@supports`.

### Inferences
- The url() filter is referenced by ID; inside a content-script Shadow DOM, the `<svg><filter>` must live in the same tree scope as the element that references it (put it inside the shadow root). I could not find a source confirming cross-shadow-root url() resolution behavior; test it.
- Because the overlay sits in its own top-level shadow host appended to `<html>`/`<body>`, host-page ancestor Backdrop Roots are mostly avoided. Risk remains if the host sets `filter`/`opacity` on `body` or `html` (e.g. dark-mode extensions that use `filter: invert()` on `html`) — then the overlay's blur will only see content inside that root or nothing. Appending the host as a child of `document.documentElement` (not `body`) and using `popover="manual"` (top layer) is the most robust placement.
- Top layer + `popover="manual"` removes the need for `z-index: 2147483647` wars, and tooltips can use `popover="hint"` with anchor positioning in current Chrome.
- Transformed parents don't create Backdrop Roots per spec, so animating the pill with `transform` is safe; animating `opacity` on the glass element itself (making it its own root) is fine, but don't fade a *wrapper* that contains the glass, as that wrapper becomes a Backdrop Root mid-animation.
- Nested glass inside the side panel (glass card on glass panel) would only sample the panel's own content, since the panel's `backdrop-filter` is a Backdrop Root — another reason to follow "no glass on glass."

### Gaps
- No primary Chrome/Chromium doc confirming `backdrop-filter: url()` status beyond community articles (all agree it is Chromium-only as of 2025–2026).
- No authoritative source found for backdrop-filter behavior across Shadow DOM boundaries or for `url()` references to filters in a different tree scope.
- Firefox note (out of scope): a sticky+overflow+border-radius backdrop-filter bug was fixed in Nightly Sept 2026 per [Josh W. Comeau](https://www.joshwcomeau.com/css/backdrop-filter/).

## 3. Performance: cost and how to keep 60fps

### Takeaway
Backdrop blur is a readback + filter + composite pass every frame the backdrop changes (i.e. every scroll frame), so cost scales with blurred area, blur radius, and number of glass layers; static glass over static content costs ~nothing. Keep glass to a few small surfaces, keep blur moderate (<~20px on large panels), never animate the blur radius, and reserve SVG refraction for the small pill.

### Cited Findings
- Rendering pipeline: read back backdrop, apply filters, clip to rounded border rect, draw, then render element content; "can be very performance-demanding", which is why no fast polyfill exists. — [mfreed7 explainer](https://github.com/mfreed7/backdrop-filter-feature)
- Each SVG filter instance reserves GPU/compositing resources; complex filters on many/large elements cause frame drops or scroll jank; limit to a few floating elements. — [LogRocket](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)
- Blur samples many neighbors (heavy); displacement is a single lookup per pixel (much cheaper). — [ekino/Medium](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)
- "Static blur over a static page costs nothing measurable"; blur over scrolling content recomputes every scroll frame; stacked layers multiply cost; 20 full-screen layers on a mid-range Android was very costly, 7 fine for a small header; WebGL alternative capped at 30fps and paused off-screen. — [devyatov (DEV)](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)
- Keep blur under ~20px on large surfaces; max 3–4 glass layers per viewport; animate `opacity` not blur radius (blur animation reported to drop phones to ~30fps); use `will-change` sparingly. — [buildmvpfast](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026)
- Cost grows with radius (more samples) and with area (full-width sticky headers recalc across millions of pixels per scroll frame); avoid nested blurs (raise one radius instead); profile with DevTools Layers panel. Claim that one `blur(10px)` can "triple compositor workload" is unmeasured. — [loke.dev](https://loke-dev-lokedevs-projects.vercel.app/blog/css-filter-blur-performance-bottlenecks) (lower-quality source; no benchmarks)
- Refraction maps must be rebuilt on any size/shape change; only animating filter attributes like `scale` avoids rebuild. — [kube.io](https://kube.io/blog/liquid-glass-css-svg)
- A real-world PR removed backdrop-blur behind a sticky header specifically to fix scroll jank. — [GitHub lightnode PR #175](https://github.com/marinom2/lightnode/pull/175) (search snippet only)

### Inferences
- Budget for the overlay: side panel (largest area) = frosted only, blur 12–16px, fairly opaque fill so a lower blur still reads well; tooltips = frosted, small area, cheap; pill = the only place for url() refraction. That's ≤3 backdrop passes on screen, within the "3–4 layers" guidance.
- Multiple simultaneous highlights on the page (e.g. marking many "problem/check/good" spans) should NOT each get backdrop-filter; use plain tinted backgrounds/outlines/underlines for in-page marks and keep glass for the floating chrome. This also follows HIG "don't use glass in the content layer."
- For resize-heavy elements (side panel resizing), drop refraction entirely and avoid map regeneration; for tooltips that change size per content, either use frosted only or quantize sizes.
- During scroll, consider temporarily lowering blur via a class swap (not a transition) or relying on the more-opaque fill; and hide/destroy tooltips when off-screen.

### Gaps
- No rigorous benchmarks (ms/frame vs. area/radius) for Chrome 2026 desktop were found; all numbers are anecdotal.

## 4. Accessibility: reduced transparency, contrast, motion, legibility over unknown backgrounds

### Takeaway
Ship opaque-first, then layer glass under `@media (prefers-reduced-transparency: no-preference)` (Chrome 118+); strengthen borders/opacity under `prefers-contrast: more`; freeze any animated refraction/specular under `prefers-reduced-motion`; and guarantee ≥4.5:1 text contrast by putting a semi-solid layer under text and testing against the worst-case (brightest/busiest) backdrop, since the page behind is unknown.

### Cited Findings
- `prefers-reduced-transparency` ships in Chrome 118 / Edge 118; Firefox behind a flag; Safari unsupported. OSs (Windows, macOS, iOS) have settings to reduce transparency. Recommended "additive" strategy: build a solid baseline, add transparency under `no-preference`. DevTools Rendering tab can emulate it. Pair with `prefers-reduced-motion`. — [Chrome for Developers: CSS prefers-reduced-transparency](https://developer.chrome.com/blog/css-prefers-reduced-transparency)
- Fallback ladder: opaque `rgba(22,25,40,0.85–0.92)` default → frosted glass behind `@supports` and `prefers-reduced-transparency: no-preference` → refraction gated by UA; `@media (prefers-contrast: more)` adds `border: 2px solid currentColor`; minimum text contrast 4.5:1 (an early iOS 26 screen measured ~1.5:1). Don't use glass for data-dense tables or text areas without a semi-solid layer; test against worst-case backdrop. — [buildmvpfast](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026)
- "Legibility is a bigger problem than rendering: test against the brightest background the panel can cross"; honor `prefers-reduced-motion` for animated distortion. — [devyatov (DEV)](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)
- Unsupported-browser fallback via `@supports`: opaque `hsl(0 0% 100% / 0.95)`. — [Josh W. Comeau](https://www.joshwcomeau.com/css/backdrop-filter/)
- Apple: regular variant blurs and adjusts luminosity to maintain legibility and should be used for text-heavy components; supply increased-contrast color variants; don't rely on color alone. — [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md); [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Apple: for clear glass over bright content, a 35% dark dimming layer. — [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)

### Recipe (written for these notes)
```css
/* 1. opaque baseline */
.glass { background: rgb(250 250 252 / .97); border: 1px solid rgb(0 0 0 / .12); }

/* 2. glass only when the user hasn't asked for less transparency and it's supported */
@supports (backdrop-filter: blur(1px)) {
  @media (prefers-reduced-transparency: no-preference) {
    .glass { background: rgb(255 255 255 / .58); backdrop-filter: blur(16px) saturate(170%); }
  }
}

/* 3. higher contrast */
@media (prefers-contrast: more) {
  .glass { background: rgb(255 255 255 / .94); border: 1.5px solid rgb(0 0 0 / .6);
           backdrop-filter: none; }
  .glass * { text-shadow: none; }
}

/* 4. Windows high-contrast / forced colors: let system colors win */
@media (forced-colors: active) {
  .glass { background: Canvas; color: CanvasText; border: 1px solid CanvasText;
           backdrop-filter: none; box-shadow: none; }
}

/* 5. motion */
@media (prefers-reduced-motion: reduce) {
  .glass, .glass * { transition: none !important; animation: none !important; }
  /* also skip JS-driven scale/specular animation */
}
```

### Inferences
- Over unknown pages, contrast can't be computed reliably from CSS. Practical guarantee: make the fill opaque enough that text contrast holds even over pure black *and* pure white. E.g. dark text (#1d1d1f) on a white fill at ≥ ~0.55 alpha over a black backdrop composites to roughly rgb(140,140,140) — about 5:1 with #1d1d1f by my rough calculation; verify with a contrast checker. Lower alphas need either the dark-tone switch or a heavier blur+brightness.
- WCAG thresholds to target (standard WCAG 2.x values, not fetched this session): 4.5:1 body text, 3:1 large text and non-text UI (icons, focus rings, borders conveying state).
- `prefers-contrast` and `forced-colors` are supported in current Chrome (general knowledge; not verified in a fetched source this session).
- Add `text-shadow: 0 0 1px rgb(255 255 255 / .6)` (light mode) only as polish, never as the contrast mechanism.

### Gaps
- Apple HIG Accessibility page not fetched; exact Apple behavior under Reduce Transparency (e.g. glass becomes fully opaque) is not cited here.
- No source found with a validated algorithm for live backdrop luminance sampling in extensions (pixels behind cross-origin iframes/images can't be read).

## 5. Semantic tinting (problem / check / good) in a refined, non-neon way

### Takeaway
Follow Apple's "stained glass" approach: keep the glass neutral and put low-alpha color in the fill plus a slightly stronger colored rim/inner glow, use the darker "increased contrast" versions of system red/orange/green for text and icons, apply color to one surface at a time, and always pair with a glyph + label.

### Cited Findings
- Colored Liquid Glass gives "the appearance of colored or stained glass"; reserve for "status indicators or primary actions"; apply emphasis color to the background rather than text; don't tint multiple controls' backgrounds. — [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Color must not be the only signal; use labels or glyph shapes; color meanings vary by culture. — [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Reference RGBs (default light → increased-contrast light; dark → increased-contrast dark): Red 255,56,60 → 233,21,45; 255,66,69 → 255,97,101. Orange 255,141,40 → 197,83,0; 255,146,48 → 255,160,86. Yellow 255,204,0 → 161,106,0; 255,214,0 → 254,223,67. Green 52,199,89 → 0,137,50; 48,209,88 → 74,217,104. — [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- In the HIG increased-contrast example, the tinted glass button's label switches from white to black and the yellow is darkened for contrast. — [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)

### Recipe (my own starting values, derived from the above)
```css
.glass[data-state] {
  /* tint = semantic hue; fill mixes a little of it into the neutral glass */
  background: color-mix(in oklab, var(--tint) 10%, var(--fill));
  box-shadow:
    inset 0 1px 0 var(--rim),
    inset 0 0 0 1px color-mix(in oklab, var(--tint) 35%, transparent),   /* colored rim */
    inset 0 0 18px  color-mix(in oklab, var(--tint) 14%, transparent),   /* soft inner glow */
    0 10px 30px rgb(0 0 0 / .16);
}
.glass[data-state] .status-icon,
.glass[data-state] .status-label { color: var(--ink); }   /* darker shade for legibility */

.glass[data-state="problem"] { --tint: rgb(255 56 60);  --ink: rgb(196 20 40); }
.glass[data-state="check"]   { --tint: rgb(255 141 40); --ink: rgb(160 72 0); }   /* amber via orange, not yellow */
.glass[data-state="good"]    { --tint: rgb(52 199 89);  --ink: rgb(0 120 45); }

/* dark pages: lighter inks */
.glass[data-tone="dark"][data-state="problem"] { --ink: rgb(255 97 101); }
.glass[data-tone="dark"][data-state="check"]   { --ink: rgb(255 160 86); }
.glass[data-tone="dark"][data-state="good"]    { --ink: rgb(74 217 104); }

@media (prefers-contrast: more) {
  .glass[data-state] { box-shadow: inset 0 0 0 2px var(--ink); }
}
```
In-page marks (not glass): e.g. a 2px underline in `--ink` + a 8–12% `--tint` background wash, plus a small glyph (✕ / ! / ✓ as SVG icons) so it works without color.

### Inferences
- "Non-neon" mainly comes from (a) low alpha (8–14%) for fills, (b) using OKLab `color-mix` so tints don't go muddy or oversaturated, (c) keeping saturation from the backdrop filter moderate (≤170%) on tinted surfaces since `saturate()` amplifies the tint, and (d) avoiding outer colored glows (outer glow reads as neon; inner glow/rim reads as stained glass).
- Amber should derive from system orange (darker IC value 197,83,0 or ~160,72,0 for text) rather than yellow; yellow text fails contrast on light glass (Apple's own IC light yellow is 161,106,0).
- Only one tinted glass surface at a time (e.g. the pill reflects overall page status); the side panel lists items with small tinted chips (flat fills, not glass) per HIG "no glass on glass" and "don't tint multiple controls."
- Red/green alone is a problem for the most common color-vision deficiencies; shape-distinct icons and words ("Problem", "Check", "Looks good") are required, matching HIG.

### Gaps
- The specific tint alphas/glow sizes above are my starting points, not sourced values; tune visually on light, dark and photo-heavy pages.
- Contrast of the suggested `--ink` shades against tinted glass over worst-case backdrops was not measured.
