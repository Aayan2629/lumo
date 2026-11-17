import { requireUser } from '@/lib/auth';
import { myProfile } from '@/lib/session-data';
import { ApiForm } from '@/components/ApiForm';

export default async function Profile() {
  const u = await requireUser(['renter', 'investor']);
  const { user, profile, badges } = await myProfile(u.id);
  const list = [
    ['ID verified', badges.id], ['Income checked', badges.income], ['Bond ready', badges.bond?.band === 'yes' ? badges.bond : undefined], ['Finance ready', badges.finance],
  ] as const;
  return (
    <main className="wrap stack">
      <h1>{user.name ?? 'Your profile'}</h1>
      <p className="muted small">{user.email} · {user.role === 'investor' ? 'Investor' : 'Renter'}</p>
      <div className="card">
        <h3>Your badges</h3>
        {list.map(([label, b]) => <div className="metric" key={label}><span>{label}</span><b className="small">{b ? `✓ until ${new Date(b.expiresAt).toLocaleDateString('en-AU')}` : '—'}</b></div>)}
        <div className="metric"><span>References confirmed</span><b className="small">{badges.referencesConfirmed}</b></div>
        <a className="btn secondary block" href="/app/verify" style={{ marginTop: 10 }}>Verify or refresh</a>
      </div>
      <div className="card stack">
        <h3>Preferences</h3>
        <p className="small muted">{profile?.max_rent_weekly ? `Up to $${profile.max_rent_weekly}/wk` : profile?.max_price ? `Up to $${Number(profile.max_price).toLocaleString('en-AU')}` : ''}{profile?.commute_place ? ` · commute to ${profile.commute_place}` : ''}</p>
        <a className="btn secondary block" href="/app/onboarding">Edit preferences</a>
      </div>
      <div className="card stack">
        <h3>Your data</h3>
        <p className="small muted">See everything Lumo holds about you, or erase your account and all of it. We never hold your ID images, account numbers or transactions.</p>
        <a className="btn secondary block" href="/api/me/export">Download my data</a>
        <ApiForm action="/api/me/delete" submit="Erase my account" confirm="This erases your account, badges, likes and matches. It can’t be undone. Continue?">
          <div className="field"><label htmlFor="confirm">Type DELETE to confirm</label><input id="confirm" name="confirm" autoComplete="off" /></div>
        </ApiForm>
      </div>
      <form method="post" action="/api/auth/signout"><button className="btn ghost block">Sign out</button></form>
      <p className="tiny faint"><a href="/privacy">Privacy policy</a> · <a href="/collection-notice">Collection notice</a></p>
    </main>
  );
}
