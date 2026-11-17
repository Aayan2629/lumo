import { requireUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { whenText } from '@/lib/calendar';
import { ApiForm } from '@/components/ApiForm';

const STATUS: Record<string, string> = {
  new: 'Matched: pick a time', inspection: 'Inspection booked', applied: 'Application sent', approved: 'Approved 🎉', declined: 'Not this time', waitlisted: 'Waitlisted', expired: 'Closed',
};

export default async function Matches() {
  const u = await requireUser(['renter', 'investor']);
  const data = await withUser(u.id, async (db) => {
    const m = (await db.query(
      `select m.id, m.status, m.created_at, l.id as listing_id, l.address, l.suburb, l.photos, l.type,
              (select s.starts_at from inspections i join inspection_slots s on s.id = i.slot_id where i.match_id = m.id) as booked_at
       from matches m join listings l on l.id = m.listing_id where m.user_id = $1 order by m.created_at desc`, [u.id])).rows;
    const slots = (await db.query(
      `select s.id, s.listing_id, s.starts_at from inspection_slots s
       where s.listing_id = any($1) and s.starts_at > now() order by s.starts_at`, [m.map((x) => x.listing_id)])).rows;
    return { m, slots };
  });
  return (
    <main className="wrap stack">
      <h1>Matches</h1>
      {data.m.length === 0 && <p className="muted">No matches yet. When you like a home and the agent likes your verified profile back, it shows up here.</p>}
      {data.m.map((m) => {
        const slots = data.slots.filter((s) => s.listing_id === m.listing_id);
        return (
          <div key={m.id} className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <img src={m.photos?.[0]} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 14 }} />
              <div style={{ flex: 1 }}><b>{m.address}, {m.suburb}</b><div><span className={`pill ${m.status === 'approved' ? 'good' : m.status === 'expired' || m.status === 'declined' ? '' : 'warn'}`}>{STATUS[m.status]}</span></div>
                {m.booked_at && <div className="small muted" style={{ marginTop: 6 }}>Inspection: {whenText(m.booked_at)}</div>}</div>
            </div>
            {(m.status === 'new' || m.status === 'inspection') && (
              slots.length === 0 ? <p className="small muted">The agent hasn’t opened inspection times yet. We’ll email you when they do.</p> : (
                <ApiForm action="/api/matches/book" extra={{ matchId: m.id }} submit={m.booked_at ? 'Change time' : 'Book this time'}>
                  <div className="field"><label htmlFor={`slot-${m.id}`}>{m.type === 'sale' ? 'Private inspection' : 'Inspection'} time</label>
                    <select id={`slot-${m.id}`} name="slotId">{slots.map((s) => <option key={s.id} value={s.id}>{whenText(s.starts_at)}</option>)}</select></div>
                </ApiForm>
              )
            )}
          </div>
        );
      })}
    </main>
  );
}
