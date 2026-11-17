import 'server-only';
import { env } from '../env';

// Cloudflare Turnstile bot check on sign-up and swipes. Without TURNSTILE_SECRET the check
// only passes when mocks are allowed (local pilot); in production it fails closed.
export async function verifyTurnstile(token: string | undefined | null, ip: string) {
  const secret = env.opt('TURNSTILE_SECRET');
  if (!secret) return env.allowMocks && token === 'dev-pass';
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(5000),
  });
  return res.ok && ((await res.json()) as { success: boolean }).success === true;
}
