import 'server-only';
import { env } from '../env';
import { hmac, randomToken, safeEqual } from '../crypto';

// Identity (DVS gateway such as Didit or Sumsub), open banking (Basiq, Frollo or Fiskil) and
// lender pre-approval all follow one pattern:
//   1. start(): Lumo asks the provider for a hosted session and sends the user there.
//   2. The user scans IDs or consents to read-only bank access ON THE PROVIDER'S PAGE.
//      ID images and bank data never touch Lumo.
//   3. The provider calls Lumo's webhook with a signed result. Lumo checks the signature and
//      stores only pass/fail, a band and the provider's session reference.

export type CheckKind = 'id' | 'bank' | 'finance';
export type StartResult = { providerRef: string; redirectUrl: string; provider: string };

// What a webhook is allowed to tell Lumo. There is deliberately no field for a document
// number, an image, an account number or a transaction.
export type IdResult = { kind: 'id'; providerRef: string; passed: boolean; documents: number; liveness: boolean };
export type BankResult = { kind: 'bank'; providerRef: string; passed: boolean; weeklyIncome: number; balance: number };
export type FinanceResult = { kind: 'finance'; providerRef: string; passed: boolean; preApprovedUpTo: number; expiresOn: string };
export type ProviderResult = IdResult | BankResult | FinanceResult;

const secretFor = (kind: CheckKind) => env.req(`${kind.toUpperCase()}_WEBHOOK_SECRET`, env.allowMocks ? `dev-${kind}-secret` : undefined);

export function signWebhook(kind: CheckKind, body: string, at = Math.floor(Date.now() / 1000)) {
  return `t=${at},v1=${hmac(secretFor(kind), `${at}.${body}`)}`;
}

// Rejects bad signatures and anything older than 5 minutes (replay protection).
export function verifyWebhook(kind: CheckKind, body: string, header: string | null, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 300 || !parts.v1) return false;
  return safeEqual(hmac(secretFor(kind), `${t}.${body}`), parts.v1);
}

export interface VerifyProvider { name: string; start(kind: CheckKind, userId: string): Promise<StartResult>; }

function mockProvider(): VerifyProvider {
  if (!env.allowMocks) throw new Error('Mock verification provider is disabled (set LUMO_ALLOW_MOCKS=1 for the pilot)');
  return {
    name: 'mock',
    async start(kind) {
      const providerRef = `mock_${kind}_${randomToken(12)}`;
      return { providerRef, provider: 'mock', redirectUrl: `/mock/${kind}/${providerRef}` };
    },
  };
}

// Live adapters: fill these in once contracts are signed. Each must return the provider's
// hosted URL and session id, and its webhook must be mapped onto ProviderResult.
function notWired(name: string): VerifyProvider {
  return { name, async start() { throw new Error(`${name} adapter not wired yet: add its API client in lib/providers/verify.ts`); } };
}

export function verifyProvider(kind: CheckKind): VerifyProvider {
  const p = env.provider(kind === 'id' ? 'ID' : 'BANK');
  if (p === 'mock') return mockProvider();
  return notWired(p);
}

// ---------- bands ----------
// Income is stored as a weekly band ($250 steps), never the figure itself.
export function incomeBand(weekly: number) {
  const lo = Math.floor(weekly / 250) * 250;
  return `${lo}-${lo + 250}`;
}
// "Income covers rent 3x": rounded down to the nearest 0.5x, computed per listing.
export function rentCover(band: string | null, weeklyRent: number) {
  if (!band || !weeklyRent) return null;
  const lo = Number(band.split('-')[0]);
  const x = Math.floor((lo / weeklyRent) * 2) / 2;
  return x;
}
export function financeBand(amount: number) {
  const lo = Math.floor(amount / 100_000) * 100_000;
  return `up_to_${lo}`;
}
