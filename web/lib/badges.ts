import 'server-only';
import type { Db } from './db';
import { rentCover } from './providers/verify';

// How long each check stays valid. Income and bond go stale fast; ID lasts a year.
export const EXPIRY_DAYS = { id: 365, income: 30, bond: 30, reference: 365, finance: 90 } as const;
export type BadgeType = keyof typeof EXPIRY_DAYS;

export const expiresAt = (type: BadgeType, from = new Date()) => new Date(from.getTime() + EXPIRY_DAYS[type] * 86_400_000);

export type Badge = { type: BadgeType; band: string | null; checkedAt: string; expiresAt: string };
export type Badges = Partial<Record<BadgeType, Badge>> & { referencesConfirmed: number };

// Latest passed, unexpired check of each type. RLS decides whose rows the caller may read.
export async function badgesFor(db: Db, userId: string): Promise<Badges> {
  const { rows } = await db.query(
    `select distinct on (type) type, result_band, checked_at, expires_at
     from verifications
     where user_id = $1 and status = 'passed' and (expires_at is null or expires_at > now())
     order by type, checked_at desc`, [userId]);
  const refs = await db.query(
    `select count(*)::int as n from verifications
     where user_id = $1 and type = 'reference' and status = 'passed' and expires_at > now()`, [userId]);
  const out: Badges = { referencesConfirmed: refs.rows[0]?.n ?? 0 };
  for (const r of rows) out[r.type as BadgeType] = { type: r.type, band: r.result_band, checkedAt: r.checked_at.toISOString(), expiresAt: r.expires_at?.toISOString() };
  return out;
}

// The badge text an agent sees for a given listing. Never the underlying figures.
export function badgeLabels(b: Badges, listing: { type: 'rent' | 'sale'; price: number }) {
  const out: { key: string; label: string; ok: boolean }[] = [];
  out.push({ key: 'id', label: b.id ? `ID verified · ${b.id.band ?? '2 documents'}` : 'ID not verified', ok: !!b.id });
  if (listing.type === 'rent') {
    const x = b.income ? rentCover(b.income.band, listing.price) : null;
    out.push({ key: 'income', label: x !== null ? `Income covers rent ${x}x` : 'Income not checked', ok: x !== null && x >= 2.5 });
    out.push({ key: 'bond', label: b.bond?.band === 'yes' ? 'Bond ready' : 'Bond not checked', ok: b.bond?.band === 'yes' });
    out.push({ key: 'reference', label: b.referencesConfirmed ? `${b.referencesConfirmed} reference${b.referencesConfirmed > 1 ? 's' : ''} confirmed` : 'No references yet', ok: b.referencesConfirmed > 0 });
  } else {
    const amt = b.finance?.band ? Number(b.finance.band.replace('up_to_', '')) : null;
    out.push({ key: 'finance', label: amt ? `Finance ready · pre-approved up to $${amt.toLocaleString('en-AU')}` : 'Finance not checked', ok: !!amt && amt >= listing.price * 0.8 });
  }
  return out;
}
