import { ApiForm } from '@/components/ApiForm';
import { Turnstile } from '@/components/Turnstile';

export default function AgentLogin() {
  return (
    <main className="wrap stack">
      <a className="logo" href="/"><i />Lumo <span className="faint" style={{ fontWeight: 600, fontSize: 15 }}>for Agents</span></a>
      <div className="card stack">
        <h1>Agent sign in</h1>
        <ApiForm action="/api/auth/start" extra={{ role: 'agent' }} submit="Email me a sign-in link">
          <div className="field"><label htmlFor="email">Work email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <Turnstile />
        </ApiForm>
        <p className="small muted">New agency? <a href="/agent/signup">Sign up with your NSW licence</a></p>
      </div>
    </main>
  );
}
