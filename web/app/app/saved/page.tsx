import { requireUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { houseCard } from '@/lib/housecard';
import { SavedList } from '@/components/SavedList';

export default async function Saved() {
  const u = await requireUser(['renter', 'investor']);
  const rows = await withUser(u.id, async (db) => (await db.query(
    `select s.listing_id, s.direction from swipes s join listings l on l.id = s.listing_id
     where s.user_id = $1 and s.direction in ('save', 'right') and l.status = 'active' order by s.created_at desc`, [u.id])).rows);
  const cards = (await Promise.all(rows.map(async (r) => ({ dir: r.direction as 'save' | 'right', card: await houseCard(r.listing_id) }))))
    .filter((x) => x.card);
  return (
    <main className="wrap stack">
      <h1>Saved and liked</h1>
      {cards.length === 0 ? <p className="muted">Nothing yet. Tap ☆ on a card to save it for later.</p>
        : <SavedList items={cards.map((x) => ({ dir: x.dir, card: { ...x.card!, boosted: false, commute: null } }))} mode={u.role === 'investor' ? 'investor' : 'renter'} />}
    </main>
  );
}
