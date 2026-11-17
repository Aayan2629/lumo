import { TabBar } from '@/components/TabBar';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser(['renter', 'investor']);
  return (
    <>
      <div className="banner">Lumo will never ask you to pay a deposit to view a property.</div>
      {children}
      <TabBar />
    </>
  );
}
