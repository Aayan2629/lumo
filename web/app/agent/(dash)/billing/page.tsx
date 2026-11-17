import { requireAgent } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { agentContext } from '@/lib/agent';
import { ApiForm } from '@/components/ApiForm';

export default async function Billing({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const sp = await searchParams;
  const u = await requireAgent();
  const ctx = await agentContext(u.id);
  const events = await withUser(u.id, async (db) => (await db.query(
    `select b.kind, b.amount_cents, b.status, b.created_at, l.address from billing_events b left join listings l on l.id = b.listing_id
     where b.agency_id = app_agency_id() order by b.created_at desc limit 50`)).rows);
  return (
    <main className="wrap stack">
      <h1>Billing</h1>
      {sp.paid && <p className="notice">Payment received. Thanks!</p>}
      <div className="card stack">
        <div className="row between"><h3 style={{ margin: 0 }}>Agency plan</h3><span className={`pill ${ctx.billing_status === 'active' ? 'good' : 'warn'}`}>{ctx.plan === 'pilot' ? 'Free pilot' : 'Agency plan'} · {ctx.billing_status}</span></div>
        <p className="small muted">$249 a month per office: listings on Lumo, the verified lead queue, automatic next-step emails and the dashboard. Boosts are $49 per listing for 14 days. Investor leads are $25 per finance-ready match, charged only when a match happens.</p>
        {ctx.agent_role === 'owner' && ctx.plan !== 'agency' && <ApiForm action="/api/agent/billing" extra={{ kind: 'plan' }} submit="Start the Agency plan" />}
      </div>
      <div className="card">
        <h3>History</h3>
        {events.length === 0 ? <p className="small muted">No charges yet.</p> : events.map((e, i) => (
          <div key={i} className="metric"><div>{e.kind === 'plan' ? 'Agency plan' : e.kind === 'boost' ? `Boost: ${e.address}` : `Investor lead: ${e.address}`}<div className="src">{new Date(e.created_at).toLocaleDateString('en-AU')} · {e.status}</div></div><b>${(e.amount_cents / 100).toFixed(2)}</b></div>
        ))}
      </div>
    </main>
  );
}
