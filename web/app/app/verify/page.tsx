import { requireUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { myProfile } from '@/lib/session-data';
import { rentCover } from '@/lib/providers/verify';
import { ApiForm } from '@/components/ApiForm';
import { BadgeStatus } from '@/components/BadgeCard';

export default async function Verify() {
  const u = await requireUser(['renter', 'investor']);
  const { profile, badges, user } = await myProfile(u.id);
  const refs = await withUser(u.id, async (db) => (await db.query('select past_address, status, created_at from reference_requests where user_id = $1 order by created_at desc', [u.id])).rows);
  const inv = user.role === 'investor';
  const cover = badges.income && profile?.max_rent_weekly ? rentCover(badges.income.band, profile.max_rent_weekly) : null;
  return (
    <main className="wrap stack">
      <a className="logo" href="/app"><i />Lumo</a>
      <h1>Get verified</h1>
      <p className="muted">Do it once. Agents see the result as a badge, never your documents. Checks run on our providers’ secure pages: Lumo never sees or stores your ID images, account numbers or transactions.</p>

      <div className="card stack">
        <div className="row between"><h3 style={{ margin: 0 }}>ID verified (2 documents)</h3><BadgeStatus b={badges.id} /></div>
        <p className="small muted">Two government IDs (for example driver licence and passport) checked live against the government’s Document Verification Service, plus a quick selfie liveness check. Lasts 12 months.</p>
        <ApiForm action="/api/verify/start" extra={{ kind: 'id' }} submit={badges.id ? 'Refresh' : 'Verify my ID'} />
      </div>

      {!inv && (
        <div className="card stack">
          <div className="row between"><h3 style={{ margin: 0 }}>Income and bond</h3><BadgeStatus b={badges.income} /></div>
          <p className="small muted">Connect your bank read-only through open banking (Consumer Data Right). Lumo works out whether your income covers 3x the rent and whether you hold 4 weeks’ rent for the bond. Lasts 30 days.</p>
          {badges.income && <div className="row wrapf">
            {cover !== null && <span className="pill good">Income covers your max rent {cover}x</span>}
            <span className={`pill ${badges.bond?.band === 'yes' ? 'good' : 'warn'}`}>{badges.bond?.band === 'yes' ? 'Bond ready' : 'Bond not covered yet'}</span></div>}
          <ApiForm action="/api/verify/start" extra={{ kind: 'bank' }} submit={badges.income ? 'Refresh' : 'Connect my bank'} />
        </div>
      )}

      {inv && (
        <div className="card stack">
          <div className="row between"><h3 style={{ margin: 0 }}>Finance ready</h3><BadgeStatus b={badges.finance} /></div>
          <p className="small muted">Connect your lender’s pre-approval so selling agents see “Pre-approved up to $X”. Lumo keeps only the amount band and expiry date.</p>
          <ApiForm action="/api/verify/start" extra={{ kind: 'finance' }} submit={badges.finance ? 'Refresh' : 'Add pre-approval'} />
        </div>
      )}

      {!inv && (
        <div className="card stack">
          <div className="row between"><h3 style={{ margin: 0 }}>Rental references</h3><span className={`pill ${badges.referencesConfirmed ? 'good' : ''}`}>{badges.referencesConfirmed} confirmed</span></div>
          <p className="small muted">Add a past address and a referee (a previous agent or landlord). We email them a one-click confirmation.</p>
          {refs.map((r, i) => <div key={i} className="metric"><span>{r.past_address}</span><b className="small">{r.status === 'sent' ? 'Waiting' : r.status}</b></div>)}
          <ApiForm action="/api/references" submit="Send reference request">
            <div className="field"><label htmlFor="pastAddress">Past address</label><input id="pastAddress" name="pastAddress" required /></div>
            <div className="field"><label htmlFor="refEmail">Referee’s email</label><input id="refEmail" name="email" type="email" required /></div>
          </ApiForm>
        </div>
      )}
      <a className="btn secondary block" href="/app">Back to swiping</a>
    </main>
  );
}
