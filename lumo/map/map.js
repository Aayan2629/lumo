// Lumo's map. The panel sends what to draw with postMessage; this page draws it with Leaflet.
// Tiles: Esri canvas basemaps and NSW Spatial Services aerial imagery (both free, no key).
const COL = { venue: '#ff3b30', station: '#0a84ff', bus: '#8e8e93', gym: '#34c759', shops: '#34c759', park: '#34c759', da: '#af52de', 'da-red': '#ff2d23', 'da-amber': '#ffb800', 'da-grey': '#8e8e93' };
const LIGHT = { lit: '#ffd166', main: '#f0b84d', dark: '#ff453a', unknown: '#8a93a6' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dist = (m) => (m == null ? '' : m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km');

let map = null, markers = [];
function draw(p) {
  if (map) map.remove();
  document.body.classList.toggle('night', !!p.night);
  // The wheel scrolls the panel; pinch (or Ctrl/Cmd + wheel) zooms the map.
  map = L.map('m', { zoomControl: true, attributionControl: true, scrollWheelZoom: false, maxZoom: 19 });
  let wheelAt = 0;
  map.getContainer().addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const now = Date.now(); if (now - wheelAt < 140) return; wheelAt = now;
    map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });
  map.attributionControl.setPrefix(false);
  // Free, keyless tiles: Esri's light/dark grey canvas for the map, NSW Spatial Services aerial photos for satellite.
  const esri = (n) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${n}/MapServer/tile/{z}/{y}/{x}`;
  const esriAttr = 'Esri, HERE, Garmin, © OpenStreetMap contributors';
  const base = L.layerGroup([
    L.tileLayer(esri(p.night ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base'), { maxNativeZoom: 16, maxZoom: 19, attribution: esriAttr }),
    L.tileLayer(esri(p.night ? 'World_Dark_Gray_Reference' : 'World_Light_Gray_Reference'), { maxNativeZoom: 16, maxZoom: 19 })
  ]).addTo(map);
  const sat = L.tileLayer('https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 19, maxZoom: 19, attribution: '© NSW Spatial Services' });
  L.control.layers({ Map: base, Satellite: sat }, null, { position: 'topright' }).addTo(map);

  const bounds = [];
  const add = (ll) => { if (ll && Number.isFinite(ll[0])) bounds.push(ll); };

  // A walking route, coloured by street lighting at night.
  if (p.line?.length) {
    if (p.night && p.samples?.length) {
      for (let i = 1; i < p.samples.length; i++) {
        const a = p.samples[i - 1], b = p.samples[i];
        const s = a.s === b.s ? b.s : 'unknown';
        if (s === 'lit') L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: '#ffd166', weight: 12, opacity: 0.25, lineCap: 'round' }).addTo(map);
        L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: LIGHT[s], weight: 4.5, opacity: 0.95, lineCap: 'round', dashArray: s === 'dark' ? '6 6' : s === 'main' ? '10 4' : null }).addTo(map);
      }
    } else {
      L.polyline(p.line, { color: '#0a84ff', weight: 10, opacity: 0.18, lineCap: 'round' }).addTo(map);
      L.polyline(p.line, { color: '#0a84ff', weight: 4.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    }
    p.line.forEach(add);
    for (const l of p.lamps || []) L.marker([l.lat, l.lng], { icon: L.divIcon({ className: 'lamp', iconSize: [14, 14] }), interactive: false }).addTo(map);
    if (p.to?.lat) {
      L.marker([p.to.lat, p.to.lng], { icon: L.divIcon({ className: 'dest', iconSize: [16, 16] }) }).addTo(map)
        .bindPopup(`<b>${esc(p.to.name)}</b><span>${esc(p.label || '')}</span>`);
      add([p.to.lat, p.to.lng]);
    }
  }

  // Places around the home: venues, building work, gyms, stations.
  if (p.ring && p.home) L.circle([p.home.lat, p.home.lng], { radius: p.ring, color: '#8e8e93', weight: 1, dashArray: '4 5', fillColor: '#ff3b30', fillOpacity: 0.05 }).addTo(map);
  markers = [];
  for (const x of p.points || []) {
    if (!x.lat) { markers.push(null); continue; }
    const m = L.circleMarker([x.lat, x.lng], { radius: x.kind === 'da-red' ? 9 : 7, color: '#fff', weight: 2, fillColor: COL[x.kind] || '#636366', fillOpacity: 1 }).addTo(map)
      .bindPopup(`<b>${esc(x.name)}</b><span>${esc([x.info, dist(x.d)].filter(Boolean).join(' · '))}</span>`);
    markers.push(m);
    add([x.lat, x.lng]);
  }

  // The home itself.
  if (p.home) {
    L.marker([p.home.lat, p.home.lng], { icon: L.divIcon({ className: 'home', iconSize: [18, 18] }), zIndexOffset: 1000 }).addTo(map).bindPopup('<b>This home</b>');
    add([p.home.lat, p.home.lng]);
    if (p.ring) { const k = p.ring / 110540; add([p.home.lat + k, p.home.lng]); add([p.home.lat - k, p.home.lng]); }
  }
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
  else if (bounds.length) map.setView(bounds[0], 17);

  // A small legend for the night walk.
  document.querySelector('.chip')?.remove();
  if (p.night) {
    const c = document.createElement('div');
    c.className = 'chip';
    c.innerHTML = '<span><i style="background:#ffd166"></i>Lit</span><span><i style="background:#f0b84d"></i>Main road</span><span><i style="background:#ff453a"></i>Dark</span><span><i style="background:#8a93a6"></i>No data</span>';
    document.body.appendChild(c);
  }
}

addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'lumo-map') draw(e.data.p);
  // A card in the panel was tapped: fly there and open its label.
  if (e.data.type === 'lumo-map-focus' && map && markers[e.data.i]) { const m = markers[e.data.i]; map.flyTo(m.getLatLng(), 18, { duration: 0.6 }); setTimeout(() => m.openPopup(), 650); }
});
// Keep the map filling its frame when the panel is resized.
addEventListener('resize', () => map && map.invalidateSize());
// Tell the panel we're ready (it also sends on load, whichever comes first).
parent.postMessage({ type: 'lumo-map-ready' }, '*');
