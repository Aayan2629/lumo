'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Lead } from '@/lib/agent';

const STATUS: Record<string, string> = { new: 'Matched', inspection: 'Inspection booked', applied: 'Application sent', approved: 'Approved', declined: 'Declined', waitlisted: 'Waitlisted', expired: 'Expired' };

export function LeadQueue({ leads, showListing }: { leads: (Lead & { address?: string })[]; showListing?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (url: string, body: object, key: string) => {
    setBusy(key); setMsg(null);
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(null); setMsg(d.message ?? d.error ?? null); router.refresh();
  };
  if (!leads.length) return <p className="muted">No one has liked {showListing ? 'your listings' : 'this listing'} yet. Boosting puts it first in the deck for its suburb.</p>;
  return (
    <div className="stack">
      {msg && <p className="notice" role="status">{msg}</p>}
      {leads.map((l) => {
        const key = l.listingId + l.userId;
        return (
          <div key={key} className="card lead" data-testid="lead">
            <div>
              <div className="row wrapf"><b style={{ fontSize: 17 }}>{l.firstName}</b>
                {showListing && l.address && <span className="small muted">liked {l.address}</span>}
                <span className="tiny faint">{new Date(l.likedAt).toLocaleDateString('en-AU')}</span></div>
              <div className="badges">{l.badges.map((b) => <span key={b.key} className={`pill ${b.ok ? 'good' : ''}`}>{b.ok ? '✓ ' : ''}{b.label}</span>)}</div>
              <div className="small muted" style={{ marginTop: 6 }}>Move-in {l.moveIn ?? 'flexible'} · {l.occupants ?? 1} {l.occupants === 1 ? 'person' : 'people'} · Pets: {l.pets ?? 'none'}</div>
            </div>
            <div className="row">
              {l.matchId ? (
                <>
                  <span className="pill good">{STATUS[l.matchStatus ?? 'new']}</span>
                  {['inspection', 'applied', 'new'].includes(l.matchStatus ?? '') && (
                    <select aria-label="Outcome" defaultValue="" onChange={(e) => e.target.value && act('/api/agent/outcome', { matchId: l.matchId, status: e.target.value }, key)} style={{ width: 'auto', minHeight: 34, padding: '4px 10px' }}>
                      <option value="" disabled>Mark outcome</option><option value="applied">Application sent</option><option value="approved">Approved</option><option value="waitlisted">Waitlisted</option><option value="declined">Declined</option>
                    </select>
                  )}
                </>
              ) : l.decision === 'left' ? <span className="pill">Passed</span> : l.decision === 'right' ? <span className="pill warn">Accepted</span> : (
                <>
                  <button className="btn sm ghost" disabled={busy === key} onClick={() => act('/api/agent/decide', { listingId: l.listingId, userId: l.userId, direction: 'left' }, key)}>Pass</button>
                  <button className="btn sm" disabled={busy === key} onClick={() => act('/api/agent/decide', { listingId: l.listingId, userId: l.userId, direction: 'right' }, key)}>Accept</button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
