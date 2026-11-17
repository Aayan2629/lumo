'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DeckCard } from '@/lib/deck';
import { Details } from './Deck';

export function SavedList({ items, mode }: { items: { dir: 'save' | 'right'; card: DeckCard }[]; mode: 'renter' | 'investor' }) {
  const [open, setOpen] = useState<DeckCard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const like = async (id: string) => {
    setErr(null);
    const r = await fetch('/api/swipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: id, direction: 'right' }) });
    if (!r.ok) setErr((await r.json()).error); else router.refresh();
  };
  return (
    <div className="stack">
      {err && <p className="error">{err}</p>}
      {items.map(({ dir, card: c }) => (
        <div key={c.listing.id} className="card row" style={{ alignItems: 'stretch' }}>
          <img src={c.listing.photos[0]} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 14 }} />
          <div style={{ flex: 1 }}>
            <b>{c.listing.address}, {c.listing.suburb}</b>
            <div className="small muted">${c.listing.price.toLocaleString('en-AU')}{c.listing.type === 'rent' ? '/wk' : ''} · {c.listing.beds} bed</div>
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <button className="btn sm secondary" onClick={() => setOpen(c)}>Details</button>
              {dir === 'save' ? <button className="btn sm" onClick={() => like(c.listing.id)}>♥ Like</button> : <span className="pill good">Liked</span>}
            </div>
          </div>
        </div>
      ))}
      {open && <Details card={open} mode={mode} onClose={() => setOpen(null)} />}
    </div>
  );
}
