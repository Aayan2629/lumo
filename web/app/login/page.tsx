import { headers } from 'next/headers';
import { ApiForm } from '@/components/ApiForm';
import { Turnstile } from '@/components/Turnstile';

export default async function Login({ searchParams }: { searchParams: Promise<{ role?: string; expired?: string }> }) {
  const sp = await searchParams;
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const role = sp.role === 'investor' ? 'investor' : 'renter';
  return (
    <main className="wrap">
      <a className="logo" href="/"><i />Lumo</a>
      <div className="card stack" style={{ marginTop: 24 }}>
        <h1>{role === 'investor' ? 'Find investment property' : 'Find your next rental'}</h1>
        <p className="muted">Enter your email and we’ll send a one-tap sign-in link. No password to remember.</p>
        {sp.expired && <p className="notice warn">That link has expired or was already used. Ask for a new one below.</p>}
        <ApiForm action="/api/auth/start" submit="Email me a sign-in link">
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="role">I’m here to</label>
            <select id="role" name="role" defaultValue={role}><option value="renter">Rent a home</option><option value="investor">Buy an investment property</option></select></div>
          <Turnstile nonce={nonce} />
          <p className="tiny faint">By continuing you agree to our <a href="/privacy">privacy policy</a> and <a href="/collection-notice">collection notice</a>. Lumo is free for renters and always will be.</p>
        </ApiForm>
        <p className="small muted">Real estate agent? <a href="/agent/signup">Sign your agency up</a> or <a href="/agent/login">sign in</a>.</p>
      </div>
    </main>
  );
}
