import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { myProfile } from '@/lib/session-data';
import { Deck } from '@/components/Deck';

export default async function SwipePage() {
  const u = await requireUser(['renter', 'investor']);
  const me = await myProfile(u.id);
  if (!me.profile?.onboarded_at) redirect('/app/onboarding');
  const mode = u.role === 'investor' ? 'investor' : 'renter';
  const verified = !!me.badges.id;
  return (
    <main className="wrap" style={{ paddingTop: 12 }}>
      <div className="row between"><a className="logo" href="/app"><i />Lumo</a>
        <a className={`pill ${verified ? 'good' : 'warn'}`} href="/app/verify" style={{ textDecoration: 'none' }}>{verified ? '✓ Verified' : 'Get verified'}</a></div>
      <Deck mode={mode} verified={verified} />
    </main>
  );
}
