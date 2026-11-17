import { requireAgent } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { leadsFor } from '@/lib/agent';
import { LeadQueue } from '@/components/LeadQueue';

export default async function AgentHome() {
  const u = await requireAgent();
  const data = await withUser(u.id, async (db) => {
    const listings = (await db.query(
      `select l.id, l.address, l.suburb, l.type, l.price, l.status, l.photos, l.boosted_until > now() as boosted, l.assigned_agent_email,
              (select count(*)::int from swipes s where s.listing_id = l.id and s.direction = 'right') as likes,
              (select count(*)::int from matches m where m.listing_id = l.id) as matches
       from listings l where l.agency_id = app_agency_id() order by l.status = 'active' desc, l.created_at desc`)).rows;
    const leads = await leadsFor(db);
    const stats = (await db.query(
      `select (select count(*)::int from matches m join listings l on l.id = m.listing_id where l.agency_id = app_agency_id()) as matches,
              (select count(*)::int from matches m join listings l on l.id = m.listing_id where l.agency_id = app_agency_id() and m.status in ('inspection','applied','approved')) as inspections,
              (select count(*)::int from matches m join listings l on l.id = m.listing_id where l.agency_id = app_agency_id() and m.status = 'approved') as approved`)).rows[0];
    return { listings, leads, stats };
  });
  const byId = Object.fromEntries(data.listings.map((l) => [l.id, l.address]));
  const pending = data.leads.filter((l) => !l.decision && !l.matchId);
  return (
    <main className="wide stack">
      <div className="grid2">
        <div className="card stat"><b>{pending.length}</b><span>Verified leads waiting</span></div>
        <div className="card stat"><b>{data.stats.matches}</b><span>Matches</span></div>
        <div className="card stat"><b>{data.stats.inspections}</b><span>Inspections and beyond</span></div>
        <div className="card stat"><b>{data.stats.approved}</b><span>Approved</span></div>
      </div>
      <section className="stack">
        <h2>Lead queue</h2>
        <p className="small muted">People who liked your listings, best-verified first. You only see badges and move-in details; documents stay with the verification providers.</p>
        <LeadQueue leads={data.leads.map((l) => ({ ...l, address: byId[l.listingId] }))} showListing />
      </section>
      <section className="card">
        <div className="row between"><h2 style={{ margin: 0 }}>Listings</h2><a className="btn sm" href="/agent/listings/new">New listing</a></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th></th><th>Address</th><th>Price</th><th>Likes</th><th>Matches</th><th>Assigned</th><th>Status</th></tr></thead>
            <tbody>
              {data.listings.map((l) => (
                <tr key={l.id}>
                  <td><img className="thumb" src={l.photos?.[0]} alt="" /></td>
                  <td><a href={`/agent/listings/${l.id}`}><b>{l.address}</b></a><div className="tiny faint">{l.suburb} · {l.type === 'rent' ? 'Lease' : 'Sale'}{l.boosted ? ' · Boosted' : ''}</div></td>
                  <td className="num">${l.price.toLocaleString('en-AU')}{l.type === 'rent' ? '/wk' : ''}</td>
                  <td className="num">{l.likes}</td><td className="num">{l.matches}</td>
                  <td className="small">{l.assigned_agent_email ?? <span className="faint">Leasing inbox</span>}</td>
                  <td><span className={`pill ${l.status === 'active' ? 'good' : ''}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
