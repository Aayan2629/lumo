import { notFound } from 'next/navigation';
import { describeAction, ACTIONS } from '@/lib/email-actions';
import { whenText } from '@/lib/calendar';
import { ApiForm } from '@/components/ApiForm';

export const dynamic = 'force-dynamic';

// Landing page for email buttons. Viewing it changes nothing (mail scanners pre-fetch
// links); pressing the button does, once.
export default async function EmailAction({ params, searchParams }: { params: Promise<{ action: string }>; searchParams: Promise<{ t?: string }> }) {
  const { action } = await params;
  const { t = '' } = await searchParams;
  if (!ACTIONS[action]) notFound();
  const d = await describeAction(action, t);
  return (
    <main className="wrap stack">
      <a className="logo" href="/"><i />Lumo</a>
      {!d ? <div className="card"><h1>This link has expired</h1><p className="muted">Email buttons work once and expire after 7 days. Open the dashboard to carry on.</p><a className="btn" href="/agent">Open dashboard</a></div>
        : d.kind === 'reference' ? (
          <div className="card stack">
            <h1>Confirm a rental reference</h1>
            <p>{d.firstName} says they rented <b>{d.pastAddress}</b> and listed you as a reference. Can you confirm that?</p>
            <ApiForm action={`/api/e/${action}`} extra={{ t, answer: 'confirm' }} submit="Yes, I confirm" />
            <ApiForm action={`/api/e/${action}`} extra={{ t, answer: 'decline' }} submit="No, I can’t confirm this" />
          </div>
        ) : action === 'offer' ? (
          <div className="card stack">
            <h1>Inspection for {d.address}</h1>
            <p className="muted">{d.firstName} is matched and can book any open time.</p>
            {d.slots.length ? d.slots.map((s, i) => <div key={i} className="metric"><span>{whenText(s)}</span><b className="small">open</b></div>) : <p className="small muted">No open times yet.</p>}
            <ApiForm action={`/api/e/${action}`} extra={{ t }} submit="Add this time and invite them">
              <div className="field"><label htmlFor="startsAt">New time (Sydney)</label><input id="startsAt" name="startsAt" type="datetime-local" required /></div>
            </ApiForm>
          </div>
        ) : action === 'apply' ? (
          <div className="card stack">
            <h1>{d.type === 'rent' ? `Send ${d.firstName} the application` : `Send ${d.firstName} the contract of sale`}</h1>
            <p className="muted">{d.type === 'rent' ? 'Lumo emails them the NSW standard application form, pre-filled only with what they agreed to share. Ask for photo ID only if they become your preferred applicant, before the lease is signed.' : 'Lumo lets the buyer know the contract of sale is on its way from you.'}</p>
            <ApiForm action={`/api/e/${action}`} extra={{ t }} submit="Send it" />
          </div>
        ) : (
          <div className="card stack">
            <h1>Not your listing?</h1>
            <p className="muted">This match for <b>{d.address}</b> went to {d.agentEmail}. Tell us who it should go to and we’ll send it on.</p>
            <ApiForm action={`/api/e/${action}`} extra={{ t }} submit="Send to the right agent">
              <div className="field"><label htmlFor="email">Correct agent’s email</label><input id="email" name="email" type="email" required /></div>
            </ApiForm>
          </div>
        )}
    </main>
  );
}
