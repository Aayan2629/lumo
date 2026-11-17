import { handleProviderWebhook } from '@/lib/verification';

// Signed by the provider (header lumo-signature: t=<ts>,v1=<hmac>). Bad or stale signatures get 401.
export async function POST(req: Request) {
  const raw = await req.text();
  const ok = await handleProviderWebhook('id', raw, req.headers.get('lumo-signature'));
  return new Response(ok ? 'ok' : 'bad signature', { status: ok ? 200 : 401 });
}
