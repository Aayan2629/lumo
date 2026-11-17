import { notFound } from 'next/navigation';
import { requireAgent } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { leadsFor } from '@/lib/agent';
import { whenText } from '@/lib/calendar';
import { LeadQueue } from '@/components/LeadQueue';
import { ApiForm } from '@/components/ApiForm';

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const u = await requireAgent();
  const data = await withUser(u.id, async (db) => {
    const l = (await db.query(`select *, boosted_until > now() as boosted from listings where id = $1 and agency_id = app_agency_id()`, [id])).rows[0];
    if (!l) return null;
    const leads = await leadsFor(db, { listingId: id });
    const slots = (await db.query(
      `select s.id, s.starts_at, s.capacity, (select count(*)::int from inspections i where i.slot_id = s.id) as booked
       from inspection_slots s where s.listing_id = $1 and s.starts_at > now() - interval '1 day' order by s.starts_at`, [id])).rows;
    const emails = (await db.query(
      `select e."to", e.template, e.sent_at from emails e join matches m on m.id = e.match_id where m.listing_id = $1 order by e.sent_at desc limit 20`, [id])).rows;
    return { l, leads, slots, emails };
  });
  if (!data) notFound();
  const { l } = data;
  return (
    <main className="wide stack">
      <div className="row wrapf" style={{ alignItems: 'flex-start', gap: 18 }}>
        <img src={l.photos?.[0]} alt="" style={{ width: 200, height: 140, objectFit: 'cover', borderRadius: 18 }} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ marginBottom: 4 }}>{l.address}, {l.suburb}</h1>
          <p className="muted">${l.price.toLocaleString('en-AU')}{l.type === 'rent' ? '/wk' : ''} · {l.beds} bed · {l.baths} bath · {l.parking} car · Match emails go to <b>{l.assigned_agent_email ?? 'the leasing inbox'}</b></p>
          <div className="row wrapf">
            <span className={`pill ${l.status === 'active' ? 'good' : ''}`}>{l.status}</span>
            {l.boosted && <span className="pill warn">Boosted until {new Date(l.boosted_until).toLocaleDateString('en-AU')}</span>}
            {l.photos_edited_disclosed && <span className="pill warn">Edited photos disclosed</span>}
          </div>
        </div>
        <div className="stack" style={{ minWidth: 220 }}>
          <ApiForm action="/api/agent/billing" extra={{ kind: 'boost', listingId: l.id }} submit="Boost for 14 days · $49" />
          {l.status === 'active' && <ApiForm action="/api/agent/listings" method="PATCH" extra={{ id: l.id, status: l.type === 'rent' ? 'leased' : 'sold' }} submit={l.type === 'rent' ? 'Mark leased' : 'Mark sold'} confirm="Take this listing out of the deck?" />}
        </div>
      </div>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <section className="stack" style={{ gridColumn: 'span 2' }}>
          <h2>Who liked it</h2>
          <LeadQueue leads={data.leads} />
        </section>
      </div>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <section className="card stack">
          <h3>Inspection times</h3>
          {data.slots.length === 0 && <p className="small muted">No times yet. Matched renters can book once you add one.</p>}
          {data.slots.map((s) => <div key={s.id} className="metric"><span>{whenText(s.starts_at)}</span><b className="small">{s.booked}/{s.capacity} booked</b></div>)}
          <ApiForm action="/api/agent/slots" extra={{ listingId: l.id }} submit="Add time">
            <div className="field"><label htmlFor="startsAt">Date and time (Sydney)</label><input id="startsAt" name="startsAt" type="datetime-local" required /></div>
          </ApiForm>
        </section>
        <section className="card">
          <h3>Emails sent</h3>
          {data.emails.length === 0 ? <p className="small muted">None yet.</p> : data.emails.map((e, i) => (
            <div key={i} className="metric"><div><div className="small">{e.template.replace(/_/g, ' ')}</div><div className="src">{e.to}</div></div><b className="small">{new Date(e.sent_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</b></div>
          ))}
        </section>
      </div>
    </main>
  );
}
