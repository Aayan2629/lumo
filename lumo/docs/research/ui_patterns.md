# UI patterns for a minimal Apple-style glass overlay (Chrome extension)

Scope: a floating verdict pill ("2 issues"), hover tooltips on highlighted phrases, an expandable side panel with red/amber/green checks, a compact AI chat with suggested-question chips, and an onboarding/settings screen. The overlay runs in desktop Chrome on top of third-party pages. Researched 2026-11-05.

Source access notes (for the report writer):
- Apple HIG pages render only with JavaScript. The `.md` variants (e.g. `.../popovers.md`) return the full text and are what was used here. The pages carry a 2026 copyright, and change logs run to March 2026 (Sheets) and December 2025 (Color).
- Mobbin, UI8 UI Kitchen and OriginKit's /components page returned client errors to the fetcher, so I could not inspect their contents. Mobbin's pricing page was readable.
- React Bits, Aura UI and OriginKit home pages give only top-level information. Individual component parameters (durations, radii) were not visible without opening each demo. I did not copy any library code.

---

## 1. What does Apple HIG recommend for popovers/tooltips, sheets/side panels, materials, semantic colours, SF-style typography and minimal copy?

### Takeaway
HIG wants transient, small, single-instance popovers that point at their source and close on an outside click. Use a nonmodal panel, not a modal sheet, for persistent supporting info. Liquid Glass belongs only on the floating control layer and should be used sparingly, with the "regular" variant wherever there is real text. Colour should be rare, semantic and never the only signal. Text should use a few SF weights at 13 pt body on macOS and never below 10 pt. Together these map almost one-to-one onto pill → tooltip → panel.

### Cited Findings

**Popovers (→ hover tooltips, the expanded pill)**
- A popover is "a transient view that appears above other content when people click or tap a control or interactive area." Use it "to expose a small amount of information or functionality" and limit it to a few related tasks. — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)
- The arrow should point "as directly as possible to the element that revealed it". Ideally the popover doesn't cover that element or any essential content. — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)
- Show one popover at a time. Never show a cascade or hierarchy of popovers, and nothing should display on top of one except an alert. — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)
- Close it with an outside click or by selecting an item. Add a Close/Cancel/Done button only when it adds clarity. Always save work when a nonmodal popover closes automatically. — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)
- Let people close one popover and open another with a single click. — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)
- "Avoid making a popover too big": make it only big enough for its content. When a popover switches between condensed and expanded views, animate the size change "to avoid giving the impression that a new popover replaced the old one." — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)
- "Avoid using a popover to show a warning", because people can miss or accidentally close it. Use an alert instead. — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)
- On macOS a popover can be detached so it becomes a panel that stays visible. Keep appearance changes to the detached version minimal so people keep their context. — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)

**Sheets and panels (→ side panel, onboarding)**
- A sheet is for "a scoped task that's closely related to their current context". On macOS it is always modal and dims the parent window. — [Apple HIG: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets.md)
- For "supplementary items that affect the main task in the parent view", use a nonmodal view: a panel on macOS or a nonmodal sheet on iOS. "Use a panel instead of a sheet if people need to repeatedly provide input and observe results." — [Apple HIG: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets.md)
- Display only one sheet at a time. Pair Done with Cancel or Back, and avoid showing Cancel, Done and Back together. — [Apple HIG: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets.md)
- On iPhone, the medium detent (about half height) supports progressive disclosure, with the most relevant items visible without resizing. Resizable sheets should have a grabber. — [Apple HIG: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets.md)
- For complex or long flows, consider alternatives to sheets, such as a separate window on macOS. — [Apple HIG: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets.md)

**Materials and Liquid Glass**
- Liquid Glass "forms a distinct functional layer for controls and navigation elements... that floats above the content layer." "Don't use Liquid Glass in the content layer." — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- "Use Liquid Glass effects sparingly." Limit it to the most important functional elements, because overuse distracts from the content underneath. — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- The *regular* variant blurs and adjusts the luminosity of what's behind it. Use it "when components have a significant amount of text, such as alerts, sidebars, or popovers." The *clear* variant is highly translucent and is only for components over visually rich media. — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- If clear glass sits over bright content, "consider adding a dark dimming layer of 35% opacity." — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- Glass appearance changes with system settings such as reduced transparency and increased contrast. — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- Use vibrant label colours on materials. Avoid the quaternary label level on thin and ultra-thin materials because the contrast is too low. Thicker materials give better contrast for fine text, and thinner ones preserve context. — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md)
- Liquid Glass "appears more opaque in larger elements like sidebars to preserve legibility." On small elements, symbols and text flip between dark and light according to the content underneath. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)

**Colour**
- Liquid Glass "has no inherent color" by default. Apply colour sparingly and reserve it for "status indicators or primary actions." To emphasise a primary action, tint the background rather than the label, and "refrain from adding color to the background of multiple controls." — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Don't rely solely on colour to communicate essential information. Pair it with text labels or glyph shapes. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Don't use the same colour to mean different things. Provide light, dark and increased-contrast variants for every custom colour. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Colour meanings vary by culture. For example, red can be positive, as in rising Chinese stock charts. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- Use semantic foreground tokens (label, secondary label, tertiary label, quaternary label, separator, link) by purpose, not by how they look. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
- System status colours, in sRGB. Apple says to treat these as reference values and not hard-code them, because they change between releases. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color.md)
  - Red: light 255,56,60 · dark 255,66,69 · increased contrast (IC) light 233,21,45 · IC dark 255,97,101
  - Orange: light 255,141,40 · dark 255,146,48 · IC light 197,83,0 · IC dark 255,160,86
  - Yellow: light 255,204,0 · dark 255,214,0 · IC light 161,106,0 · IC dark 254,223,67
  - Green: light 52,199,89 · dark 48,209,88 · IC light 0,137,50 · IC dark 74,217,104
  - Blue (accent): light 0,136,255 · dark 0,145,255
  - Gray ramp (iOS, light → dark): systemGray 142,142,147; Gray6 242,242,247 (light) / 28,28,30 (dark)

**Typography**
- Default and minimum text sizes: macOS 13 pt / 10 pt; iOS 17 pt / 11 pt. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography.md)
- "In general, avoid light font weights." Prefer Regular, Medium, Semibold or Bold. Use as few typefaces as possible. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography.md)
- macOS text styles (weight / size / line height, in pt): Large Title Regular 26/32; Title 1 Regular 22/26; Title 2 Regular 17/22; Title 3 Regular 15/20; Headline Bold 13/16; Body Regular 13/16; Callout Regular 12/15; Subheadline Regular 11/14; Footnote Regular 10/13; Caption 1 Regular 10/13; Caption 2 Medium 10/13. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography.md)
- iOS Dynamic Type "Medium" sizes: Body 16/21, Headline Semibold 16/21, Subhead 14/19, Footnote 12/16, Caption 11/13. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography.md)
- The system font sets tracking per point size. macOS tracking values: 10 pt +0.12, 11 pt +0.06, 12 pt 0, 13 pt −0.08, 14 pt −0.15, 15 pt −0.23, 17 pt −0.43, 20 pt −0.45, 22 pt −0.26, 24 pt +0.07. Small text is tracked looser and mid-size text tighter. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography.md)
- SF supports dynamic optical sizes, interpolating between Text and Display designs according to point size. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography.md)
- If text needs three or more lines, avoid tight leading even where height is limited. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography.md)

**Minimal copy**
- Don't use the word "popover" in help text. Refer to the specific task or selection instead. — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)
- Keep feedback "brief and precise" so it feels "lightweight and unobtrusive". — [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)

### Inferences
- **Verdict pill = control-layer glass.** The pill is the one element that should look like Liquid Glass: the regular variant, a neutral untinted body, and colour carried only by a small status dot or glyph next to the count. That follows "tint only status/primary". Example: a 6–8 px dot plus "2 issues" in Body 13 pt Semibold.
- **Tooltips = small popovers.** One at a time, anchored with an arrow or caret, never covering the highlighted phrase, and no close button. Moving to the next highlight should swap the tooltip in a single motion rather than close one and open another. Give a tooltip a heading of about 5 words plus one or two lines of 12–13 pt text, nothing more.
- **Side panel = macOS-style nonmodal panel, not a modal sheet.** Don't dim the page. The panel can be more opaque than the pill, matching HIG's "larger glass elements become more opaque for legibility". The pill → panel expansion should be an animated resize so it reads as the same object growing.
- **Red/amber/green checks:** always pair colour with a glyph shape (for example ✕ / ! / ✓ drawn as SF-style symbols, not emoji) and a word. Use the IC colour variants when the page or OS asks for more contrast (`prefers-contrast: more`). Amber should come from systemOrange rather than systemYellow, because yellow text and glyphs on light glass fail contrast. Even IC yellow is a dark ochre, 161,106,0.
- **Warnings that matter** (for example "this page asks for your password on a lookalike domain") should not live only in a hover tooltip, per the "don't use a popover for a warning" rule. They should appear in the pill or panel itself.
- **Web type mapping:** use `font-family: system-ui, -apple-system, "SF Pro Text", "Segoe UI", sans-serif`, which gives SF on macOS. Suggested scale for a desktop overlay: 11 (caption/metadata), 12 (secondary), 13 (body/default), 15 (panel title), 17 (onboarding headline). Weights: 400, 510/590 (SF variable medium/semibold) and 700. Use tracking only at 11 px (+0.06 px) and 15–17 px (−0.2 to −0.4 px).

### Gaps
- I did not fetch HIG pages for "Panels", "Help tags/Tooltips (macOS)" or "Writing". They would give explicit tooltip timing and copy-length rules for macOS help tags.
- HIG gives no web-specific glass parameters such as blur radius or saturation. CSS values for those are inferences (see Q4).

---

## 2. Which components/effects in React Bits, Aura UI, OriginKit, Uiverse and StringTune fit a "liquid glass, no emoji, little text" overlay, and which are gimmicky?

### Takeaway
React Bits is the richest and best-documented source, but its licence is MIT + Commons Clause. Uiverse is plain MIT. StringTune is a lightweight attribute-driven effects library whose licence I couldn't confirm. Aura UI and OriginKit are mostly marketing-site section libraries with little that fits a small overlay. The usable effects are restrained micro-interactions: text reveal on the verdict, a shimmer for loading, a subtle spotlight or border sheen on hover, a gentle magnetic pull on the pill. WebGL backgrounds, particle and "ballpit" toys, metallic and chrome fills and full-page smooth scrolling should be avoided, especially when injected into someone else's page.

### Cited Findings

**React Bits (reactbits.dev)**
- It describes itself as "Free, open source React components" in five categories: Text Animations, Animations, Components, Backgrounds and Micro Interactions. Each comes in JS or TS, with plain CSS or Tailwind. — [React Bits](https://reactbits.dev)
- Licence: **MIT + Commons Clause**, described as "free for personal and commercial use". About 216 items: 33 text animations, 38 animations, 48 components, 34 micro-interactions and 63 backgrounds. — [React Bits GitHub](https://github.com/DavidHDev/react-bits)
- Install by copying the code, with `npx shadcn@latest add @react-bits/<Name>-TS-TW`, or with jsrepo. — [React Bits GitHub](https://github.com/DavidHDev/react-bits)
- Showcased items include Split Text, Fluid Glass, Liquid Chrome, Metallic Paint, Ballpit, Light Tunnel, Laser Flow, Strands, Topography, Gradient ASCII, Circular Gallery and Profile Card. — [React Bits GitHub](https://github.com/DavidHDev/react-bits)

**Aura UI (auraui.com)**
- An open-source React/Next.js + Tailwind + Framer Motion library, mainly for marketing pages: Hero (42), Header, Footer, Pricing (17), Testimonial (22), Feature (25), Logo Cloud and so on. It also has 3 small animation items (Toggle, Cards, Tabs), Web3 items and one AI "support chat" component. No glass, tooltip, badge or panel components are listed. The page states no licence or pricing. — [Aura UI](https://auraui.com)

**OriginKit (originkit.dev)**
- It bills itself as "The largest free animated component library for building modern websites". Components can be copied as code, used in Framer, or reached through MCP. The page states no licence. — [OriginKit](https://originkit.dev)

**Uiverse (uiverse.io/forms)**
- The Forms category lists 34 community-submitted forms in CSS or Tailwind, each credited to its creator's username. — [Uiverse Forms](https://uiverse.io/forms)
- "All content (UI elements) on this site are published under the MIT License." — [Uiverse Forms](https://uiverse.io/forms)

**StringTune (Fiddle.Digital)**
- Orpetron named it Site of the Year 2025 (final score 9.3; usability 9.6; design 9.3). — [Orpetron: StringTune](https://www.orpetron.com/sites/stringtune/)
- It describes itself as "CSS-First. JS-Light", with attribute-driven configuration in HTML. Modules include smooth scrolling, parallax, cursor tracking, progress tracking with easing, text splitting with "safe natural kerning", sticky support, visibility and hover effects, and custom modules. npm package: `@fiddle-digital/string-tune` (v1.2.7 at fetch time). The site doesn't state the licence or pricing. — [StringTune](https://string-tune.fiddle.digital)

### Inferences
**Fit (use, scaled down):**
- *Text reveal / split text* (React Bits, StringTune): use it only on the verdict count when it first resolves, for example "Checking…" → "2 issues" as a 150–250 ms blur-to-sharp or per-word fade. Never animate body text in tooltips or the panel. StringTune's "natural kerning" split matters for SF, which kerns tightly.
- *Shimmer*: a single soft highlight sweeping across the pill or a skeleton row while analysis runs. It is a legitimate progress indicator. Stop it the moment results arrive.
- *Spotlight / cursor-follow sheen*: a faint radial highlight under the cursor on the panel's glass surface (white at about 6–10% opacity, about 200 px radius). It suggests a glass specular highlight. Use it only on the panel or pill, never on host-page content.
- *Animated border*: a slowly rotating conic-gradient hairline, used only as a transient state (for example while the AI chat is "thinking"), never at rest.
- *Magnetic hover*: a gentle pull of the pill toward the cursor (≤ 4–6 px travel). It works for one floating target and gets annoying on lists of chips.
- *Uiverse inputs and toggles*: good MIT starting points for the settings toggles and the chat input, restyled to the system tokens.
- *Aura UI AI support chat*: possibly useful as a structural reference for the chat layout, but it is a full-page support widget, not a compact overlay.

**Avoid (gimmicky or costly on third-party pages):**
- WebGL and canvas backgrounds (Fluid Glass, Liquid Chrome, Metallic Paint, Light Tunnel, Laser Flow, Ballpit, Strands, Topography, Gradient ASCII). They pull in a heavy runtime, use GPU on every tab, and look like a demo rather than a tool. The names suggest WebGL, but I didn't open their source to check the dependencies.
- Smooth-scroll and parallax modules (StringTune). An overlay must never hijack the host page's scrolling.
- Custom cursors, cursor trails and click-spark effects. They override host-page behaviour.
- Marketing-section components (heroes, pricing, testimonials, logo clouds from Aura UI and OriginKit). They are irrelevant to an overlay.

**Licence implications:**
- Uiverse (MIT): copy freely and keep the MIT notice.
- React Bits (MIT + Commons Clause): use inside the extension is allowed. Commons Clause typically bars *selling the software itself* (for example repackaging the components as a paid kit). Confirm against LICENSE.md.
- Aura UI, OriginKit and StringTune: no licence was stated on the pages I fetched. Check their GitHub or npm LICENSE before shipping copied code.

### Gaps
- I couldn't load OriginKit's component list (/components returned an error), so its specific glass, tooltip or micro-interaction components are unverified.
- I couldn't access UI8 UI Kitchen (the page failed and searches returned nothing relevant). Its products, prices and licence are unknown. UI8 products are generally paid, but I couldn't verify that for UI Kitchen.
- Per-component parameters (durations, easing) for React Bits demos weren't visible from the index pages.
- StringTune's licence, bundle size and exact attribute syntax are not stated on its landing page.
- React Bits' exact Commons Clause wording wasn't read directly.

---

## 3. What do top iOS apps on Mobbin do for verdict/score badges, inline annotations and AI assistant entry points?

### Takeaway
This mostly couldn't be answered from Mobbin itself. The fetcher was blocked from /discover/apps/ios/latest, and Mobbin's free tier restricts browsing. Only the pricing terms are confirmed.

### Cited Findings
- Mobbin Free ($0): "limited" apps and sites, **no flows or animations**, **no Search or Deep Search**, up to 3 collections, limited copy and download. Pro: $10/month billed yearly ($120/yr) or $15/month billed quarterly, with all apps, flows, animations, search and full copy. Team: $16 per member per month billed yearly. — [Mobbin Pricing](https://mobbin.com/pricing.md)
- The pricing page gives no numeric limit on free screens or apps. — [Mobbin Pricing](https://mobbin.com/pricing.md)

### Inferences
- Because free users get no Search or Flows, finding specific patterns ("score badge", "AI chat entry") on Mobbin effectively needs Pro, which costs about $45 for one quarter.
- The HIG findings above give a defensible substitute pattern set. The badge is a neutral glass capsule with one status dot. Annotations are anchored single popovers. The AI entry is one prominent tinted control, consistent with "tint only the primary action", for example a small "Ask" capsule at the foot of the panel rather than a floating second bubble.

### Gaps
- No direct evidence on how specific top iOS apps style verdict or score badges, inline annotations or AI entry points. This needs a logged-in Mobbin Pro session, which an automated fetcher can't use.

---

## 4. Recommended motion values (durations, springs) for hover tooltips and panel transitions

### Takeaway
Apple models motion as springs with two parameters, duration and bounce. Bounce 0 is the default "when you're not sure". Above about 0.4 looks exaggerated for UI. HIG also asks for brief, precise feedback, little motion on frequent interactions, interruptible animations and a reduced-motion path. For an overlay, that means near-instant tooltips, a critically damped or barely bouncy spring for the pill-to-panel expansion, and no looping motion at rest.

### Cited Findings
- SwiftUI springs are set by **duration** and **bounce** (range −1.0 to 1.0). The default bounce is 0: "When you're not sure, use a spring with bounce 0." Bounce of about 0.15 feels slightly bouncy, about 0.30 noticeably bouncy, and values above about 0.4 "may look exaggerated for UI elements". The presets are smooth, snappy and bouncy, and can be tuned, for example `snappy(duration: 0.4)` or `spring(duration: 0.6, bounce: 0.2)`. Springs convert to mass, stiffness and damping. — [WWDC23 "Animate with springs" notes](https://wwdcnotes.com/notes/wwdc23/10158)
- Completion uses *perceptual duration*, which fires when the spring is mostly settled. Don't wait for full settling before making changes the user will see. — [WWDC23 "Animate with springs" notes](https://wwdcnotes.com/notes/wwdc23/10158)
- "Add motion purposefully." "Gratuitous or excessive animation can distract people." "Make motion optional." — [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- "Aim for brevity and precision in feedback animations." "Generally avoid adding motion to UI interactions that occur frequently." "Let people cancel motion": don't make people wait for an animation to finish. — [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Motion should follow the gesture's direction. A view revealed by sliding down shouldn't be dismissed sideways. — [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Liquid Glass motion is more emphatic with touch and "more subdued" with a trackpad. Desktop pointer input should therefore get calmer motion. — [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Avoid sustained oscillation, especially around 0.2 Hz (stated for visionOS, but a useful general caution). — [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Animate popover size changes rather than swapping the popover. — [Apple HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers.md)

### Inferences (proposed values, derived from the cited rules and not taken from any library)
| Interaction | Proposal |
|---|---|
| Tooltip show | Hover-intent delay of about 300–400 ms on the first hover, then 0 ms when moving between highlights in the same session. Fade plus 4 px rise plus scale 0.98→1 over 120–160 ms, ease-out (`cubic-bezier(0.2, 0.8, 0.2, 1)`) or spring (duration 0.25 s, bounce 0). |
| Tooltip hide | 80–100 ms fade with no movement, after a 100–150 ms grace period so the pointer can travel into the tooltip. |
| Tooltip → next tooltip | Move and resize the single tooltip (spring 0.3 s, bounce 0) instead of closing and reopening it. |
| Pill → panel expand | Shared-element resize from the pill's rect to the panel. Spring duration about 0.40–0.45 s, bounce 0.1–0.15 ("slightly bouncy"). Panel content fades in at roughly 40% of the way through the animation. |
| Panel collapse | Spring about 0.30–0.35 s, bounce 0, so closing is quicker than opening. |
| Pill count update | Number roll or blur-reveal over 150–200 ms, plus one soft scale pulse (1→1.04→1). No looping. |
| Check row hover | Background tint only (about 80 ms). No movement, since this is a frequent interaction. |
| Chat chip press | Scale to 0.97 on press with an 80 ms spring back. The chip then animates into the input or message position over about 250 ms. |
| Loading | A shimmer sweep of about 1.2–1.6 s per pass, stopped as soon as results arrive. |
| Reduced motion | Under `prefers-reduced-motion: reduce`, replace all translate, scale and spring with opacity crossfades of 100–150 ms and disable shimmer, magnetic and spotlight. |

Converting to web spring libraries: Motion/Framer Motion accepts `type: "spring", visualDuration, bounce` (a model close to Apple's duration and bounce), so 0.4 s and 0.15 carry over directly. Treat this mapping as an inference that should be checked against the Motion docs.

**Glass parameters for CSS in Chrome (inference, not from HIG):**
- Pill: height 32–36 px, horizontal padding 12–14 px, fully rounded (`border-radius: 999px`), `backdrop-filter: blur(20–24px) saturate(160–180%)`. Background white at about 55–70% in light mode or neutral 30,30,32 at about 50–65% in dark mode. A 0.5–1 px inner hairline at white 30–40% for the specular edge, and a soft shadow such as 0 8 px 24 px at black 12–18%.
- Tooltip: max width about 280–320 px, radius 10–12 px, padding 10–12 px, heading 13 px Semibold, body 12–13 px Regular in secondary label colour.
- Panel: width 340–380 px, inset 12–16 px from the viewport edge, radius 16–20 px (concentric with inner cards at about 10–12 px), 8 pt spacing grid, more opaque than the pill (75–85%). It is pinned and nonmodal, with no page dim.
- Chat: 2–4 suggestion chips (height 28 px, radius 14 px, 12–13 px text), a single-line input that grows to about 4 lines, and one tinted send control as the only accent-coloured element.
- Onboarding and settings: 1–3 steps, each with a 17 px title and at most 2 lines of 13 px body. Settings as grouped list rows with toggles. Cancel and Done paired, per HIG.
- Mount the UI inside a closed Shadow DOM so host-page CSS can't leak in, and lower glass opacity (raise solidity) under `prefers-reduced-transparency` and `prefers-contrast: more`. Chrome support for `prefers-reduced-transparency` should be checked, since it may be limited.

### Gaps
- Apple publishes no exact durations or bounce values for system popovers, sheets or Liquid Glass. The numbers above are proposals within Apple's stated ranges.
- I didn't fetch the exact smooth, snappy and bouncy preset bounce values from Apple's developer docs. The WWDC notes don't list them.
- Chrome-specific performance costs of `backdrop-filter` on large panels over heavy pages were not researched.
