import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { expireMatches, runRetention } from '@/lib/jobs';

// Called by a scheduler (Cloudflare Cron Trigger, GitHub Action, etc.) with the CRON_SECRET.
export async function POST(req: Request) {
  const want = env.opt('CRON_SECRET');
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!want || !safeEqual(got, want)) return new Response('unauthorised', { status: 401 });
  const expired = await expireMatches();
  const retention = await runRetention();
  return Response.json({ expired, retention });
}
