import { headers } from 'next/headers';
import { ApiForm } from '@/components/ApiForm';
import { Turnstile } from '@/components/Turnstile';

export default async function AgentSignup() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <main className="wrap stack">
      <a className="logo" href="/"><i />Lumo <span className="faint" style={{ fontWeight: 600, fontSize: 15 }}>for Agents</span></a>
      <h1>Get verified leads, not enquiries</h1>
      <p className="muted">Renters on Lumo have already proved their ID, income and bond. You see badges, swipe right on the ones you want, and get a next-step email the moment it’s a match. Free during the pilot.</p>
      <div className="card">
        <ApiForm action="/api/agent/signup" submit="Check licence and create account">
          <div className="field"><label htmlFor="agencyName">Agency name</label><input id="agencyName" name="agencyName" required /></div>
          <div className="field"><label htmlFor="licenceNo">NSW licence number (agency or licensee in charge)</label><input id="licenceNo" name="licenceNo" inputMode="numeric" required /></div>
          <div className="field"><label htmlFor="leasingEmail">Leasing inbox (fallback for match emails)</label><input id="leasingEmail" name="leasingEmail" type="email" required /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" autoComplete="name" required /></div>
            <div className="field"><label htmlFor="email">Your work email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          </div>
          <Turnstile nonce={nonce} />
          <p className="tiny faint">We check your licence against NSW Fair Trading’s register now and monthly. Agent accounts must use two-factor sign-in.</p>
        </ApiForm>
      </div>
      <p className="small muted">Already on Lumo? <a href="/agent/login">Sign in</a></p>
    </main>
  );
}
