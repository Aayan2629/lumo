'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeckCard } from '@/lib/deck';
import type { Metric } from '@/lib/housecard';
import { useTurnstileToken } from './Turnstile';

type Dir = 'right' | 'left' | 'save';
const money = (n: number) => '$' + n.toLocaleString('en-AU');

export function Deck({ mode, verified }: { mode: 'renter' | 'investor'; verified: boolean }) {
  const token = useTurnstileToken();
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [detail, setDetail] = useState<DeckCard | null>(null);
  const [toast, setToast] = useState<{ text: string; href?: string } | null>(null);
  const [photo, setPhoto] = useState(0);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number; el: HTMLElement | null } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/deck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turnstile: token }) });
    const d = await res.json();
    setCards(d.cards ?? []);
  }, [token]);
  useEffect(() => { if (token) load(); }, [token, load]);
  useEffect(() => setPhoto(0), [cards?.[0]?.listing.id]);

  const swipe = useCallback(async (dir: Dir) => {
    const c = cards?.[0];
    if (!c) return;
    if (dir === 'right' && !verified) { setToast({ text: 'Verify your ID to like homes. It takes about 3 minutes.', href: '/app/verify' }); return; }
    const el = topRef.current;
    if (el) {
      el.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1), opacity .35s';
      el.style.transform = dir === 'right' ? 'translateX(130%) rotate(18deg)' : dir === 'left' ? 'translateX(-130%) rotate(-18deg)' : 'translateY(-120%) scale(.9)';
      el.style.opacity = '0';
    }
    const res = await fetch('/api/swipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: c.listing.id, direction: dir }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (el) { el.style.transform = ''; el.style.opacity = '1'; }
      if (d.code === 'bot_check') { await load(); return; }
      setToast({ text: d.error ?? 'Something went wrong', href: d.code?.endsWith('_first') ? '/app/verify' : undefined });
      return;
    }
    setTimeout(() => setCards((cs) => (cs ? cs.slice(1) : cs)), 250);
    if (d.matched) setToast({ text: `It’s a match with ${c.listing.address}! Pick an inspection time.`, href: '/app/matches' });
    else if (dir === 'save') setToast({ text: 'Saved for later' });
    if ((cards?.length ?? 0) <= 3) load();
  }, [cards, verified, load]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (detail) { if (e.key === 'Escape') setDetail(null); return; }
      if (e.key === 'ArrowRight') swipe('right'); else if (e.key === 'ArrowLeft') swipe('left');
      else if (e.key === 'ArrowUp' && cards?.[0]) setDetail(cards[0]);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [swipe, cards, detail]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, el: e.currentTarget };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.transition = 'none';
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d?.el) return;
    d.dx = e.clientX - d.x; d.dy = e.clientY - d.y;
    d.el.style.transform = `translate(${d.dx}px, ${Math.min(d.dy, 40) * 0.4}px) rotate(${d.dx / 18}deg)`;
    const like = d.el.querySelector<HTMLElement>('.stamp.like'), nope = d.el.querySelector<HTMLElement>('.stamp.nope');
    if (like) like.style.opacity = String(Math.max(0, Math.min(1, d.dx / 90)));
    if (nope) nope.style.opacity = String(Math.max(0, Math.min(1, -d.dx / 90)));
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current; drag.current = null; if (!d?.el) return;
    const el = d.el;
    el.querySelectorAll<HTMLElement>('.stamp').forEach((s) => (s.style.opacity = '0'));
    if (d.dx > 110) return swipe('right');
    if (d.dx < -110) return swipe('left');
    if (d.dy < -90) { el.style.transition = 'transform .3s'; el.style.transform = ''; return cards?.[0] && setDetail(cards[0]); }
    el.style.transition = 'transform .4s cubic-bezier(.32,.72,0,1)'; el.style.transform = '';
    // A tap (no drag) on the left or right half flips through photos.
    if (Math.abs(d.dx) < 6 && Math.abs(d.dy) < 6 && cards?.[0]) {
      const r = el.getBoundingClientRect(); const n = cards[0].listing.photos.length;
      setPhoto((p) => (e.clientX - r.left > r.width / 2 ? Math.min(n - 1, p + 1) : Math.max(0, p - 1)));
    }
  };

  if (!cards) return <div className="deck"><div className="swipe-card" style={{ display: 'grid', placeItems: 'center' }}><p className="muted">Loading homes…</p></div><div id="ts-deck" /></div>;
  if (!cards.length) return (
    <div className="card stack" style={{ textAlign: 'center', padding: 32 }}>
      <h2>You’re all caught up</h2>
      <p className="muted">No more {mode === 'investor' ? 'properties' : 'rentals'} match your filters right now. Try widening your budget in Profile, or check back tomorrow.</p>
      <a className="btn secondary" href="/app/profile">Change filters</a>
    </div>
  );

  return (
    <>
      <div id="ts-deck" />
      <div className="deck">
        {cards.slice(0, 2).reverse().map((c, i, arr) => {
          const top = i === arr.length - 1;
          return (
            <div key={c.listing.id} ref={top ? topRef : undefined} className={`swipe-card${top ? '' : ' behind'}`}
              onPointerDown={top ? onDown : undefined} onPointerMove={top ? onMove : undefined} onPointerUp={top ? onUp : undefined}
              role={top ? 'group' : undefined} aria-label={top ? `${c.listing.address}, ${c.listing.suburb}` : undefined}>
              <img className="photo" src={c.listing.photos[top ? photo : 0] ?? '/img/living.jpg'} alt="" draggable={false} />
              <div className="shade" />
              {top && c.listing.photos.length > 1 && <div className="photo-dots">{c.listing.photos.map((_, j) => <span key={j} className={j === photo ? 'on' : ''} />)}</div>}
              <div className="top" style={{ top: 20 }}>
                <div className="row wrapf" style={{ gap: 6 }}>
                  {c.boosted && <span className="chip">Featured</span>}
                  {c.agentLicensed && <span className="chip">✓ Licensed agent</span>}
                  {c.listing.petsConsidered && mode === 'renter' && <span className="chip">Pets considered</span>}
                </div>
              </div>
              <span className="stamp like">LIKE</span><span className="stamp nope">PASS</span>
              <div className="info">
                <div className="row between">
                  <span className="powered">◎ Powered by Microburbs{c.poweredBy.sample ? ' · sample data' : ''}</span>
                </div>
                <h2>{mode === 'investor' ? money(c.listing.price) : `${money(c.listing.price)}/wk`}</h2>
                <div style={{ opacity: .92 }}>{c.listing.address}, {c.listing.suburb} · {c.listing.beds} bed · {c.listing.baths} bath · {c.listing.parking} car</div>
                <div className="big3">
                  {mode === 'renter' ? (
                    <>
                      <div><b>{c.commute ? `${c.commute.minutes} min` : '—'}</b><span>{c.commute ? `to ${c.commute.place.split(' (')[0]}` : 'Set a commute place'}</span></div>
                      <div><b>{c.renter.rentVsMedian.display}</b><span>vs suburb median</span></div>
                      <div><b>{c.renter.crime.display}</b><span>crime level</span></div>
                    </>
                  ) : (
                    <>
                      <div><b>{c.investor.grossYield.display}</b><span>gross yield (est.)</span></div>
                      <div><b>{c.investor.growth5y.display}</b><span>5-yr growth</span></div>
                      <div><b><span className={`dot ${c.investor.vacancy.tone ?? ''}`} /> {c.investor.vacancy.display}</b><span>vacancy</span></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="controls">
        <button className="round glass nope" aria-label="Pass" onClick={() => swipe('left')}>✕</button>
        <button className="round small glass" aria-label="Details" onClick={() => setDetail(cards[0])}>↑</button>
        <button className="round small glass" aria-label="Save" onClick={() => swipe('save')}>☆</button>
        <button className="round glass like" aria-label="Like" onClick={() => swipe('right')}>♥</button>
      </div>
      <p className="tiny faint" style={{ textAlign: 'center', marginTop: 10 }}>Swipe right to like, left to pass, up for details. Arrow keys work too.</p>
      {toast && (
        <div className="notice" role="status" style={{ marginTop: 12 }}>
          {toast.text} {toast.href && <a href={toast.href}><b>Go</b></a>} <button className="btn sm ghost" style={{ marginLeft: 8 }} onClick={() => setToast(null)}>OK</button>
        </div>
      )}
      {detail && <Details card={detail} mode={mode} onClose={() => setDetail(null)} />}
    </>
  );
}

function Row({ m }: { m: Metric }) {
  return (
    <div className="metric">
      <div><div>{m.label}</div><div className="src">{m.source} · {m.asOf}{m.estimate ? ' · estimate' : ''}</div></div>
      <b>{m.tone && <span className={`dot ${m.tone}`} />} {m.display}</b>
    </div>
  );
}

export function Details({ card: c, mode, onClose }: { card: DeckCard; mode: 'renter' | 'investor'; onClose: () => void }) {
  const [reported, setReported] = useState(false);
  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Details for ${c.listing.address}`}>
        <div className="grab" />
        <div className="sheet-inner stack">
          <div className="row between"><h2 style={{ margin: 0 }}>{c.listing.address}, {c.listing.suburb}</h2><button className="btn sm secondary" onClick={onClose}>Close</button></div>
          <p className="muted">{c.listing.description}</p>
          <div className="row wrapf">
            <span className={`pill ${c.photoCheck.status === 'clear' ? 'good' : 'warn'}`}>{c.photoCheck.label}</span>
            {c.agentLicensed && <span className="pill good">Licensed agent</span>}
            {c.commute && <span className="pill">{c.commute.minutes} min to {c.commute.place} · estimate</span>}
          </div>
          {mode === 'investor' ? (
            <>
              <div className="card">{(['grossYield', 'rentEstimate', 'growth5y', 'growth10y', 'vacancy', 'daysOnMarket', 'valuation', 'medianPrice', 'development', 'flood', 'bushfire'] as const).map((k) => <Row key={k} m={c.investor[k]} />)}</div>
              {c.comparables.length > 0 && (
                <div className="card"><h3>Comparable sales nearby</h3>
                  {c.comparables.map((s, i) => <div className="metric" key={i}><div>{s.address}<div className="src">{s.date}{s.beds ? ` · ${s.beds} bed` : ''}</div></div><b>{money(s.price)}</b></div>)}
                  <p className="src" style={{ marginTop: 8 }}>{c.poweredBy.sample ? 'Microburbs sample data' : 'Microburbs'} · {c.poweredBy.asOf}</p>
                </div>
              )}
              <p className="tiny faint">Yields and growth are estimates from Microburbs data, shown with their date. This is general information, not financial advice.</p>
            </>
          ) : (
            <div className="card">{(['medianRent', 'rentVsMedian', 'rentChange', 'crime', 'livability', 'amenities', 'schools', 'flood', 'bushfire'] as const).map((k) => <Row key={k} m={c.renter[k]} />)}</div>
          )}
          <p className="tiny faint">Lumo will never ask you to pay a deposit to view a property. Payments are never taken in chat.</p>
          {reported ? <p className="ok">Thanks, we’ll review this listing.</p> : (
            <button className="btn sm ghost" onClick={async () => {
              const reason = window.prompt('What’s wrong with this listing?');
              if (!reason) return;
              await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: c.listing.id, reason }) });
              setReported(true);
            }}>Report this listing</button>
          )}
        </div>
      </div>
    </>
  );
}
