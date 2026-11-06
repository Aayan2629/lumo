// Lumo's look. Lives inside a closed shadow root so the page can't restyle it and it can't touch the page.
// Glass follows Apple's guidance: only on floating controls, a regular (fairly opaque) fill under text,
// colour only for status, and an opaque fallback for Reduce Transparency.
LUMO.CSS = String.raw`
:host { all: initial; }
* { box-sizing: border-box; margin: 0; }
.ui {
  --ink: #1d1d1f; --ink2: rgba(29,29,31,.64); --ink3: rgba(29,29,31,.42); --hair: rgba(0,0,0,.08);
  --glass: rgba(251,251,253,.72); --glass-hi: rgba(255,255,255,.9); --solid: #f7f7f9; --well: rgba(118,118,128,.1);
  --rim: rgba(255,255,255,.95); --rim2: rgba(255,255,255,.25);
  --shadow: 0 1px 1px rgba(0,0,0,.03), 0 8px 24px -8px rgba(0,0,0,.18), 0 28px 60px -24px rgba(0,0,0,.24);
  --red: #ff2d23; --amber: #ffb800; --green: #1fc45a; --info: #c9a45c; --grey: #8e8e93; --blue: #0a84ff;
  --red-ink: #d70015; --amber-ink: #a35a00; --green-ink: #1a8a3e;
  --spring: linear(0, .0335, .1141, .2188, .3319, .4431, .5463, .6381, .7172, .7836, .838, .8816, .9159, .9422, .9621, .9767, .9872, .9944, .9992, 1.0023, 1.004, 1.0048, 1.005, 1.0048, 1.0044, 1.0039, 1.0033, 1.0028, 1);
  --ease: cubic-bezier(.32,.72,0,1);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Lumo Grotesk", "Segoe UI", system-ui, sans-serif;
  font-size: 13px; line-height: 1.35; color: var(--ink); letter-spacing: -0.006em;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
/* Dark glass only when the page itself is dark (set in ui.js), so Lumo matches what's under it. */
.ui.dark {
    --ink: #f5f5f7; --ink2: rgba(245,245,247,.68); --ink3: rgba(245,245,247,.42); --hair: rgba(255,255,255,.1);
    --glass: rgba(28,28,31,.74); --glass-hi: rgba(52,52,58,.8); --solid: #1f1f22; --well: rgba(118,118,128,.24);
    --rim: rgba(255,255,255,.28); --rim2: rgba(255,255,255,.04);
    --shadow: 0 1px 1px rgba(0,0,0,.2), 0 10px 30px -8px rgba(0,0,0,.5), 0 30px 70px -24px rgba(0,0,0,.6);
    --red: #ff453a; --amber: #ffc21a; --green: #30d158; --red-ink: #ff6961; --amber-ink: #ffcc4d; --green-ink: #4cd964;
}
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
a { color: inherit; text-decoration: none; }
button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.ic { display: block; flex: none; }
.logo { display: block; flex: none; border-radius: 26%; box-shadow: 0 1px 2px rgba(0,0,0,.25), inset 0 0 0 .5px rgba(255,255,255,.2); }
.num { font-variant-numeric: tabular-nums; }

/* ---------- glass ---------- */
.glass {
  position: relative; background: var(--glass);
  -webkit-backdrop-filter: blur(26px) saturate(190%); backdrop-filter: blur(26px) saturate(190%);
  box-shadow: var(--shadow), inset 0 .5px 0 var(--rim);
}
/* Specular rim: bright at the top-left, fading round the edge, like light catching thick glass. */
.glass::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: linear-gradient(155deg, var(--rim) 0%, var(--rim2) 38%, transparent 55%, var(--rim2) 80%, var(--rim) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
}
/* A faint sheen that follows the pointer. */
.glass::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity .3s;
  background: radial-gradient(220px circle at var(--mx, 50%) var(--my, 0%), rgba(255,255,255,.34), transparent 62%);
  mix-blend-mode: soft-light;
}
.glass:hover::after { opacity: 1; }
@media (prefers-reduced-transparency: reduce) { .glass { background: var(--solid); -webkit-backdrop-filter: none; backdrop-filter: none; } }
@media (prefers-contrast: more) { .glass { background: var(--solid); box-shadow: 0 0 0 1px var(--ink3), var(--shadow); } }

.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 22%, transparent); }
.red { --c: var(--red); --ci: var(--red-ink); } .amber { --c: var(--amber); --ci: var(--amber-ink); } .green { --c: var(--green); --ci: var(--green-ink); }
.info { --c: var(--info); --ci: var(--info); } .grey { --c: var(--grey); --ci: var(--ink2); }

/* ---------- page layer: positioned in page coordinates, so it scrolls with the words ---------- */
.layer { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; }
.layer.off .edge, .layer.off .chip { opacity: 0 !important; }
.glow {
  position: absolute; border-radius: 7px; opacity: 0; transition: opacity .18s var(--ease);
  background: color-mix(in srgb, var(--c) 12%, transparent);
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--c) 60%, transparent), 0 0 20px 2px color-mix(in srgb, var(--c) 50%, transparent);
}
.glow.on { opacity: 1; }
.glow.flash { animation: flash 1s var(--ease) both; }
@keyframes flash { 0% { opacity: 0 } 25% { opacity: 1 } 100% { opacity: 0 } }

/* The beam: Lumo's light passing down the ad as it reads it. */
.beam { position: absolute; height: 160px; pointer-events: none; border-radius: 40px; opacity: 0;
  background: linear-gradient(180deg, transparent, rgba(243,213,140,.0) 20%, rgba(243,213,140,.38) 50%, rgba(255,255,255,.0) 80%, transparent);
  filter: blur(6px); mix-blend-mode: multiply; }
.ui.dark .beam { mix-blend-mode: screen; }

.edge {
  position: absolute; pointer-events: none; transition: opacity .3s;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--c) 88%, white 12%),
              inset 0 0 30px 0 color-mix(in srgb, var(--c) 50%, transparent),
              0 0 26px -6px color-mix(in srgb, var(--c) 75%, transparent);
  animation: breathe 3.6s ease-in-out infinite;
}
.edge.hot { animation: none; box-shadow: inset 0 0 0 2.5px var(--c), inset 0 0 40px 4px color-mix(in srgb, var(--c) 55%, transparent), 0 0 32px -4px color-mix(in srgb, var(--c) 80%, transparent); }
@keyframes breathe { 0%,100% { opacity: .8 } 50% { opacity: 1 } }
.tag {
  position: absolute; left: 12px; top: 12px; height: 26px; padding: 0 10px 0 8px; border-radius: 13px;
  display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; letter-spacing: -.01em;
}

/* A margin note pinned to the price: what similar homes ask. */
.chip { position: absolute; height: 28px; padding: 0 11px 0 9px; border-radius: 14px; display: flex; align-items: center; gap: 7px;
  font-size: 13px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; transform: translateY(-50%);
  animation: pop .6s var(--spring) both; animation-delay: var(--d, 0s); }
.chip span { color: var(--ink2); font-weight: 500; }
@keyframes pop { from { opacity: 0; transform: translateY(-50%) scale(.85) translateX(-6px) } }

.bubble {
  position: absolute; width: max-content; max-width: 300px; padding: 8px 12px 8px 10px; border-radius: 14px;
  display: flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 500; line-height: 1.3;
  opacity: 0; transform: translate(-50%, calc(-100% + 4px)) scale(.97); transform-origin: 50% 100%;
  transition: opacity .14s var(--ease), transform .2s var(--ease);
}
.bubble.below { transform: translate(-50%, -4px) scale(.97); transform-origin: 50% 0; }
.bubble.show { opacity: 1; transform: translate(-50%, -100%) scale(1); }
.bubble.below.show { transform: translate(-50%, 0) scale(1); }
.bubble .more { color: var(--ink3); font-weight: 500; white-space: nowrap; }

/* ---------- fixed layer ---------- */
.fixed { position: fixed; inset: 0; width: 100vw; height: 100vh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: transparent; overflow: visible; color: inherit; pointer-events: none; }
.fixed > * { pointer-events: auto; }

/* Dock: the verdict. Drag it anywhere; click to open. */
.dock {
  position: fixed; left: 0; top: 0; height: 50px; padding: 0 16px 0 10px; border-radius: 25px;
  display: flex; align-items: center; gap: 12px; cursor: grab; user-select: none; touch-action: none;
  transition: transform .45s var(--spring), opacity .25s var(--ease);
  transform-origin: 100% 100%;
}
.dock:hover { transform: translateY(-1px) scale(1.02); }
.dock:active { cursor: grabbing; }
.dock.dragging { transition: none; transform: scale(1.05); box-shadow: var(--shadow), 0 24px 50px -16px rgba(0,0,0,.35), inset 0 .5px 0 var(--rim); }
.dock.hide { opacity: 0; transform: scale(.6) translateY(10px); pointer-events: none; }
.dock .logo { width: 30px; height: 30px; }
.dock .head { font-size: 14px; font-weight: 600; letter-spacing: -.015em; white-space: nowrap; overflow: hidden; max-width: 0; opacity: 0; transition: max-width .5s var(--ease), opacity .3s; }
.dock.say .head { max-width: 200px; opacity: 1; }
.counts { display: flex; align-items: center; gap: 11px; }
.count { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 600; }
.count .dot { width: 9px; height: 9px; }
.reading { font-size: 14px; font-weight: 600; background: linear-gradient(90deg, var(--ink3) 0%, var(--ink) 45%, var(--ink3) 90%); background-size: 200% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent; animation: shimmer 1.4s linear infinite; }
@keyframes shimmer { from { background-position: 100% 0 } to { background-position: -100% 0 } }

/* Panel: floats, drags by its top bar, folds back into the dock. */
.panel {
  position: fixed; left: 0; top: 0; width: min(392px, calc(100vw - 24px)); height: min(780px, calc(100vh - 24px)); border-radius: 30px;
  display: flex; flex-direction: column; overflow: visible;   /* visible so the resize handles can sit just outside the edge, like a Mac window */
  opacity: 0; transform: scale(.9); pointer-events: none;
  transition: opacity .22s var(--ease), transform .5s var(--spring);
}
.panel.open { opacity: 1; transform: none; pointer-events: auto; }
.panel.dragging { transition: none; }
.top { display: flex; align-items: center; gap: 8px; padding: 14px 12px 8px 16px; cursor: grab; touch-action: none; }
.top:active { cursor: grabbing; }
.grip { position: absolute; top: 6px; left: 50%; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: var(--ink3); opacity: .35; }
.top .logo { width: 32px; height: 32px; }
.addr { flex: 1; min-width: 0; margin-left: 3px; }
.addr b { display: block; font-size: 15px; font-weight: 600; letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.addr span { display: block; font-size: 12px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.round { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--well); color: var(--ink2); transition: background .2s, color .2s, transform .3s var(--spring); flex: none; }
.round:hover { color: var(--ink); background: color-mix(in srgb, var(--well) 100%, var(--ink) 6%); }
.round:active { transform: scale(.9); }
.round.on { color: #fff; background: var(--red); }
.round.dim { color: var(--ink3); }

.hero { padding: 6px 18px 12px; }
.verdict { font-size: 27px; font-weight: 700; letter-spacing: -.035em; line-height: 1.1; }
.verdict .sub { display: block; margin-top: 5px; font-size: 13px; font-weight: 500; letter-spacing: -.01em; color: var(--ink2); }
.meter { margin-top: 14px; }
.track { position: relative; height: 6px; border-radius: 3px; background: var(--well); }
.fill { position: absolute; top: 0; bottom: 0; border-radius: 3px; background: linear-gradient(90deg, color-mix(in srgb, var(--green) 80%, transparent), color-mix(in srgb, var(--c) 95%, transparent)); }
.mk { position: absolute; top: 50%; width: 14px; height: 14px; border-radius: 50%; transform: translate(-50%, -50%); background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3), 0 0 0 3px var(--c); }
.mk.fair { width: 10px; height: 10px; box-shadow: 0 1px 2px rgba(0,0,0,.25), 0 0 0 2px var(--ink3); }
.mlabels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: var(--ink2); }
.mlabels b { color: var(--ink); font-weight: 600; }
/* Each label sits under its own marker; translate by the same % keeps it inside the track at the ends. */
.mlabels.under { position: relative; display: block; height: 16px; }
.mlabels.under span { position: absolute; top: 0; left: var(--x); transform: translateX(calc(var(--x) * -1)); white-space: nowrap; }
.year { margin-top: 10px; font-size: 12.5px; color: var(--ci); font-weight: 600; }
.links { display: flex; gap: 6px; margin-top: 12px; }
.mkt { display: block; height: auto; max-width: 100%; margin-top: 4px; overflow: visible; }
.mkt text { font: 500 11.5px -apple-system, BlinkMacSystemFont, "Lumo Grotesk", system-ui, sans-serif; fill: var(--ink2); }
.glogo { width: 14px; height: 14px; flex: none; display: block; }
.link { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border-radius: 14px; font-size: 12.5px; font-weight: 600; background: var(--well); transition: background .2s, transform .3s var(--spring); }
.link:hover { background: color-mix(in srgb, var(--well) 100%, var(--ink) 7%); }
.link:active { transform: scale(.95); }

.seg { position: relative; margin: 0 14px; height: 34px; padding: 3px; border-radius: 11px; background: var(--well); display: grid; grid-template-columns: repeat(3, 1fr); flex: none; }
.seg button { position: relative; z-index: 1; font-size: 13px; font-weight: 500; color: var(--ink2); transition: color .2s; }
.seg button[aria-selected="true"] { color: var(--ink); font-weight: 600; }
.seg .n { display: inline-grid; place-items: center; min-width: 17px; height: 17px; margin-left: 5px; padding: 0 5px; border-radius: 9px; font-size: 10.5px; font-weight: 700; background: var(--ink); color: var(--solid); vertical-align: 1px; }
.thumb { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc((100% - 6px) / 3); border-radius: 8px; background: var(--glass-hi);
  box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 3px 8px -2px rgba(0,0,0,.12), inset 0 .5px 0 var(--rim); transition: transform .45s var(--spring); }

.body { flex: 1; min-height: 0; overflow: auto; padding: 12px 10px 10px; scrollbar-width: thin; overscroll-behavior: contain; }
.view { animation: in .35s var(--ease) both; }
@keyframes in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.group { margin: 6px 8px 6px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink3); display: flex; align-items: center; gap: 8px; }
.group::after { content: ""; flex: 1; height: .5px; background: var(--hair); }
.row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 10px 11px 12px; border-radius: 16px; text-align: left; transition: background .2s; position: relative; }
.row::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 3px; border-radius: 2px; background: var(--c); opacity: 0; transition: opacity .2s; }
.row:hover { background: var(--well); }
.row:hover::before { opacity: 1; }
.row .t { flex: 1; min-width: 0; }
.row b { display: block; font-size: 14px; font-weight: 600; letter-spacing: -.015em; }
.row span { display: block; margin-top: 2px; font-size: 12.5px; color: var(--ink2); }
.row .ic { color: var(--ink3); }
.chip-s { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 600; letter-spacing: .02em; vertical-align: 1px; color: var(--ink2); background: var(--well); font-style: normal; }
.more-grey { width: 100%; padding: 10px 12px; text-align: left; font-size: 12.5px; color: var(--ink2); border-radius: 12px; }
.more-grey:hover { background: var(--well); }

/* Detail */
.back { display: flex; align-items: center; gap: 4px; padding: 4px 8px 8px; font-size: 13px; color: var(--ink2); }
.back:hover { color: var(--ink); }
.dtitle { padding: 0 10px; display: flex; gap: 10px; align-items: flex-start; }
.dtitle .dot { margin-top: 8px; }
.dtitle h2 { font-size: 21px; font-weight: 700; letter-spacing: -.03em; line-height: 1.15; }
.quote { margin: 12px 10px 0; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 10px; font-size: 12.5px; font-weight: 600; color: var(--ci); background: color-mix(in srgb, var(--c) 15%, transparent); cursor: pointer; }
.quote:hover { background: color-mix(in srgb, var(--c) 22%, transparent); }
.card { margin: 12px 4px 0; padding: 14px; border-radius: 20px; background: var(--glass-hi); box-shadow: 0 0 0 .5px var(--hair), 0 4px 14px -6px rgba(0,0,0,.12); }
.line { padding: 10px 10px 0; font-size: 15px; font-weight: 500; letter-spacing: -.015em; line-height: 1.35; }
.label { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink3); margin-bottom: 4px; }
.para { font-size: 13.5px; line-height: 1.45; color: var(--ink); }
.pair { display: grid; gap: 0; margin: 2px 6px 0; }
.src { margin: 14px 10px 4px; font-size: 11.5px; color: var(--ink3); }
.qs { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 8px 0; }
.q { padding: 8px 12px; border-radius: 16px; font-size: 13px; font-weight: 500; background: var(--well); transition: background .2s, transform .3s var(--spring); text-align: left; }
.q:hover { background: color-mix(in srgb, var(--well) 100%, var(--ink) 7%); }
.q:active { transform: scale(.96); }
.bars { display: grid; gap: 10px; }
.bar { display: grid; grid-template-columns: 76px 1fr auto; align-items: center; gap: 10px; font-size: 12.5px; color: var(--ink2); }
.bar i { height: 10px; border-radius: 5px; background: var(--ink3); opacity: .45; transform-origin: 0 50%; animation: grow .7s var(--ease) both; }
.bar.me i { background: var(--c); opacity: 1; }
.bar b { color: var(--ink); font-weight: 600; }
@keyframes grow { from { transform: scaleX(0) } }
.rows { margin-top: 12px; display: grid; gap: 6px; font-size: 12.5px; }
.rows div { display: flex; justify-content: space-between; gap: 12px; color: var(--ink2); }
.rows div b { color: var(--ink); font-weight: 500; }
.map { display: block; width: 100%; height: auto; }
.map text { font: 500 10.5px -apple-system, BlinkMacSystemFont, "Lumo Grotesk", system-ui, sans-serif; fill: var(--ink2); }
.map .halo { animation: pulse 2.4s ease-out infinite; transform-origin: center; transform-box: fill-box; }
@keyframes pulse { 0% { opacity: .55; transform: scale(1) } 100% { opacity: 0; transform: scale(3.2) } }
.hist { display: grid; gap: 8px; }
.hist div { display: grid; grid-template-columns: 82px 1fr auto; gap: 10px; align-items: center; font-size: 12.5px; color: var(--ink2); }
.hist i { height: 4px; border-radius: 2px; background: var(--c); opacity: .75; }
.hist b { color: var(--ink); font-weight: 600; }
.trip { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; align-items: end; }
.trip .mins { font-size: 34px; font-weight: 700; letter-spacing: -.04em; line-height: 1; }
.trip .mins small { font-size: 14px; font-weight: 600; color: var(--ink2); letter-spacing: -.01em; margin-left: 3px; }
.trip .to { font-size: 12.5px; color: var(--ink2); text-align: right; }
.route { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; margin: 8px 0 4px; }
.route i { width: 10px; height: 10px; border-radius: 50%; background: #c9a45c; box-shadow: 0 0 0 3px rgba(201,164,92,.25); flex: none; }
.route i:last-child { background: var(--blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 25%, transparent); }
.route span { flex: 1; height: 3px; border-radius: 2px; background: repeating-linear-gradient(90deg, var(--ink3) 0 6px, transparent 6px 10px); }

/* Ask */
.askhead { display: flex; align-items: center; gap: 12px; padding: 4px 8px 14px; }
.askhead .logo { width: 40px; height: 40px; }
.askhead b { display: block; font-size: 16px; font-weight: 700; letter-spacing: -.02em; }
.askhead span { font-size: 12.5px; color: var(--ink2); }
.chat { display: flex; flex-direction: column; gap: 10px; padding: 2px 4px 6px; }
.msg { display: flex; gap: 8px; align-items: flex-end; max-width: 92%; animation: in .3s var(--ease) both; }
.msg .logo { width: 22px; height: 22px; margin-bottom: 2px; }
.msg p { padding: 9px 13px; border-radius: 18px; font-size: 14px; line-height: 1.42; white-space: pre-wrap; }
.msg.lumo p { background: var(--glass-hi); box-shadow: 0 0 0 .5px var(--hair), 0 4px 12px -8px rgba(0,0,0,.2); border-bottom-left-radius: 6px; }
.msg.me { align-self: flex-end; }
.msg.me p { color: #fff; background: linear-gradient(180deg, #2a2a2e, #1c1c1e); border-bottom-right-radius: 6px; }
.ui.dark .msg.me p { background: linear-gradient(180deg, #ecd6a1, #c9a45c); color: #1c1c1e; }
.typing p { display: inline-flex; gap: 4px; padding: 14px; }
.typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink3); animation: bob 1s ease-in-out infinite; }
.typing i:nth-child(2) { animation-delay: .15s } .typing i:nth-child(3) { animation-delay: .3s }
@keyframes bob { 0%,100% { transform: translateY(0); opacity: .5 } 50% { transform: translateY(-3px); opacity: 1 } }
.starters { display: grid; gap: 6px; margin: 6px 0 0 30px; }
.starter { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; font-size: 13.5px; font-weight: 500; text-align: left; background: var(--glass-hi); box-shadow: 0 0 0 .5px var(--hair); transition: transform .3s var(--spring), box-shadow .2s; }
.starter .ic { color: #b98f4f; }
.starter:hover { box-shadow: 0 0 0 1px color-mix(in srgb, #c9a45c 60%, transparent), 0 6px 16px -10px rgba(0,0,0,.3); }
.starter:active { transform: scale(.97); }
.composer { position: relative; display: flex; align-items: center; gap: 6px; margin: 0 12px 12px; padding: 5px 5px 5px 14px; border-radius: 22px; background: var(--glass-hi); box-shadow: 0 0 0 .5px var(--hair), 0 4px 16px -8px rgba(0,0,0,.2); transition: box-shadow .25s; flex: none; }
.composer:focus-within { box-shadow: 0 0 0 1.5px color-mix(in srgb, #c9a45c 70%, transparent), 0 0 24px -6px rgba(201,164,92,.6); }
.composer input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: inherit; font-size: 14px; color: var(--ink); height: 32px; }
.composer input::placeholder { color: var(--ink3); }
.send { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: #1c1c1e; transition: transform .3s var(--spring), opacity .2s; }
.ui.dark .send { background: #f5f5f7; color: #1c1c1e; }
.send:disabled { opacity: .3; cursor: default; }
.mic { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: var(--ink2); }
.mic.live { color: #fff; background: var(--red); }

/* Saved */
.saved { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 4px; }
.sh { position: relative; border-radius: 20px; overflow: hidden; background: var(--glass-hi); box-shadow: 0 0 0 .5px var(--hair), 0 8px 20px -14px rgba(0,0,0,.35); transition: transform .35s var(--spring); }
.sh:hover { transform: translateY(-2px); }
.sh img, .sh .ph { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: linear-gradient(135deg, #2c2c30, #1c1c1e); }
.sh .meta { padding: 9px 11px 11px; }
.sh .price { font-size: 16px; font-weight: 700; letter-spacing: -.02em; }
.sh .ad { font-size: 12px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.sh .cs { display: flex; gap: 8px; margin-top: 7px; }
.sh .cs .count { font-size: 12px; gap: 4px; }
.sh .cs .dot { width: 7px; height: 7px; }
.sh .rm { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: rgba(0,0,0,.4); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); opacity: 0; transition: opacity .2s; }
.sh:hover .rm { opacity: 1; }
.empty { padding: 40px 24px; text-align: center; color: var(--ink2); font-size: 13.5px; line-height: 1.5; display: grid; justify-items: center; gap: 14px; }
.empty .heart { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; color: var(--red); background: color-mix(in srgb, var(--red) 12%, transparent); }
.empty b { color: var(--ink); font-size: 15px; display: block; margin-bottom: 2px; }
.foot { display: flex; gap: 6px; align-items: center; padding: 8px 12px 12px 16px; border-top: .5px solid var(--hair); flex: none; }
.foot .srcs { display: flex; gap: 6px; flex-wrap: nowrap; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 82%, transparent); mask-image: linear-gradient(90deg, #000 82%, transparent); }
.foot .srcs::-webkit-scrollbar { display: none; }
.src-chip { flex: none; }
.src-chip { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 11px; font-size: 11px; font-weight: 500; color: var(--ink2); background: var(--well); }
.src-chip i { width: 6px; height: 6px; border-radius: 50%; background: var(--green); }
.src-chip.sample i { background: var(--amber); } .src-chip.snapshot i { background: var(--grey); }
.foot .round { width: 28px; height: 28px; }

/* While Lumo reads: soft placeholder rows instead of an empty panel. */
.skel { display: grid; gap: 10px; padding: 8px 12px; }
.skel i { display: block; height: 52px; border-radius: 16px; background: linear-gradient(90deg, var(--well) 0%, color-mix(in srgb, var(--well) 100%, white 40%) 50%, var(--well) 100%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; }
.skel p { font-size: 13px; color: var(--ink2); padding: 4px 4px 0; }

/* Real map */
.lmap { display: block; width: 100%; aspect-ratio: 16 / 11; height: auto; max-height: 62vh; border: 0; border-radius: 14px; background: var(--well); box-shadow: inset 0 0 0 .5px var(--hair); }
.lmap.tall { aspect-ratio: 16 / 12; }

/* Resize handles: a pill on the side and one at the bottom */

/* Side page mode and the morph between floating and docked */
.panel.morph { transition: opacity .22s var(--ease), transform .5s var(--spring), width .45s var(--spring), height .45s var(--spring), left .45s var(--spring), top .45s var(--spring); }
.panel.side { border-radius: 24px; }
.panel.side .g-r, .panel.side .g-tr, .panel.side .g-br, .panel.side .g-b, .panel.side .g-bl, .panel.side .g-tl { display: none; }
.round.side svg { transition: transform .3s var(--spring); }
.round.side:hover svg { transform: scale(1.12); }

/* Resize handles, Mac style: each edge and corner has a hit zone that straddles the border,
   so the diagonal resize cursor appears right on the corner, a few pixels outside the glass. */
.grip-e { position: absolute; z-index: 6; touch-action: none; }
.g-l, .g-r { top: 26px; bottom: 26px; width: 14px; }
.g-l { left: -8px; } .g-r { right: -8px; }
.g-b { left: 26px; right: 26px; bottom: -8px; height: 14px; }
.g-bl, .g-br, .g-tl, .g-tr { width: 34px; height: 34px; }
.g-bl { left: -10px; bottom: -10px; } .g-br { right: -10px; bottom: -10px; }
.g-tl { left: -10px; top: -10px; width: 26px; height: 26px; } .g-tr { right: -10px; top: -10px; width: 26px; height: 26px; }
/* A soft arc traces the rounded corner when you hover it. */
.g-bl::after, .g-br::after, .g-tl::after, .g-tr::after { content: ""; position: absolute; width: 22px; height: 22px; border: 0 solid var(--ink3); opacity: 0; transition: opacity .2s; }
.g-br::after { right: 12px; bottom: 12px; border-width: 0 3px 3px 0; border-bottom-right-radius: 26px; }
.g-bl::after { left: 12px; bottom: 12px; border-width: 0 0 3px 3px; border-bottom-left-radius: 26px; }
.g-tr::after { right: 12px; top: 12px; border-width: 3px 3px 0 0; border-top-right-radius: 26px; }
.g-tl::after { left: 12px; top: 12px; border-width: 3px 0 0 3px; border-top-left-radius: 26px; }
.grip-e:hover::after, .panel.dragging .grip-e::after { opacity: .55; }
.g-b::after { content: ""; position: absolute; left: 50%; bottom: 10px; height: 4px; width: 40px; margin-left: -20px; border-radius: 3px; background: var(--ink3); opacity: .35; }
.dragging, .dragging * { user-select: none; }

/* Building work: one card per project, colour = impact */
.dakey { display: flex; gap: 12px; flex-wrap: wrap; margin: 10px 2px 8px; font-size: 11.5px; color: var(--ink2); }
.dakey span { display: inline-flex; align-items: center; gap: 5px; }
.dakey i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.dakey .grey, .da.grey { --c: #8e8e93; }
.das { display: grid; gap: 6px; }
.da { display: grid; grid-template-columns: 46px 1fr auto; gap: 12px; align-items: center; width: 100%; padding: 10px 12px 10px 10px; border-radius: 16px; text-align: left;
  background: color-mix(in srgb, var(--c) 7%, var(--glass-hi)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 22%, transparent); transition: transform .3s var(--spring), box-shadow .2s; }
.da:hover { transform: translateY(-1px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent), 0 6px 16px -10px color-mix(in srgb, var(--c) 60%, transparent); }
.da.on { box-shadow: inset 0 0 0 2px var(--c), 0 8px 20px -10px color-mix(in srgb, var(--c) 70%, transparent); }
.tile { position: relative; display: grid; place-content: center; justify-items: center; width: 46px; height: 46px; border-radius: 13px; overflow: hidden;
  background: color-mix(in srgb, var(--c) 12%, transparent); box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--c) 30%, transparent); }
/* A fill that rises with the building's height */
.tile::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: var(--h); background: color-mix(in srgb, var(--c) 16%, transparent); }
.tile b { position: relative; font-size: 18px; font-weight: 700; letter-spacing: -.03em; line-height: 1; color: color-mix(in srgb, var(--c) 85%, var(--ink)); }
.tile small { position: relative; margin-top: 2px; font-size: 8.5px; font-weight: 600; color: var(--ink2); text-transform: uppercase; letter-spacing: .05em; }
.da .mid { min-width: 0; }
.da .mid b { display: block; font-size: 13.5px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.da .mid span { display: block; margin-top: 2px; font-size: 12px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.da .end { display: grid; justify-items: end; gap: 4px; font-size: 12.5px; font-weight: 600; }
.state { font-style: normal; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 7px; color: var(--ink2); box-shadow: inset 0 0 0 1px var(--hair); }
.state.ok { color: #fff; background: var(--c); box-shadow: none; }
.da.grey .state.ok { background: #8e8e93; }

/* Visuals inside Ask Lumo answers */
.turn.lumo { display: grid; gap: 6px; }
.viz { margin-left: 30px; padding: 10px; border-radius: 18px; background: var(--glass-hi); box-shadow: 0 0 0 .5px var(--hair), 0 6px 18px -12px rgba(0,0,0,.3); animation: in .4s var(--ease) both; }
.vizhead { display: flex; align-items: center; gap: 8px; margin: 2px 2px 8px; }
.vizhead b { flex: 1; font-size: 13px; font-weight: 600; letter-spacing: -.01em; }
.vizhead .open { font-size: 12px; font-weight: 600; color: var(--blue); padding: 3px 8px; border-radius: 8px; }
.vizhead .open:hover { background: color-mix(in srgb, var(--blue) 10%, transparent); }
.msgs { display: flex; flex-direction: column; gap: 10px; }
.turn.me { align-self: flex-end; max-width: 92%; }
.turn .msg { max-width: 100%; }

/* Street photos */
.strip { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; width: 100%; margin-top: 12px; padding: 0; border: 0; border-radius: 14px; overflow: hidden; cursor: pointer; background: none; transition: transform .35s var(--spring); }
.strip:hover { transform: scale(1.015); }
.strip img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
.strip span { position: absolute; left: 8px; bottom: 8px; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #fff; background: rgba(0,0,0,.45); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); padding: 3px 8px; border-radius: 99px; }
.photos { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.photos a { position: relative; display: block; border-radius: 12px; overflow: hidden; aspect-ratio: 4 / 3; background: var(--well); }
.photos img { width: 100%; height: 100%; object-fit: cover; display: block; }
.photos span { position: absolute; left: 6px; bottom: 6px; font-size: 10.5px; font-weight: 600; color: #fff; background: rgba(0,0,0,.45); padding: 2px 6px; border-radius: 6px; }
.rows div b { text-align: right; }

/* Market list and route legend */
.comps { display: grid; gap: 2px; }
.comp { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-top: .5px solid var(--hair); font-size: 12.5px; }
.comp:first-child { border-top: 0; }
a.comp { position: relative; color: inherit; text-decoration: none; margin: 0 -8px; padding: 8px; border-top: 0; border-radius: 10px; transition: background .2s; }
/* A straight hairline between rows that doesn't bend with the hover's rounded corners */
a.comp + a.comp::before { content: ""; position: absolute; left: 8px; right: 8px; top: -1px; height: .5px; background: var(--hair); }
a.comp:hover::before, a.comp:hover + a.comp::before { opacity: 0; }
a.comp:hover { background: var(--well); }
a.comp:hover b { color: var(--blue, #0a66d8); }
.comp .go { display: grid; place-items: center; color: var(--ink3); font-style: normal; transition: color .2s, transform .3s var(--spring); }
a.comp:hover .go { color: var(--ink); transform: translate(1px, -1px); }
.comp b { display: block; font-weight: 600; color: var(--ink); }
.comp small { display: block; color: var(--ink2); font-size: 11.5px; margin-top: 1px; }
.comp > span:last-child { display: flex; align-items: center; gap: 6px; font-weight: 600; white-space: nowrap; }
.dchip { font-style: normal; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 8px; background: var(--well); color: var(--ink2); }
.dchip.green { color: var(--green-ink); background: color-mix(in srgb, var(--green) 15%, transparent); }
.dchip.red { color: var(--red-ink); background: color-mix(in srgb, var(--red) 13%, transparent); }
.legend { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; font-size: 11.5px; color: var(--ink2); }
.legend span { display: inline-flex; align-items: center; gap: 5px; }
.legend i { width: 10px; height: 4px; border-radius: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001s !important; animation-iteration-count: 1 !important; transition-duration: .001s !important; }
}
`;
