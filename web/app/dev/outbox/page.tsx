import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { withService } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Pilot only: emails "sent" with EMAIL_PROVIDER=outbox. 404 unless mocks are allowed.
export default async function Outbox({ searchParams }: { searchParams: Promise<{ to?: string; id?: string }> }) {
  if (!env.allowMocks) notFound();
  const sp = await searchParams;
  const rows = await withService(async (db) => (await db.query(
    `select id, "to", subject, html, created_at from dev_outbox where ($1::text is null or "to" = $1) order by created_at desc limit 50`, [sp.to ?? null])).rows);
  const open = rows.find((r) => r.id === sp.id) ?? rows[0];
  return (
    <main className="wide stack">
      <h1>Dev outbox</h1>
      <p className="muted small">Emails Lumo would have sent. Set EMAIL_PROVIDER=resend to send for real.</p>
      <div className="grid2" style={{ gridTemplateColumns: 'minmax(260px, 1fr) 2fr', alignItems: 'start' }}>
        <div className="card">
          {rows.map((r) => (
            <a key={r.id} href={`/dev/outbox?id=${r.id}${sp.to ? `&to=${encodeURIComponent(sp.to)}` : ''}`} className="metric" style={{ textDecoration: 'none', fontWeight: r.id === open?.id ? 700 : 400 }}>
              <div><div>{r.subject}</div><div className="src">{r.to}</div></div><span className="tiny faint">{new Date(r.created_at).toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' })}</span>
            </a>
          ))}
          {!rows.length && <p className="muted">No emails yet.</p>}
        </div>
        {open && <iframe className="mail" title={open.subject} srcDoc={open.html} sandbox="allow-popups allow-top-navigation-by-user-activation" />}
      </div>
    </main>
  );
}
