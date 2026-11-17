import { requireAgent } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { agentContext } from '@/lib/agent';
import { ApiForm } from '@/components/ApiForm';

export default async function Team() {
  const u = await requireAgent();
  const ctx = await agentContext(u.id);
  const team = await withUser(u.id, async (db) => (await db.query(
    `select u.id, u.name, u.email, a.role, a.totp_enabled_at is not null as mfa from agents a join users u on u.id = a.user_id
     where a.agency_id = app_agency_id() and a.removed_at is null order by a.role desc, u.name`)).rows);
  const owner = ctx.agent_role === 'owner';
  return (
    <main className="wrap stack">
      <h1>Team</h1>
      <div className="card">
        {team.map((t) => (
          <div key={t.id} className="metric">
            <div><b>{t.name}</b> <span className="tiny faint">{t.role}</span><div className="src">{t.email} · {t.mfa ? '2FA on' : '2FA not set up yet'}</div></div>
            {owner && t.id !== u.id && <ApiForm action="/api/agent/team" extra={{ op: 'remove', userId: t.id }} submit="Remove" confirm={`Remove ${t.name}? Their access ends immediately.`} />}
          </div>
        ))}
      </div>
      {owner && (
        <div className="card">
          <h3>Add an agent</h3>
          <ApiForm action="/api/agent/team" extra={{ op: 'add' }} submit="Add to team">
            <div className="field"><label htmlFor="tname">Name</label><input id="tname" name="name" required /></div>
            <div className="field"><label htmlFor="temail">Work email</label><input id="temail" name="email" type="email" required /></div>
            <div className="field"><label htmlFor="tlic">Their NSW licence or certificate number</label><input id="tlic" name="licenceNo" /></div>
          </ApiForm>
        </div>
      )}
    </main>
  );
}
