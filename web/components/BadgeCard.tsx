import type { Badge } from '@/lib/badges';

const fmt = (s: string) => new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
export function BadgeStatus({ b, pending }: { b?: Badge; pending?: boolean }) {
  if (b) return <span className="pill good">✓ Valid until {fmt(b.expiresAt)}</span>;
  if (pending) return <span className="pill warn">In progress</span>;
  return <span className="pill">Not done</span>;
}
