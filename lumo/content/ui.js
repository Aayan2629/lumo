// Lumo on the page: the dock, marks on the ad's words, edges on photos, the hover bubble and the panel.
//
// How the marks stay on the words when you scroll:
//  - Text marks are painted by the browser into the page's own text (CSS Custom Highlight API).
//    They are part of the text, so scrolling moves them with the words. Nothing to recalculate.
//  - Glows, photo edges and the price note sit in a layer positioned in page coordinates
//    (not screen coordinates), so they scroll with the page too. They are only re-measured when
//    the layout changes (resize, a gallery sliding, the page re-rendering).
//  - Only the dock and the panel are fixed to the screen, because they are controls, not marks.
(() => {
  const E = LUMO.esc, I = LUMO.icon, M = LUMO.money;
  const SEV = { red: 'Red flag', amber: 'Worth checking', green: 'Good sign', info: 'Good to know', grey: 'Not checked yet' };

  let host, root, $, layer, dock, panel, bubble, glowBox, chip;
  let D = null;                 // { L, F, checks, marks, state }
  let hover = null, raf = 0;
  let view = 'checks', detail = null, open = false, showGrey = false, marksOn = true;
  let chat = [], busy = false;
  let gen = 0;                  // bumped by destroy(), so an answer for an old page is dropped
  let dataReady = null, dataResolve = null;   // a question asked while Lumo is still reading waits on this
  let pos = {};                 // remembered dock and panel positions
  const edges = new Map();      // photo mark -> element

  const byId = (id) => D.checks.find((c) => c.id === id);
  const marksFor = (id) => [...D.marks.text, ...D.marks.photos].filter((m) => m.checks.includes(id));
  const gmaps = (L) => L.lat ? `https://www.google.com/maps/search/?api=1&query=${L.lat},${L.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(L.address || '')}`;
  const street = (L) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${L.lat},${L.lng}`;
  const trip = (h, p) => `https://www.google.com/maps/dir/?api=1&origin=${h.lat},${h.lng}&destination=${p.lat},${p.lng}&travelmode=transit`;

  // ---------- mount ----------
  function mount() {
    if (host) return;
    host = document.createElement('lumo-root');
    host.setAttribute('data-lumo-ui', '');
    host.style.cssText = 'position:absolute!important;left:0!important;top:0!important;width:0!important;height:0!important;z-index:2147483646!important;display:block!important;';
    root = host.attachShadow({ mode: 'closed' });
    // Constructed stylesheets are not blocked by a page's content security policy; fall back to <style>.
    let styleTag = '';
    try { const sh = new CSSStyleSheet(); sh.replaceSync(LUMO.CSS); root.adoptedStyleSheets = [sh]; } catch { styleTag = `<style>${LUMO.CSS}</style>`; }
    root.innerHTML = `${styleTag}
      <div class="ui">
        <div class="layer"></div>
        <div class="fixed" popover="manual">
          <div class="dock glass" role="button" tabindex="0" aria-label="Open Lumo">${LUMO.logo(30)}<span class="head"></span><span class="reading">Reading</span><span class="counts"></span></div>
          <section class="panel glass" role="dialog" aria-label="Lumo" aria-hidden="true"></section>
        </div>
      </div>`;
    $ = (s) => root.querySelector(s);
    $('.ui').classList.toggle('dark', pageIsDark());
    layer = $('.layer'); dock = $('.dock'); panel = $('.panel');
    bubble = document.createElement('div'); bubble.className = 'bubble glass'; layer.appendChild(bubble);
    glowBox = document.createElement('div'); layer.appendChild(glowBox);
    document.documentElement.appendChild(host);
    showTop();

    chrome.storage?.local.get('uipos').then((r) => { pos = r.uipos || {}; placeDock(); }).catch(() => placeDock());
    placeDock();
    draggable(dock, dock, 'dock', () => toggle(true));
    dock.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && toggle(true));
    for (const g of [dock, panel]) g.addEventListener('pointermove', (e) => {
      const r = g.getBoundingClientRect();
      g.style.setProperty('--mx', e.clientX - r.left + 'px'); g.style.setProperty('--my', e.clientY - r.top + 'px');
    });
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('click', onClick, true);
    addEventListener('scroll', schedule, { passive: true, capture: true });
    addEventListener('resize', onResize, { passive: true });
    addEventListener('keydown', onKey);
    LUMO._tick = setInterval(() => { reattach(); schedule(); }, 700);   // galleries slide without telling anyone
  }
  // The dock and panel live in the browser's top layer: no page z-index, overflow or transform can hide them.
  function showTop() { const f = root.querySelector('.fixed'); try { if (f.showPopover && !f.matches(':popover-open')) f.showPopover(); } catch {} }
  // Some sites re-render the whole document and drop foreign nodes. Put Lumo back.
  function reattach() { if (host && !host.isConnected) { document.documentElement.appendChild(host); showTop(); if (D) { LUMO.paint(D.marks); position(); } } }
  // A short message in the dock, e.g. when the icon is clicked off a listing.
  function note(text) {
    mount();
    dock.querySelector('.reading').style.display = 'none';
    dock.querySelector('.counts').innerHTML = '';
    const h = dock.querySelector('.head'); h.textContent = text; dock.classList.add('say');
    placeDock();
    setTimeout(() => { if (dock && !D) destroy(); }, 4000);
  }
  // While the mic is on, Esc stops it (content/voice.js) and must not close the panel.
  const onKey = (e) => { if (e.key === 'Escape' && open && !LUMO.voice?.listening) toggle(false); };
  const onResize = () => { placeDock(); if (open) placePanel(); schedule(); };

  function destroy() {
    if (!host) return;
    clearInterval(LUMO._tick);
    removeEventListener('pointermove', onMove); removeEventListener('click', onClick, true);
    removeEventListener('scroll', schedule, true); removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
    LUMO.voice?.reset();
    LUMO.unpaint(); host.remove(); host = null; edges.clear(); D = null; open = false; chat = []; busy = false; gen++; detail = null; view = 'checks'; chip = null;
  }

  // Is the page itself dark? Look at the first solid background from body upwards.
  function pageIsDark() {
    // Start from whatever sits where the panel will be, and walk up to the first solid background.
    let el = document.elementFromPoint(Math.max(0, innerWidth - 220), innerHeight / 2) || document.body;
    for (; el && el.nodeType === 1; el = el.parentElement) {
      if (el.closest && el.closest('[data-lumo-ui]')) continue;
      const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
      if (m && (m.length < 4 || +m[3] > 0.5)) return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 < 0.4;
    }
    return false;   // transparent all the way up means the browser's white
  }

  // ---------- moving things around ----------
  const clampTo = (el, x, y) => {
    const w = el.offsetWidth, h = el.offsetHeight;
    return [Math.max(8, Math.min(innerWidth - w - 8, x)), Math.max(8, Math.min(innerHeight - h - 8, y))];
  };
  function setPos(el, x, y) {
    [x, y] = clampTo(el, x, y);
    el.style.top = y + 'px';
    // On the right half, pin the dock by its right edge so it grows leftwards when it says the verdict.
    if (el === dock && x + el.offsetWidth / 2 > innerWidth / 2) { el.style.left = 'auto'; el.style.right = document.documentElement.clientWidth - x - el.offsetWidth + 'px'; }
    else { el.style.right = 'auto'; el.style.left = x + 'px'; }
  }
  function placeDock() {
    if (!dock) return;
    const p = pos.dock;
    // Remember the corner as a fraction of the window, so it stays in place when the window resizes.
    if (p) setPos(dock, p.fx * innerWidth - dock.offsetWidth / 2, p.fy * innerHeight - dock.offsetHeight / 2);
    else setPos(dock, innerWidth - dock.offsetWidth - 22, innerHeight - dock.offsetHeight - 22);
  }
  // Side page: Lumo docks to the right edge, full height, wider. Tap the corner button again to float.
  function sideWidth() { return Math.round(Math.min(Math.max(pos.sideW || Math.min(560, innerWidth * 0.42), 380), innerWidth - 24)); }
  function placeSide() {
    const w = sideWidth();
    Object.assign(panel.style, { width: w + 'px', height: innerHeight - 20 + 'px', top: '10px', left: innerWidth - w - 10 + 'px', right: 'auto' });
    panel.classList.add('side');
    sideGrips();
  }
  function setSide(on) {
    pos.side = on; savePos();
    panel.classList.add('morph');            // animate the size change
    if (on) placeSide(); else { panel.classList.remove('side'); if (!pos.size) { panel.style.width = ''; panel.style.height = ''; } placePanel(); }
    setTimeout(() => panel.classList.remove('morph'), 500);
    const bd = panel.querySelector('.body'), sc = bd ? bd.scrollTop : 0;
    setTimeout(() => { renderPanel(); const b2 = panel.querySelector('.body'); if (b2) b2.scrollTop = sc; }, 460);  // redraw charts at the new width
  }
  function placePanel() {
    if (pos.side) return placeSide();
    if (pos.size) { panel.style.width = Math.min(pos.size.w, innerWidth - 24) + 'px'; panel.style.height = Math.min(pos.size.h, innerHeight - 16) + 'px'; }
    const p = pos.panel, d = dock.getBoundingClientRect();
    if (p) setPos(panel, p.fx * innerWidth - panel.offsetWidth / 2, p.y);
    else {
      // Open from the dock: line up with whichever side of the screen it sits on.
      const right = d.left + d.width / 2 > innerWidth / 2;
      setPos(panel, right ? d.right - panel.offsetWidth + 8 : d.left - 8, d.bottom - panel.offsetHeight + 8);
    }
    sideGrips();
    const r = panel.getBoundingClientRect();
    panel.style.transformOrigin = `${d.left + d.width / 2 - r.left}px ${d.top + d.height / 2 - r.top}px`;
  }
  const savePos = () => { try { chrome.storage.local.set({ uipos: pos }); } catch {} };
  function draggable(el, handle, key, onTap) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (e.target.closest && e.target.closest('button,input,a,form') && e.target !== handle)) return;
      const b0 = el.getBoundingClientRect(), r = { left: b0.left, top: b0.top }, sx = e.clientX, sy = e.clientY;
      let moved = false;
      handle.setPointerCapture(e.pointerId);
      const mv = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        if (!moved && el === panel && pos.side) {
          pos.side = false; panel.classList.remove('side');
          if (pos.size) { panel.style.width = Math.min(pos.size.w, innerWidth - 24) + 'px'; panel.style.height = Math.min(pos.size.h, innerHeight - 16) + 'px'; }
          else { panel.style.width = ''; panel.style.height = ''; }
          r.x = sx - Math.min(sx - r.left, panel.offsetWidth - 60); r.y = sy - 20;
          const fb = panel.querySelector('.side'); if (fb) fb.innerHTML = I('expand', 15);
        }
        moved = true; el.classList.add('dragging');
        setPos(el, (r.x ?? r.left) + dx, (r.y ?? r.top) + dy);
      };
      const up = () => {
        handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        if (moved) {
          const b = el.getBoundingClientRect();
          pos[key] = key === 'dock' ? { fx: (b.left + b.width / 2) / innerWidth, fy: (b.top + b.height / 2) / innerHeight } : { fx: (b.left + b.width / 2) / innerWidth, y: b.top };
          savePos();
        } else if (onTap) onTap();
      };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
    });
  }

  function scanning() {
    mount();
    dock.querySelector('.reading').style.display = '';
    dock.querySelector('.counts').innerHTML = '';
  }

  // ---------- render ----------
  function render(data) {
    mount();
    D = data;
    if (dataResolve) { dataResolve(); dataResolve = dataReady = null; }
    if (marksOn) LUMO.paint(D.marks);
    // Dock
    const n = LUMO.counts(D.checks);
    dock.querySelector('.reading').style.display = 'none';
    dock.querySelector('.counts').innerHTML = ['red', 'amber', 'green'].filter((k) => n[k]).map((k) =>
      `<span class="count ${k}" title="${SEV[k]}"><i class="dot"></i><span class="num">${n[k]}</span></span>`).join('') || '<span class="count grey"><i class="dot"></i></span>';
    dock.setAttribute('aria-label', 'Lumo: ' + LUMO.verdict(D.checks) + '. Open details. Drag to move.');
    dock.querySelector('.head').textContent = LUMO.verdict(D.checks);
    placeDock();
    if (!D.rerender) { dock.classList.add('say'); setTimeout(() => { if (!dock) return; dock.classList.remove('say'); setTimeout(placeDock, 520); }, 3400); }
    // Photo edges
    for (const el of edges.values()) el.remove();
    edges.clear();
    if (D.state.settings.photoEdges !== false) for (const m of D.marks.photos) {
      const el = document.createElement('div');
      el.className = 'edge ' + m.level;
      const c = byId(m.checks[0]);
      el.innerHTML = `<span class="tag glass"><i class="dot"></i>${E(c.tag || c.title.split(' ').slice(0, 2).join(' '))}</span>`;
      layer.insertBefore(el, bubble);
      edges.set(m, el);
    }
    // A note pinned beside the price: what similar homes ask.
    chip?.remove(); chip = null;
    const inv = D.mode === 'invest';
    const pc = byId(inv ? 'value' : 'price'), pm = D.marks.text.find((m) => m.key === 'price');
    if (pc?.proof?.items && pm) {
      chip = document.createElement('div');
      chip.className = 'chip glass ' + pc.level;
      chip.innerHTML = inv ? `<i class="dot"></i>${LUMO.short(pc.proof.median)}<span>sold nearby</span>` : `<i class="dot"></i>${M(pc.proof.items[1].v)}<span>similar</span>`;
      chip.style.setProperty('--d', D.rerender ? '0s' : '1.4s');
      layer.insertBefore(chip, bubble);
    }
    position();
    if (!D.rerender && D.state.settings.introScan !== false && !LUMO.reduceMotion()) beam();
    if (open) renderPanel();
  }

  // The moment Lumo reads the ad: a soft beam of light passes down the page and each mark lights up as it's reached.
  function beam() {
    const ms = D.marks.text.filter((m) => LUMO.rangeAlive(m.target));
    if (!ms.length) return;
    const rs = ms.map((m) => ({ m, r: m.target.getBoundingClientRect() })).filter((x) => x.r.width);
    const top = Math.min(...rs.map((x) => x.r.top)) + scrollY, bottom = Math.max(...rs.map((x) => x.r.bottom)) + scrollY;
    const left = Math.min(...rs.map((x) => x.r.left)) + scrollX, right = Math.max(...rs.map((x) => x.r.right)) + scrollX;
    const span = bottom - top + 240, dur = Math.max(1100, Math.min(2400, span * 1.5));
    const b = document.createElement('div');
    b.className = 'beam';
    Object.assign(b.style, { left: left - 40 + 'px', width: right - left + 80 + 'px', top: top - 160 + 'px' });
    layer.insertBefore(b, bubble);
    b.animate([{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { transform: `translateY(${span}px)`, opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).onfinish = () => b.remove();
    for (const { m, r } of rs) setTimeout(() => flash(m), 200 + ((r.top + scrollY - top + 80) / span) * dur);
  }
  function flash(m, keep) {
    if (!host || !marksOn || !LUMO.rangeAlive(m.target)) return;
    const box = document.createElement('div');
    for (const r of rects(m.target)) {
      const g = document.createElement('div');
      g.className = 'glow ' + m.level + (keep ? ' on' : ' flash');
      place(g, r, 3, 2);
      box.appendChild(g);
    }
    layer.insertBefore(box, bubble);
    setTimeout(() => box.remove(), keep || 1050);
  }

  // ---------- geometry (page coordinates) ----------
  const rects = (range) => [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
  function place(el, r, px = 0, py = 0) {
    el.style.left = r.left + scrollX - px + 'px'; el.style.top = r.top + scrollY - py + 'px';
    el.style.width = r.width + px * 2 + 'px'; el.style.height = r.height + py * 2 + 'px';
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; position(); }); }
  function position() {
    if (!D) return;
    for (const [m, el] of edges) {
      const v = m.target.isConnected && LUMO.visibleRect(m.target);
      if (!v) { el.style.opacity = '0'; m.vr = null; continue; }
      m.vr = v;
      el.style.opacity = ''; el.style.borderRadius = v.radius && v.radius !== '0px' ? v.radius : '4px';
      place(el, v);
    }
    if (chip) {
      const pm = D.marks.text.find((m) => m.key === 'price');
      const el = D.L.regions.price;
      const rs = pm && LUMO.rangeAlive(pm.target) ? rects(pm.target) : [];
      if (rs.length) {
        // Sit just after the price line (after "per week" if it's there), centred on the line.
        const line = el && el.getBoundingClientRect();
        const r = rs[rs.length - 1];
        const x = Math.max(r.right, line ? Math.min(line.right, r.right + 400) : r.right);
        const textEnd = el ? lastTextRight(el, r) : r.right;
        chip.style.left = (textEnd || x) + 14 + scrollX + 'px';
        chip.style.top = r.top + r.height / 2 + scrollY + 'px';
        chip.style.display = '';
      } else chip.style.display = 'none';
    }
    if (hover) showHover(hover, true);
  }
  // Right edge of the text on the same line as the price (so the note never covers words).
  function lastTextRight(el, r0) {
    const range = document.createRange(); range.selectNodeContents(el);
    let right = r0.right;
    for (const r of range.getClientRects()) if (Math.abs(r.top + r.height / 2 - (r0.top + r0.height / 2)) < r0.height && r.right > right) right = r.right;
    return right;
  }

  // ---------- hover and click on marks ----------
  function hit(x, y) {
    if (!marksOn) return null;
    for (const m of D.marks.text) {
      if (!LUMO.rangeAlive(m.target)) continue;
      for (const r of m.target.getClientRects()) if (x >= r.left - 3 && x <= r.right + 3 && y >= r.top - 3 && y <= r.bottom + 3) return m;
    }
    for (const m of D.marks.photos) {
      const v = m.vr;
      if (v && x >= v.left && x <= v.left + v.width && y >= v.top && y <= v.top + v.height) return m;
    }
    return null;
  }
  function onMove(e) {
    if (!D) return;
    const m = e.composedPath().includes(host) ? null : hit(e.clientX, e.clientY);
    if (m !== hover) { hover = m; showHover(m); }
  }
  function showHover(m, reflow) {
    if (!m) { bubble.classList.remove('show'); glowBox.innerHTML = ''; for (const el of edges.values()) el.classList.remove('hot'); return; }
    for (const el of edges.values()) el.classList.remove('hot');
    glowBox.innerHTML = '';
    const c = byId(m.checks[0]);
    const extra = m.checks.length > 1 ? `<span class="more">+${m.checks.length - 1}</span>` : '';
    if (!reflow) bubble.innerHTML = `<i class="dot ${m.level}"></i><span>${E(c.line || c.title)}</span>${extra}`;
    bubble.className = 'bubble glass ' + m.level;
    let ax, ay, below = false;
    if (m.target instanceof Range) {
      const rs = rects(m.target);
      if (!rs.length) return;
      for (const r of rs) { const g = document.createElement('div'); g.className = 'glow on ' + m.level; place(g, r, 3, 2); glowBox.appendChild(g); }
      const r = rs[0];
      ax = r.left + r.width / 2; ay = r.top - 10;
      if (r.top < 64) { below = true; ay = rs[rs.length - 1].bottom + 10; }
    } else {
      const v = m.vr; if (!v) return;
      edges.get(m)?.classList.add('hot');
      ax = v.left + v.width / 2; ay = Math.max(v.top, 12) + 44; below = true;
    }
    const w = Math.min(300, bubble.offsetWidth || 260);
    ax = Math.max(16 + w / 2, Math.min(innerWidth - 16 - w / 2, ax));
    bubble.style.left = ax + scrollX + 'px'; bubble.style.top = ay + scrollY + 'px';
    bubble.classList.toggle('below', below);
    requestAnimationFrame(() => bubble.classList.add('show'));
  }
  function onClick(e) {
    if (!D || e.composedPath().includes(host)) return;
    const m = hit(e.clientX, e.clientY);
    if (!m) return;
    e.preventDefault(); e.stopPropagation();
    hover = null; showHover(null);
    openDetail(m.checks[0]);
  }

  // ---------- panel ----------
  function toggle(v) {
    open = v ?? !open;
    if (!open) LUMO.voice?.stop();
    if (open) { renderPanel(); placePanel(); }
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    dock.classList.toggle('hide', open);
    hover = null; showHover(null);
  }
  function openDetail(id) { detail = id; view = 'checks'; if (!open) toggle(true); else renderPanel(); }
  function setMarks(on) {
    marksOn = on;
    if (on) LUMO.paint(D.marks); else LUMO.unpaint();
    layer.classList.toggle('off', !on);
  }

  // Pull handles: drag the side to make the panel wider, the bottom to make it taller. Lumo remembers the size.
  // Resize from any side or corner. Each handle knows which edges it moves:
  // l/r = left/right side, b/t = bottom/top. Corners move two edges at once.
  const GRIPS = { l: 'ew', r: 'ew', b: 'ns', bl: 'nesw', br: 'nwse', tl: 'nwse', tr: 'nesw' };
  function addGrips() {
    if (panel.querySelector('.grip-e')) return;
    for (const [edges, cur] of Object.entries(GRIPS)) {
      const g = document.createElement('div');
      g.className = `grip-e g-${edges}`; g.dataset.edges = edges; g.style.cursor = cur + '-resize';
      panel.append(g);
      g.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        g.setPointerCapture(e.pointerId);
        const r = panel.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
        const maxW = Math.min(1100, innerWidth - 24), maxH = innerHeight - 16;
        panel.classList.add('dragging');
        const mv = (ev) => {
          const dx = ev.clientX - sx, dy = ev.clientY - sy;
          if (edges.includes('r')) panel.style.width = Math.max(340, Math.min(maxW, r.width + dx, innerWidth - 8 - r.left)) + 'px';
          if (edges.includes('l')) {
            const w = Math.max(340, Math.min(maxW, r.width - dx, r.right - 8));
            panel.style.width = w + 'px'; panel.style.left = r.right - w + 'px';
          }
          if (edges.includes('b')) panel.style.height = Math.max(420, Math.min(maxH, r.height + dy, innerHeight - 8 - r.top)) + 'px';
          if (edges.includes('t')) {
            const h = Math.max(420, Math.min(maxH, r.height - dy, r.bottom - 8));
            panel.style.height = h + 'px'; panel.style.top = r.bottom - h + 'px';
          }
        };
        const up = () => {
          g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up);
          panel.classList.remove('dragging');
          const b = panel.getBoundingClientRect();
          const widthChanged = Math.abs((pos.size?.w || 0) - b.width) > 30;
          if (pos.side) { pos.sideW = Math.round(b.width); placeSide(); }
          else {
            pos.size = { w: Math.round(b.width), h: Math.round(b.height) };
            pos.panel = { fx: (b.left + b.width / 2) / innerWidth, y: b.top };
          }
          savePos();
          // Charts are drawn to the panel's width, so redraw them at the new size.
          if (widthChanged && view === 'checks' && detail) { const sc = panel.querySelector('.body').scrollTop; renderPanel(); panel.querySelector('.body').scrollTop = sc; }
        };
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up);
      });
    }
  }
  function sideGrips() {}

  // Re-rendering rebuilds the chat box: keep what was typed (or dictated) in it.
  function renderPanel() {
    const draft = panel.querySelector('.composer input')?.value || '';
    draw();
    const inp = panel.querySelector('.composer input');
    if (inp && draft) { inp.value = draft; panel.querySelector('.composer .send').disabled = !draft.trim(); }
    LUMO.voice?.paint();
  }
  function draw() {
    if (!D) {
      // Opened before the data arrived: show that Lumo is working, never an empty panel.
      // From a voice shortcut the chat opens straight away; questions wait for the checks.
      const head = `<header class="top"><span class="grip"></span>${LUMO.logo(32)}<div class="addr"><b>Reading this home</b><span>Checking rent, noise, transport and more</span></div>
        <button class="round fold" aria-label="Minimise">${I('fold', 16)}</button></header>`;
      if (view === 'ask') {
        panel.innerHTML = head + `<div class="body">${askView()}</div>${composer()}`;
        wirePanel(); addGrips(); renderChat();
        return;
      }
      panel.innerHTML = head + `<div class="skel"><i></i><i></i><i></i><i></i><p>Usually a few seconds.</p></div>`;
      panel.querySelector('.fold').onclick = () => toggle(false);
      draggable(panel, panel.querySelector('.top'), 'panel');
      return;
    }
    const { L, checks, state } = D;
    const inv = D.mode === 'invest';
    const TABS = inv ? [['checks', 'Checks'], ['numbers', 'Numbers'], ['ask', 'Ask'], ['saved', 'Saved']] : [['checks', 'Checks'], ['ask', 'Ask Lumo'], ['saved', 'Saved']];
    if (!TABS.some(([k]) => k === view)) view = 'checks';
    const saved = (state.saved || []).some((s) => s.url === L.url);
    const parts = (L.address || '').split(',');
    const nSaved = (state.saved || []).length;
    const scroll = panel.querySelector('.body')?.scrollTop || 0;
    panel.innerHTML = `
      <header class="top" title="Drag to move">
        <span class="grip"></span>
        ${LUMO.logo(32)}
        <div class="addr"><b>${E(parts[0] || 'This home')}</b><span>${inv ? '<em class="badge">Investor</em>' : ''}${E(parts.slice(1).join(',').trim() || [L.beds && L.beds + ' bed', L.type].filter(Boolean).join(' · '))}</span></div>
        <button class="round heart ${saved ? 'on' : ''}" aria-label="${saved ? 'Saved' : 'Save this home'}" aria-pressed="${saved}">${I('heart', 16)}</button>
        <button class="round eye ${marksOn ? '' : 'dim'}" aria-label="${marksOn ? 'Hide marks on the page' : 'Show marks on the page'}" aria-pressed="${marksOn}">${I(marksOn ? 'eye' : 'eyeoff', 16)}</button>
        <button class="round side" aria-label="${pos.side ? 'Back to a floating window' : 'Open as a side page'}" title="${pos.side ? 'Float' : 'Side page'}">${I(pos.side ? 'shrink' : 'expand', 15)}</button>
        <button class="round fold" aria-label="Minimise">${I('fold', 16)}</button>
      </header>
      ${inv ? investHero() : hero()}
      <div class="seg" role="tablist" style="--n:${TABS.length}">
        <span class="thumb" style="transform:translateX(${TABS.findIndex(([k]) => k === view) * 100}%)"></span>
        ${TABS.map(([k, label]) => `<button role="tab" data-v="${k}" aria-selected="${view === k}">${label}${k === 'saved' && nSaved ? `<span class="n">${nSaved}</span>` : ''}</button>`).join('')}
      </div>
      <div class="body">${view === 'checks' ? (detail ? detailView(byId(detail)) : list(checks)) : view === 'numbers' ? numbersView() : view === 'ask' ? askView() : savedView()}</div>
      ${view === 'ask' ? composer() : foot()}`;
    wirePanel();
    if (view === 'numbers') wireNumbers();
    wireMaps(panel);
    addGrips(); sideGrips();
    if (view === 'ask') renderChat(); else if (!detail) panel.querySelector('.body').scrollTop = scroll;
  }

  function hero() {
    const { L, checks } = D;
    const price = checks.find((c) => c.id === 'price');
    const n = LUMO.counts(checks);
    const lv = n.red ? 'red' : n.amber ? 'amber' : 'green';
    const top = checks.filter((c) => (c.level === 'red' || c.level === 'amber') && !c.dup).slice(0, 2).map((c) => c.title.toLowerCase());
    const sub = top.length ? top.join(', ').replace(/^./, (x) => x.toUpperCase()) + (n.green ? ` · ${n.green} good sign${n.green > 1 ? 's' : ''}` : '') : n.green ? `${n.green} good signs` : 'Connect data to check this home';
    let meter = '';
    const bars = price?.proof?.items;
    if (bars && L.price) {
      const fair = bars[1].v, lo = Math.min(L.price, fair) * 0.9, hi = Math.max(L.price, fair) * 1.06;
      const p = (v) => ((v - lo) / (hi - lo)) * 100;
      const diff = L.price - fair;
      meter = `<div class="meter ${price.level}"><div class="track"><span class="fill" style="left:${Math.min(p(fair), p(L.price))}%;right:${100 - Math.max(p(fair), p(L.price))}%"></span>
        <span class="mk fair" style="left:${p(fair)}%"></span><span class="mk" style="left:${p(L.price)}%"></span></div>
        <div class="mlabels${Math.abs(p(fair) - p(L.price)) < 34 ? '' : ' under'}">${[[fair, 'Similar'], [L.price, 'This ad']].sort((a, b) => a[0] - b[0]).map(([v, t]) => `<span style="--x:${p(v)}%">${t} <b class="num">${M(v)}</b></span>`).join('')}</div>
        ${Math.abs(diff) >= 10 ? `<div class="year">${diff > 0 ? `${M(diff * 52)} a year more than similar homes` : `${M(-diff * 52)} a year less than similar homes`}</div>` : ''}</div>`;
    }
    const links = `<div class="links"><a class="link" href="${E(gmaps(L))}" target="_blank" rel="noopener">${G()}Google Maps</a>${L.lat ? `<a class="link" href="${E(street(L))}" target="_blank" rel="noopener">${I('street', 14)}Street View</a>` : ''}</div>`;
    // Real street photos (Mapillary) right under the verdict. Tap to see them big.
    const ph = D.F.photos || [];
    const strip = ph.length ? `<button class="strip" data-photos aria-label="See the street">${ph.slice(0, 4).map((x) => `<img src="${E(x.url)}" alt="">`).join('')}<span>${I('street', 12)}The street</span></button>` : '';
    return `<div class="hero ${lv}"><div class="verdict">${E(LUMO.verdict(checks))}<span class="sub">${E(sub)}</span></div>${meter}${links}${strip}</div>`;
  }

  function list(checks) {
    const shown = checks.filter((c) => c.level !== 'grey'), grey = checks.filter((c) => c.level === 'grey');
    const row = (c) => `<button class="row ${c.level}" data-id="${E(c.id)}"><i class="dot"></i><span class="t"><b>${E(c.title)}${c.sample ? '<em class="chip-s">SAMPLE</em>' : ''}</b><span>${E(c.line || '')}</span></span>${I('chev', 14)}</button>`;
    let html = '', lastLv = '';
    for (const c of shown) {
      if (c.level !== lastLv) { html += `<div class="group">${{ red: 'Red flags', amber: 'Worth checking', green: 'Good signs', info: 'For you' }[c.level]}</div>`; lastLv = c.level; }
      html += row(c);
    }
    if (grey.length) html += showGrey ? `<div class="group">Not checked yet</div>${grey.map(row).join('')}` : `<button class="more-grey">${grey.length} more need data</button>`;
    return `<div class="view">${html || '<div class="empty">Nothing to check on this page yet.</div>'}</div>`;
  }

  function detailView(c) {
    if (!c) return '';
    const quotes = marksFor(c.id).filter((m) => m.target instanceof Range).map((m) => m.target.toString().trim()).filter((t) => t && t.length < 60);
    const photo = marksFor(c.id).some((m) => !(m.target instanceof Range));
    return `<div class="view ${c.level}">
      <button class="back">${I('back', 15)}Checks</button>
      <div class="dtitle"><i class="dot"></i><h2>${E(c.title)}</h2></div>
      ${quotes.length || photo ? `<button class="quote" data-show="${E(c.id)}">${I('eye', 13)}${quotes.length ? '“' + E(quotes[0]) + '”' : 'On the photo'}</button>` : ''}
      <p class="line">${E(c.line || '')}</p>
      ${c.proof ? `<div class="card">${proof(c.proof, c.level)}</div>` : ''}
      <div class="pair">
        ${c.meaning ? `<div class="card"><div class="label">What it means</div><p class="para">${E(c.meaning)}</p></div>` : ''}
        ${c.next ? `<div class="card"><div class="label">Next step</div><p class="para">${E(c.next)}</p></div>` : ''}
      </div>
      ${(c.questions || []).length ? `<div class="qs">${c.questions.map((q) => `<button class="q">${E(q)}</button>`).join('')}</div>` : ''}
      <p class="src">${E(SEV[c.level])}${c.finding ? ' · Check ' + c.finding : ''}${c.sources.length ? ' · ' + E(c.sources.filter(Boolean).join(', ')) : ''}</p>
    </div>`;
  }

  // ---------- proof visuals ----------
  function proof(p) {
    if (p.kind === 'bars') {
      const max = Math.max(...p.items.map((i) => i.v || 0));
      const fmt = p.fmt === 'pct' ? LUMO.pct : M;
      return `<div class="bars">${p.items.map((i) => `<div class="bar ${i.me ? 'me' : ''}"><span>${E(i.label)}</span><i style="width:${(i.v / max) * 100}%"></i><b class="num">${fmt(i.v)}</b></div>`).join('')}</div>
        ${p.note ? `<p class="src" style="margin:12px 0 0">${E(p.note)}</p>` : ''}
        ${p.rows && p.rows.length ? `<div class="rows">${p.rows.map((r) => `<div><span>${E(r[0])}</span><b class="num">${E(r[1])}</b></div>`).join('')}</div>` : ''}`;
    }
    if (p.kind === 'history') {
      const max = Math.max(...p.rows.map((r) => r.price || 0)) || 1;
      const big = max > 20000, f = big ? LUMO.short : M;
      return `<div class="label">${E(p.title || 'Rent history')}</div><div class="hist">${p.rows.map((r) => `<div><span class="num">${E(new Date(r.date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }))}${r.label ? `<small>${E(r.label)}</small>` : ''}</span><i style="width:${((r.price || 0) / max) * 100}%"></i><b class="num">${r.price ? f(r.price) : 'Listed'}</b></div>`).join('')}</div>`;
    }
    if (p.kind === 'commute') {
      const c = p.place, h = p.home;
      return `<div class="trip"><div class="mins num">${c.minutes}<small>min</small></div><div class="to">to ${E(c.name)}<br>${c.days || 3} days a week</div>
        <div class="route"><i></i><span></span><i></i></div></div>
        ${h && c.lat ? `<div class="links"><a class="link" href="${E(trip(h, c))}" target="_blank" rel="noopener">${G()}Open trip in Google Maps</a></div>` : ''}`;
    }
    if (p.kind === 'map') return map(p);
    if (p.kind === 'market') return market(p);
    if (p.kind === 'route') return route(p);
    if (p.kind === 'das') return dasView(p);
    if (p.kind === 'cash') return cashView(p.model, p.upfront);
    if (p.kind === 'growth') return growthView(p);
    if (p.kind === 'photos') return `<div class="photos">${p.photos.map((x) => `<a href="${E(x.link)}" target="_blank" rel="noopener"><img src="${E(x.url)}" alt="Street photo"><span>${E(x.date)}</span></a>`).join('')}</div><p class="src" style="margin:8px 0 0">Photos from Mapillary, taken by people walking and driving past.</p>`;
    return '';
  }

  // The rent market: every similar home as a dot, the median line, and this ad. Cheaper homes are green.
  function market(p) {
    if (p.sale) return saleMarket(p);
    const vals = [...(p.prices || []), p.me, p.median].filter(Number.isFinite);
    if (vals.length < 3) return '';
    // Draw at the width the panel really has, so text keeps its size when the panel is resized.
    const W = Math.round(Math.max(300, Math.min(780, (pos.size ? Math.min(pos.size.w, innerWidth - 24) : panel?.clientWidth || 400) - 74))), H = 124;
    const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03;
    const x = (v) => 16 + ((v - lo) / (hi - lo)) * (W - 32);
    const stack = {};
    const dots = (p.prices || []).slice().sort((a, b) => a - b).map((v) => {
      const bx = Math.round(x(v) / 10); const k = (stack[bx] = (stack[bx] || 0) + 1);
      // Homes below the similar price sit in the green (good value) side, above it in the red side.
      return `<circle cx="${x(v)}" cy="${66 - (k - 1) * 10}" r="4.5" fill="${v <= p.median ? 'var(--green)' : 'var(--red)'}" opacity=".38"/>`;
    }).join('');
    const lvl = p.me > p.median * 1.03 ? 'var(--red)' : p.me < p.median * 0.97 ? 'var(--green)' : 'var(--amber)';
    const xm = x(p.median), xa = x(p.me);
    const anchor = (xx) => (xx < 80 ? 'start' : xx > W - 80 ? 'end' : 'middle');
    const tx = (xx) => (xx < 80 ? Math.max(4, xx - 8) : xx > W - 80 ? Math.min(W - 4, xx + 8) : xx);
    const lowP = Math.min(...p.prices), highP = Math.max(...p.prices);
    // The cheapest and dearest labels sit at the ends of the line, unless "This ad" is already there.
    const ends = [[x(lowP), lowP, 'start', 16], [x(highP), highP, 'end', W - 16]]
      .filter(([xx]) => Math.abs(xx - xa) > 70)
      .map(([, v, an, at]) => `<text x="${at}" y="100" text-anchor="${an}" style="opacity:.6">${M(v)}</text>`).join('');
    // Two zones split at the similar price: light green = good value, light red = paying more.
    const f = (xx) => Math.max(0, Math.min(100, (xx / W) * 100)).toFixed(1);
    const gid = 'z' + Math.round(Math.random() * 1e6);
    const zones = `<defs><linearGradient id="${gid}" x1="0" x2="${W}" y1="0" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="${f(xm - 14)}%" stop-color="var(--green)"/><stop offset="${f(xm + 14)}%" stop-color="var(--red)"/></linearGradient></defs>
      <rect x="16" y="22" width="${W - 32}" height="58" rx="10" fill="url(#${gid})" opacity=".09"/>
      <line x1="16" x2="${W - 16}" y1="80" y2="80" stroke="url(#${gid})" stroke-width="4" stroke-linecap="round" opacity=".55"/>
      ${xm - 16 > 72 ? `<text x="${(16 + xm) / 2}" y="36" text-anchor="middle" style="fill:var(--green-ink);font-weight:600">Good value</text>` : ''}
      ${W - 16 - xm > 80 ? `<text x="${(xm + W - 16) / 2}" y="36" text-anchor="middle" style="fill:var(--red-ink);font-weight:600">Paying more</text>` : ''}`;
    const svg = `<svg class="mkt" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Rents of similar homes">
      ${zones}
      ${dots}
      <line x1="${xm}" x2="${xm}" y1="18" y2="84" stroke="var(--ink3)" stroke-dasharray="3 3"/>
      <text x="${tx(xm)}" y="12" text-anchor="${anchor(xm)}">Similar ${M(p.median)}</text>
      ${ends}
      <circle cx="${xa}" cy="80" r="13" fill="${lvl}" opacity=".14"/>
      <circle cx="${xa}" cy="80" r="7" fill="#fff" stroke="${lvl}" stroke-width="3.5"/>
      <text x="${tx(xa)}" y="${H - 6}" text-anchor="${anchor(xa)}" style="font-weight:700;fill:var(--ink)">This ad ${M(p.me)}</text>
    </svg>`;
    const rows = (p.comps || []).slice(0, 5).map((c) => {
      const diff = c.price - p.me;
      const chip = Math.abs(diff) < 5 ? '<em class="dchip">same</em>' : `<em class="dchip ${diff < 0 ? 'green' : 'red'}">${diff < 0 ? '−' : '+'}${M(Math.abs(diff))}</em>`;
      return `<div class="comp"><span><b>${E(c.address || 'Similar home')}</b><small>${c.d != null ? LUMO.dist(c.d) + ' away · ' : ''}${c.park ? 'with car space' : 'no car space'}</small></span><span class="num">${M(c.price)}${chip}</span></div>`;
    }).join('');
    return `<div class="label">${(p.prices || []).length} homes asking nearby</div>${svg}
      <p class="src" style="margin:6px 0 0">Each dot is a similar home asking now. Left of the line is good value, right is paying more. ${E(p.note || '')}</p>
      ${rows ? `<div class="label" style="margin-top:14px">Closest similar homes</div><div class="comps">${rows}</div>` : ''}`;
  }

  // A real walking route. At night: lit stretches glow gold, dark ones are red, street lights are little glows.
  function route(p) {
    const r = p.route, h = p.home, to = p.to;
    if (!r?.line?.length || !h) return '';
    const frame = mapFrame({ home: h, to: to?.lat ? { name: to.name, lat: to.lat, lng: to.lng } : null, label: p.label, line: r.line, night: !!p.night,
      samples: p.night ? (r.samples || []).map(({ lat, lng, s }) => ({ lat, lng, s })) : null, lamps: p.night ? r.lamps || [] : null }, p.night ? 260 : 240);
    const rows = p.rows?.length ? `<div class="rows">${p.rows.map((x) => `<div><span>${E(x[0])}</span><b class="num">${E(x[1])}</b></div>`).join('')}</div>` : '';
    const gm = to?.lat ? `<div class="links"><a class="link" href="${E(`https://www.google.com/maps/dir/?api=1&origin=${h.lat},${h.lng}&destination=${to.lat},${to.lng}&travelmode=${p.mode || 'walking'}`)}" target="_blank" rel="noopener">${G()}Walk it in Google Maps</a></div>` : '';
    return frame + rows + gm;
  }


  // A real map (Leaflet + CARTO/OpenStreetMap tiles) in an iframe. The iframe is an extension page,
  // so the listing site's security rules can't block it. The panel sends what to draw by postMessage.
  const MAPS = new Map();
  let mapSeq = 0;
  function mapFrame(payload, h = 240) {
    const id = 'm' + ++mapSeq;
    MAPS.set(id, payload);
    return `<iframe class="lmap ${h > 250 ? 'tall' : ''}" data-map="${id}" src="${chrome.runtime.getURL('map/map.html')}" title="Map, drag to move, pinch or scroll to zoom"></iframe>`;
  }
  function wireMaps(scope) {
    scope.querySelectorAll('.da[data-pin]').forEach((b) => (b.onclick = () => {
      const f = b.closest('.card, .viz')?.querySelector('iframe.lmap');
      f?.contentWindow?.postMessage({ type: 'lumo-map-focus', i: +b.dataset.pin }, '*');
      b.parentElement.querySelectorAll('.da').forEach((x) => x.classList.toggle('on', x === b));
    }));
    scope.querySelectorAll('iframe.lmap').forEach((f) => {
      const send = () => f.contentWindow && f.contentWindow.postMessage({ type: 'lumo-map', p: MAPS.get(f.dataset.map) }, '*');
      f.addEventListener('load', send);
      f._send = send;
    });
  }
  addEventListener('message', (e) => {
    if (e.data?.type !== 'lumo-map-ready' || !panel) return;
    panel.querySelectorAll('iframe.lmap').forEach((f) => { if (f.contentWindow === e.source) f._send?.(); });
  });

  function map(p) {
    const rowsHtml = (list) => `<div class="rows">${list.map((r) => `<div><span>${E(r[0])}</span><b>${E(r[1])}</b></div>`).join('')}</div>`;
    const sorted = p.points.slice().sort((a, b) => a.d - b.d);
    const rows = p.rows ? rowsHtml(p.rows) : sorted.length > 1 ? rowsHtml(sorted.slice(0, 4).map((x) => [x.name, LUMO.dist(x.d)]).concat(sorted.length > 4 ? [[`and ${sorted.length - 4} more`, '']] : [])) : '';
    if (!p.home) return rowsHtml(sorted.map((x) => [x.name, LUMO.dist(x.d)]));
    const one = sorted.length === 1 && sorted[0].lat ? `<div class="links"><a class="link" href="${E(`https://www.google.com/maps/dir/?api=1&origin=${p.home.lat},${p.home.lng}&destination=${sorted[0].lat},${sorted[0].lng}&travelmode=walking`)}" target="_blank" rel="noopener">${G()}Walk it in Google Maps</a></div>` : '';
    return mapFrame({ home: p.home, ring: p.ring, points: p.points.map(({ name, lat, lng, d, kind, info }) => ({ name, lat, lng, d, kind, info })) }) + rows + one;
  }

  // Building work near the home: a map plus one card per project. A stack of bars shows the storeys,
  // the colour shows the impact (same colours as the map dots). Tap a card to fly the map to it.
  // Google's own G on links that open Google Maps, so it's clear where the tap goes.
  function G() { return `<img class="glogo" src="${chrome.runtime.getURL('icons/google.png')}" alt="" width="14" height="14">`; }

  function dasView(p) {
    const items = p.items.slice().sort((a, b) => ({ red: 0, amber: 1, grey: 2 }[a.impact] - { red: 0, amber: 1, grey: 2 }[b.impact]) || a.d - b.d);
    const frame = mapFrame({ home: p.home, ring: p.ring, points: items.map((x) => ({ name: x.name, lat: x.lat, lng: x.lng, d: x.d, kind: 'da-' + x.impact, info: `${x.storeys ? x.storeys + ' storeys · ' : ''}${x.what} · ${x.state} ${x.year}` })) });
    const tile = (x) => {
      const [n, label] = x.storeys ? [x.storeys, x.storeys === 1 ? 'storey' : 'storeys'] : x.dwellings ? [x.dwellings, x.dwellings === 1 ? 'home' : 'homes'] : ['', 'site'];
      const h = Math.max(10, Math.min(100, (x.storeys || 1) * 12));
      return `<span class="tile" style="--h:${h}%"><b>${n}</b><small>${label}</small></span>`;
    };
    const cards = items.map((x, i) => `<button class="da ${x.impact}" data-pin="${i}">
        ${tile(x)}
        <span class="mid"><b>${E(x.name)}</b><span>${E(x.what)}${x.suburb ? ' · ' + E(x.suburb) : ''}</span></span>
        <span class="end"><em class="state ${x.state === 'Approved' ? 'ok' : ''}">${E(x.state)}</em><span class="num">${LUMO.dist(x.d)}</span></span>
      </button>`).join('');
    const key = `<div class="dakey"><span class="red"><i></i>Big and close</span><span class="amber"><i></i>Big or close</span><span class="grey"><i></i>Smaller</span></div>`;
    return frame + key + `<div class="das">${cards}</div>`;
  }

  // ================= Investor mode =================
  const SH = (n) => LUMO.short(n);
  const signed = (n) => (n >= 0 ? '+' : '−') + M(Math.abs(n));
  let numPrice = null;                       // a price the investor tried in Numbers (not saved)
  const invSet = () => ({ ...LUMO.investDefaults, ...(D.state.profile.invest || {}) });
  const invModel = (o = {}) => LUMO.investModel(D.L, D.F, D.state.profile, { ...(numPrice ? { price: numPrice } : {}), ...o });

  // Score ring: one number out of 100, drawn as a ring that fills in.
  function ring(score) {
    const r = 25, c = 2 * Math.PI * r, lv = score >= 70 ? 'green' : score >= 50 ? 'amber' : 'red';
    return `<div class="ring ${lv}" role="img" aria-label="Lumo score ${score} out of 100"><svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="${r}" class="ring-bg"/><circle cx="32" cy="32" r="${r}" class="ring-fg${D.ringShown ? ' still' : ''}" style="--c-len:${c.toFixed(1)};--c-off:${(c * (1 - score / 100)).toFixed(1)}"/></svg>
      <b class="num">${score}</b><small>score</small></div>`;
  }

  function investHero() {
    const { L, F, checks } = D;
    const model = invModel(), V = F.inv?.value || {};
    const sc = LUMO.investScore(L, F, model);
    const n = LUMO.counts(checks);
    const lv = n.red ? 'red' : n.amber ? 'amber' : 'green';
    const top = checks.filter((c) => (c.level === 'red' || c.level === 'amber') && !c.dup).slice(0, 2).map((c) => c.title.toLowerCase());
    const sub = top.length ? top.join(', ').replace(/^./, (x) => x.toUpperCase()) : n.green ? `${n.green} good signs` : 'Connect data to check this home';
    const tiles = model ? `<div class="ktiles">
        <div class="kt"><span>Rent</span><b class="num">${model.rent ? M(model.rent) : '—'}</b><small>a week</small></div>
        <div class="kt"><span>Yield</span><b class="num">${model.gross != null ? LUMO.pct(model.gross) : '—'}</b><small>gross</small></div>
        <div class="kt ${model.rent ? (model.weekly >= 0 ? 'pos' : 'neg') : ''}" data-o="tileWeekly"><span>Each week</span><b class="num">${model.rent ? signed(Math.round(model.weekly)) : '—'}</b><small>after loan</small></div>
      </div>` : '';
    // Price against value: the valuation range as a band, the value as a tick, the ad's price as the marker.
    let vm = '';
    const ask = L.sale && L.sale.kind !== 'hidden' ? (L.sale.kind === 'range' ? L.sale.low : L.sale.price) : null;
    if (V.mid) {
      const band = V.avm ? [V.avm.low, V.avm.high] : [V.low, V.high];
      const pts = [V.mid, ask, ...band].filter(Number.isFinite);
      const lo = Math.min(...pts) * 0.96, hi = Math.max(...pts) * 1.04, x = (v) => ((v - lo) / (hi - lo)) * 100;
      const vl = byId('value')?.level || 'grey';
      vm = `<div class="vmeter ${vl}"><div class="track">
          ${band[0] && band[1] ? `<span class="band" style="left:${x(band[0])}%;right:${100 - x(band[1])}%"></span>` : ''}
          <span class="mk fair" style="left:${x(V.mid)}%"></span>${ask ? `<span class="mk" style="left:${x(ask)}%"></span>` : ''}</div>
        <div class="mlabels under">${[[V.mid, 'Value'], ask && [ask, L.sale.kind === 'fixed' ? 'Asks' : 'Guide']].filter(Boolean).sort((a, b) => a[0] - b[0]).map(([v, t2], i, arr) => `<span style="--x:${arr.length > 1 && Math.abs(x(arr[0][0]) - x(arr[1][0])) < 30 ? (i ? 100 : 0) : x(v)}%">${t2} <b class="num">${SH(v)}</b></span>`).join('')}</div></div>`;
    }
    const links = `<div class="links"><a class="link" href="${E(gmaps(L))}" target="_blank" rel="noopener">${G()}Google Maps</a>${L.lat ? `<a class="link" href="${E(street(L))}" target="_blank" rel="noopener">${I('street', 14)}Street View</a>` : ''}<button class="link" data-goto="numbers">${I('chart', 14)}Numbers</button></div>`;
    setTimeout(() => { if (D) D.ringShown = true; }, 1300);   // the ring fills in once, not on every tab switch
    return `<div class="hero ihero ${lv}">
      <div class="ihead">${sc.total != null ? ring(sc.total) : ''}<div class="verdict">${E(n.red ? `${n.red} red flag${n.red > 1 ? 's' : ''} in the ad` : LUMO.verdict(checks))}<span class="sub">${E(sub)}</span></div></div>
      ${tiles}${vm}${links}</div>`;
  }

  // Each week: money in and out, as bars. Used in Numbers and in check details.
  function flowRows(m) {
    const rows = [['Rent', m.rent || 0, 'in'], ['Loan', -m.loanWeek, 'loan'], ...m.costs.map((c) => [c.label, -c.yearly / 52, 'cost', c.note])];
    const max = Math.max(...rows.map((r) => Math.abs(r[1]))) || 1;
    return rows.map(([label, v, k, note]) => `<div class="fl ${k}" ${note ? `title="${E(note)}"` : ''}><span>${E(label)}</span><i style="--w:${(Math.abs(v) / max) * 100}%"></i><b class="num">${v >= 0 ? '+' : '−'}${M(Math.abs(Math.round(v)))}</b></div>`).join('');
  }
  function upfrontRows(m) {
    const u = m.upfront;
    return `<div class="rows"><div><span>Deposit (${m.set.deposit}%)</span><b class="num">${M(u.deposit)}</b></div><div><span>Stamp duty (NSW)</span><b class="num">${M(u.duty)}</b></div>
      <div><span>Legal, inspections, fees</span><b class="num">${M(u.other)}</b></div><div class="total"><span>Cash to buy</span><b class="num">${M(u.total)}</b></div></div>
      ${u.lmi ? '<p class="src" style="margin:8px 0 0">Under 20% down, most lenders add mortgage insurance (LMI) on top.</p>' : ''}`;
  }
  function cashView(m, upfront) {
    if (!m) return '';
    if (upfront) return `<div class="label">Cash to buy at ${SH(m.price)}</div>${upfrontRows(m)}`;
    return `<div class="label">Each week at ${SH(m.price)}</div><div class="flow">${flowRows(m)}</div>
      <div class="net ${m.weekly >= 0 ? 'pos' : 'neg'}"><span>Left over</span><b class="num">${signed(Math.round(m.weekly))}</b></div>`;
  }
  function growthView(p) {
    const g = p.g, rows = [['1 yr', g['1yr']], ['3 yrs', g['3yr']], ['5 yrs', g['5yr']], ['10 yrs', g['10yr']]].filter((r) => r[1] != null);
    const max = Math.max(...rows.map((r) => Math.abs(r[1]))) || 1;
    const f = p.forecast;
    return `<div class="label">${E(p.sub)} ${E(p.mt)} prices</div><div class="growth">${rows.map(([k, v]) => `<div class="gr ${v < 0 ? 'down' : ''}"><span>${k}</span><i style="--w:${(Math.abs(v) / max) * 100}%"></i><b class="num">${v >= 0 ? '+' : ''}${LUMO.pct(v)}</b></div>`).join('')}</div>
      ${f ? `<div class="fc"><span>Next 12 months</span><div class="fcbar"><i style="left:${Math.max(0, (f.low + 0.05) / 0.25 * 100)}%;right:${Math.max(0, 100 - (f.high + 0.05) / 0.25 * 100)}%"></i><b style="left:${(f.most_likely + 0.05) / 0.25 * 100}%"></b></div><em class="num">${LUMO.pct(f.low)} to ${LUMO.pct(f.high)}</em></div>` : ''}`;
  }

  // Numbers: the investor's weekly sum, live. Drag a slider and every figure updates.
  function numbersView() {
    const m = invModel();
    if (!m) return `<div class="view empty"><div><b>No price to work with</b>Lumo needs a price or a value for this home.</div></div>`;
    const s = m.set, base = LUMO.investModel(D.L, D.F, D.state.profile).price;
    const sc = LUMO.investScore(D.L, D.F, m);
    const lo = Math.round((base * 0.7) / 5000) * 5000, hi = Math.round((base * 1.3) / 5000) * 5000;
    return `<div class="view nums">
      <div class="card cashcard">
        <div class="label">Each week</div>
        <div class="bignum num ${m.weekly >= 0 ? 'pos' : 'neg'}" data-o="weekly">${signed(Math.round(m.weekly))}</div>
        <p class="hint" data-o="weeklySub">${m.weekly >= 0 ? 'Rent covers the loan and costs.' : 'You top up each week, before any tax refund.'}</p>
        <label class="ctl"><span>Price</span><b class="num" data-o="price">${SH(m.price)}</b><input type="range" data-i="price" min="${lo}" max="${hi}" step="5000" value="${Math.round(m.price / 5000) * 5000}" aria-label="Price"></label>
        <p class="hint tight" data-o="priceBasis">Starts at ${E(m.priceBasis)}.</p>
        <label class="ctl"><span>Deposit</span><b class="num" data-o="deposit">${s.deposit}%</b><input type="range" data-i="deposit" min="5" max="60" step="5" value="${s.deposit}" aria-label="Deposit"></label>
        <label class="ctl"><span>Interest rate</span><b class="num" data-o="rate">${(+s.rate).toFixed(2)}%</b><input type="range" data-i="rate" min="3" max="9.5" step="0.05" value="${s.rate}" aria-label="Interest rate"></label>
        <div class="pills" role="radiogroup" aria-label="Loan type"><button role="radio" data-io="1" aria-checked="${!!s.io}">Interest only</button><button role="radio" data-io="0" aria-checked="${!s.io}">Principal and interest</button></div>
        <div class="flow" data-o="flow">${flowRows(m)}</div>
        <p class="src tight">Rent: ${E(m.rentBasis || 'not estimated')}. Hover a cost to see where it comes from.</p>
      </div>
      <div class="card"><div class="label">Return</div><div class="rets" data-o="rets">${retsHTML(m)}</div></div>
      <div class="card"><div data-o="upfront">${cashView(m, true)}</div></div>
      ${sc.total != null ? `<div class="card"><div class="label">Lumo score <b class="num" data-o="score">${sc.total}</b></div><div class="parts" data-o="parts">${partsHTML(sc)}</div></div>` : ''}
      ${D.F.inv?.market?.growth ? `<div class="card">${growthView({ g: D.F.inv.market.growth, forecast: D.F.inv.market.forecast, mt: D.F.inv.mt, sub: D.F.suburb || D.L.suburb || 'Suburb' })}</div>` : ''}
      <p class="src">Estimates from the data shown, with typical costs where the ad gives none. Not financial advice. Stamp duty at NSW 2026–27 rates.</p>
    </div>`;
  }
  function retsHTML(m) {
    const sy = D.F.inv?.market?.yield;
    const items = [['Gross yield', m.gross], ['After costs', m.net], sy && ['Suburb gross', sy]].filter(Boolean);
    return items.map(([k, v]) => `<div><span>${k}</span><b class="num">${v != null ? LUMO.pct(v) : '—'}</b></div>`).join('');
  }
  function partsHTML(sc) {
    return sc.parts.map((p) => `<div class="part ${p.score >= 70 ? 'green' : p.score >= 45 ? 'amber' : 'red'}"><span>${E(p.label)}<small>${E(p.why)}</small></span><i style="--w:${p.score}%"></i><b class="num">${p.score}</b></div>`).join('');
  }
  function wireNumbers() {
    const root2 = panel.querySelector('.nums');
    if (!root2) return;
    const val = (k) => root2.querySelector(`[data-i="${k}"]`);
    const out = (k) => root2.querySelector(`[data-o="${k}"]`);
    let io = invSet().io;
    const read = () => ({ deposit: +val('deposit').value, rate: +val('rate').value, io });
    const update = () => {
      numPrice = +val('price').value;
      const m = invModel(read());
      out('price').textContent = SH(m.price);
      out('priceBasis').textContent = numPrice ? 'Your price. Lumo started at the value of similar sales or the ad.' : '';
      out('deposit').textContent = m.set.deposit + '%';
      out('rate').textContent = (+m.set.rate).toFixed(2) + '%';
      const w = out('weekly'); w.textContent = signed(Math.round(m.weekly)); w.className = 'bignum num ' + (m.weekly >= 0 ? 'pos' : 'neg');
      out('weeklySub').textContent = m.weekly >= 0 ? 'Rent covers the loan and costs.' : 'You top up each week, before any tax refund.';
      out('flow').innerHTML = flowRows(m);
      out('rets').innerHTML = retsHTML(m);
      out('upfront').innerHTML = cashView(m, true);
      const sc = LUMO.investScore(D.L, D.F, m);
      if (out('score')) { out('score').textContent = sc.total; out('parts').innerHTML = partsHTML(sc); }
      const tile = panel.querySelector('[data-o="tileWeekly"]');
      if (tile && m.rent) { tile.className = 'kt ' + (m.weekly >= 0 ? 'pos' : 'neg'); tile.querySelector('b').textContent = signed(Math.round(m.weekly)); }
    };
    // Keep the investor's own deposit, rate and loan type for every home.
    const persist = async () => {
      const inv = { ...invSet(), ...read() };
      D.state.profile.invest = inv;
      await LUMO.send('setInvest', { invest: inv });
      D.checks = LUMO.investRules(D.L, D.F, D.state.profile, D.claims);
    };
    // The track fills up to the thumb, so the setting reads at a glance.
    const fill = (r) => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
    root2.querySelectorAll('input[type=range]').forEach((r) => { fill(r); r.oninput = () => { fill(r); update(); }; r.onchange = persist; });
    root2.querySelectorAll('[data-io]').forEach((b) => (b.onclick = () => {
      io = b.dataset.io === '1';
      root2.querySelectorAll('[data-io]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      update(); persist();
    }));
  }

  // Sold prices of similar homes as dots, the valuation range as a band, and the ad's price.
  function saleMarket(p) {
    const vals = [...(p.prices || []), p.me, p.median, ...(p.band || [])].filter(Number.isFinite);
    if (vals.length < 2) return '';
    const W = Math.round(Math.max(300, Math.min(780, (pos.size ? Math.min(pos.size.w, innerWidth - 24) : panel?.clientWidth || 400) - 74))), H = 124;
    const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03;
    const x = (v) => 16 + ((v - lo) / (hi - lo)) * (W - 32);
    const stack = {};
    const dots = (p.prices || []).slice().sort((a, b) => a - b).map((v) => {
      const bx = Math.round(x(v) / 10); const k = (stack[bx] = (stack[bx] || 0) + 1);
      return `<circle cx="${x(v)}" cy="${66 - (k - 1) * 10}" r="4.5" fill="var(--ink2)" opacity=".32"/>`;
    }).join('');
    const anchor = (xx) => (xx < 80 ? 'start' : xx > W - 80 ? 'end' : 'middle');
    const tx = (xx) => (xx < 80 ? Math.max(4, xx - 8) : xx > W - 80 ? Math.min(W - 4, xx + 8) : xx);
    const xm = x(p.median);
    const band = p.band && p.band[0] ? `<rect x="${x(p.band[0])}" y="74" width="${Math.max(2, x(p.band[1]) - x(p.band[0]))}" height="12" rx="6" fill="var(--blue)" opacity=".14"/>
      <text x="${(x(p.band[0]) + x(p.band[1])) / 2}" y="100" text-anchor="middle" style="opacity:.7">Valuation range</text>` : '';
    const lvl = p.me == null ? null : p.me > p.median * 1.04 ? 'var(--red)' : p.me < p.median * 0.92 ? 'var(--red)' : p.me < p.median * 0.97 ? 'var(--amber)' : 'var(--green)';
    const me = p.me == null ? '' : `<circle cx="${x(p.me)}" cy="80" r="13" fill="${lvl}" opacity=".14"/><circle cx="${x(p.me)}" cy="80" r="7" fill="#fff" stroke="${lvl}" stroke-width="3.5"/>
      <text x="${tx(x(p.me))}" y="${H - 6}" text-anchor="${anchor(x(p.me))}" style="font-weight:700;fill:var(--ink)">This ad ${SH(p.me)}</text>`;
    const svg = `<svg class="mkt" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Sale prices of similar homes">
      <line x1="16" x2="${W - 16}" y1="80" y2="80" stroke="var(--hair)" stroke-width="4" stroke-linecap="round"/>
      ${band}${dots}
      <line x1="${xm}" x2="${xm}" y1="18" y2="86" stroke="var(--ink3)" stroke-dasharray="3 3"/>
      <text x="${tx(xm)}" y="12" text-anchor="${anchor(xm)}">Value ${SH(p.median)}</text>
      ${me}</svg>`;
    const rows = (p.comps || []).slice(0, 5).map((c) => {
      const diff = p.me != null ? c.price - p.me : null;
      const chip = diff == null ? '' : Math.abs(diff) < 5000 ? '<em class="dchip">same</em>' : `<em class="dchip ${diff > 0 ? 'red' : 'green'}">${diff > 0 ? '+' : '−'}${SH(Math.abs(diff))}</em>`;
      return `<div class="comp"><span><b>${E(c.address || 'Similar home')}</b><small>${c.beds ? c.beds + ' bed · ' : ''}${c.d != null ? LUMO.dist(c.d) + ' away · ' : ''}${c.date ? 'sold ' + new Date(c.date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }) : ''}</small></span><span class="num">${SH(c.price)}${chip}</span></div>`;
    }).join('');
    return `<div class="label">${(p.prices || []).length ? `${p.prices.length} similar homes sold in the last year` : 'Value'}</div>${svg}
      <p class="src" style="margin:6px 0 0">Each dot is a similar home that sold. The dashed line is Lumo’s value. ${E(p.note || '')}</p>
      ${rows ? `<div class="label" style="margin-top:14px">Closest sales${p.me != null ? ' (vs this ad)' : ''}</div><div class="comps">${rows}</div>` : ''}`;
  }

  function askView() {
    return `<div class="view"><div class="askhead">${LUMO.logo(40)}<div><b>Ask about this home</b><span>Lumo answers from the checks and the data.</span></div></div><div class="chat"></div></div>`;
  }

  function savedView() {
    const s = D.state.saved || [];
    if (!s.length) return `<div class="view empty"><span class="heart">${I('heart', 28)}</span><div><b>Your shortlist</b>Tap the heart on any home.<br>Lumo keeps its checks with it.</div></div>`;
    return `<div class="view saved">${s.map((h) => `<div class="sh">
      <a href="${E(h.url)}">${h.photo ? `<img src="${E(h.photo)}" alt="">` : '<span class="ph"></span>'}
      <div class="meta"><div class="price num">${h.price ? (h.sale ? LUMO.short(h.price) : M(h.price) + ' /wk') : 'Price hidden'}${h.sale ? '<em class="badge">Buy</em>' : ''}</div><div class="ad">${E((h.address || '').split(',')[0])}</div>
      <div class="cs">${['red', 'amber', 'green'].filter((k) => h.counts?.[k]).map((k) => `<span class="count ${k}"><i class="dot"></i>${h.counts[k]}</span>`).join('')}</div></div></a>
      <button class="rm" data-unsave="${E(h.url)}" aria-label="Remove">${I('x', 13)}</button></div>`).join('')}</div>`;
  }

  function foot() {
    const src = D.F.sources || [];
    return `<div class="foot"><div class="srcs">${src.length ? src.map((s) => `<span class="src-chip ${s.kind}"><i></i>${E(s.name)}${s.kind === 'snapshot' ? ' (offline)' : ''}</span>`).join('') : '<span class="src-chip snapshot"><i></i>No data connected</span>'}</div>
      <button class="round gear" aria-label="Settings">${I('gear', 14)}</button></div>`;
  }

  function composer() {
    const mic = LUMO.voice?.supported;
    return `<form class="composer"><input type="text" placeholder="Ask about this home" aria-label="Ask Lumo">${mic ? `<button type="button" class="mic" aria-label="Speak" aria-pressed="false" title="Speak (or hold ⌥1, tap ⌥2)">${I('mic', 16)}</button>` : ''}<button class="send" aria-label="Send" disabled>${I('send', 15)}</button></form>`;
  }

  function wirePanel() {
    const on = (s, f) => { const el = panel.querySelector(s); if (el) el.onclick = f; };
    draggable(panel, panel.querySelector('.top'), 'panel');
    on('.fold', () => toggle(false));
    on('.side', () => setSide(!pos.side));
    on('.gear', () => LUMO.send('openOptions'));
    on('.eye', () => { setMarks(!marksOn); renderPanel(); });
    on('.heart', async () => {
      const { L } = D;
      const isSaved = (D.state.saved || []).some((s) => s.url === L.url);
      D.state.saved = isSaved ? await LUMO.send('unsave', { url: L.url }) : await LUMO.send('save', { item: { url: L.url, address: L.address, price: L.price, sale: D.mode === 'invest', photo: L.photo, counts: LUMO.counts(D.checks), t: Date.now() } });
      renderPanel();
    });
    panel.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => { view = b.dataset.v; detail = null; renderPanel(); }));
    panel.querySelectorAll('.row').forEach((b) => {
      b.onclick = () => { detail = b.dataset.id; renderPanel(); };
      b.onmouseenter = () => focusCheck(b.dataset.id);
      b.onmouseleave = () => focusCheck(null);
    });
    on('.more-grey', () => { showGrey = true; renderPanel(); });
    on('[data-photos]', () => { detail = 'photos'; view = 'checks'; renderPanel(); });
    on('[data-goto]', () => { view = panel.querySelector('[data-goto]').dataset.goto; detail = null; renderPanel(); });
    on('.back', () => { detail = null; renderPanel(); });
    const qt = panel.querySelector('.quote'); if (qt) qt.onclick = () => showInAd(qt.dataset.show);
    panel.querySelectorAll('.q').forEach((b) => (b.onclick = () => { view = 'ask'; detail = null; renderPanel(); ask(b.textContent); }));
    panel.querySelectorAll('[data-unsave]').forEach((b) => (b.onclick = async (e) => { e.preventDefault(); D.state.saved = await LUMO.send('unsave', { url: b.dataset.unsave }); renderPanel(); }));
    const f = panel.querySelector('.composer');
    if (f) {
      const inp = f.querySelector('input'), send = f.querySelector('.send');
      inp.oninput = () => (send.disabled = !inp.value.trim());
      f.onsubmit = (e) => { e.preventDefault(); const q = inp.value.trim(); if (q && !busy) { LUMO.voice?.abandon(); inp.value = ''; send.disabled = true; ask(q); } };
      const mic = f.querySelector('.mic'); if (mic) mic.onclick = () => LUMO.voice.toggle();
      setTimeout(() => inp.focus({ preventScroll: true }), 60);
    }
  }

  // Hovering a check in the panel lights up its words on the page.
  function focusCheck(id) {
    if (!id || !marksOn) { LUMO.focusPaint(null); for (const el of edges.values()) el.classList.remove('hot'); return; }
    const ms = marksFor(id);
    const t = ms.find((m) => m.target instanceof Range && LUMO.rangeAlive(m.target));
    LUMO.focusPaint(t ? t.target : null);
    for (const m of ms) edges.get(m)?.classList.add('hot');
  }
  function showInAd(id) {
    const m = marksFor(id)[0];
    if (!m) return;
    if (!marksOn) { setMarks(true); renderPanel(); }
    const r = m.target.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top - innerHeight * 0.35, behavior: LUMO.reduceMotion() ? 'auto' : 'smooth' });
    setTimeout(() => { if (m.target instanceof Range) flash(m, 1600); else { edges.get(m)?.classList.add('hot'); setTimeout(() => edges.get(m)?.classList.remove('hot'), 1600); } }, 450);
  }

  // ---------- chat ----------
  function renderChat() {
    const box = panel.querySelector('.chat');
    if (!box) return;
    if (!chat.length && D) chat.push({ role: 'lumo', text: LUMO.opening(D), opening: true });
    if (!box.querySelector('.msgs')) box.innerHTML = '<div class="msgs"></div><div class="tail"></div>';
    const list = box.querySelector('.msgs');
    // Add only the messages not drawn yet, so maps already in the chat don't reload.
    for (let i = list.children.length; i < chat.length; i++) {
      const m = chat[i], c = m.visual && D && D.checks.find((x) => x.id === m.visual);
      const el = document.createElement('div');
      el.className = 'turn ' + m.role;
      el.innerHTML = `<div class="msg ${m.role}">${m.role === 'lumo' ? LUMO.logo(22) : ''}<p>${E(m.text)}</p></div>` +
        (c ? `<div class="viz ${c.level}"><div class="vizhead"><i class="dot"></i><b>${E(c.title)}</b><button class="open" data-open="${E(c.id)}">Details</button></div>${proof(c.proof)}</div>` : '');
      list.appendChild(el);
      wireMaps(el);
      el.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => { view = 'checks'; detail = b.dataset.open; renderPanel(); }));
    }
    const tail = box.querySelector('.tail');
    tail.innerHTML = (busy ? `<div class="msg lumo typing">${LUMO.logo(22)}<p><i></i><i></i><i></i></p></div>` : '') +
      (D && !busy && chat.length < 3 ? `<div class="starters">${LUMO.starters(D).map((q) => `<button class="starter q">${I('spark', 14)}${E(q)}</button>`).join('')}</div>` : '');
    tail.querySelectorAll('.starter').forEach((b) => (b.onclick = () => ask(b.textContent)));
    // A new answer scrolls so its question sits at the top, with the map below it.
    const body = panel.querySelector('.body'), last = list.lastElementChild;
    if (!busy && last?.classList.contains('lumo') && last.previousElementSibling) {
      body.scrollTop += last.previousElementSibling.getBoundingClientRect().top - body.getBoundingClientRect().top - 10;
    } else body.scrollTop = body.scrollHeight;
  }
  async function ask(q) {
    const g = gen;
    chat.push({ role: 'me', text: q }); busy = true; renderChat();
    // Asked while Lumo is still reading the page: answer once the checks are ready.
    if (!D) { if (!dataReady) dataReady = new Promise((r) => (dataResolve = r)); await dataReady; }
    if (g !== gen) return;
    const text = await LUMO.reply(q, D, chat);
    if (g !== gen) return;
    busy = false; chat.push({ role: 'lumo', text, visual: LUMO.visualFor(q, D) }); renderChat();
  }
  // A line from Lumo in the chat that is not part of the conversation sent to the model.
  function chatNote(text) {
    if (!host) return;
    if (!chat.length && D) chat.push({ role: 'lumo', text: LUMO.opening(D), opening: true });
    chat.push({ role: 'lumo', text, note: true });
    if (open && view === 'ask') renderChat();
  }

  // ---------- for content/voice.js ----------
  // Open the panel on the chat tab and hand back the chat box (null until the panel has one).
  function openChat() {
    mount();
    view = 'ask'; detail = null;
    if (!open) toggle(true); else renderPanel();
    return chatBox();
  }
  function chatBox() {
    const f = open && panel?.querySelector('.composer');
    return f ? { form: f, input: f.querySelector('input'), send: f.querySelector('.send'), mic: f.querySelector('.mic') } : null;
  }
  // The mic frame lives in Lumo's closed shadow root, out of the page's reach.
  function attachFrame(el) { mount(); root.appendChild(el); }

  LUMO.ui = { mount, destroy, scanning, render, note, chatNote, openChat, composer: chatBox, attachFrame, toggle: () => host && toggle(), get open() { return open; } };
})();
