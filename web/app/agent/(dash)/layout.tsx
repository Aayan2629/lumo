import { requireAgent } from '@/lib/auth';
import { agentContext } from '@/lib/agent';

export const dynamic = 'force-dynamic';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const u = await requireAgent();
  const ctx = await agentContext(u.id);
  return (
    <>
      <header className="topbar glass">
        <div className="inner">
          <a className="logo" href="/agent"><i />Lumo</a>
          <nav aria-label="Agent">
            <a href="/agent">Leads</a><a href="/agent/listings/new">New listing</a><a href="/agent/team">Team</a><a href="/agent/billing">Billing</a>
          </nav>
          <div style={{ marginLeft: 'auto' }} className="row small">
            <span className="muted">{ctx.name}</span>
            <span className={`pill ${ctx.licence_status === 'current' ? 'good' : 'bad'}`}>Licence {ctx.licence_status}</span>
            <form method="post" action="/api/auth/signout"><button className="btn sm ghost">Sign out</button></form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
