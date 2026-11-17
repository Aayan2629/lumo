import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { consumeLoginToken, setSessionCookie } from '@/lib/auth';

// Email link lands here. Mail scanners that pre-fetch links would burn the token, so the
// GET only shows a button; the POST does the sign-in.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in to Lumo</title>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#f5f5f7;display:grid;place-items:center;min-height:100vh;margin:0">
<form method="post" style="background:#fff;padding:28px;border-radius:22px;text-align:center;max-width:340px">
<div style="font-weight:800;font-size:22px">Lumo</div><p>Tap to finish signing in.</p>
<input type="hidden" name="token" value="${token.replace(/[^A-Za-z0-9_-]/g, '')}">
<button style="font:inherit;font-weight:600;border:0;border-radius:999px;padding:12px 22px;background:#1d1d1f;color:#fff">Sign in</button></form></body>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const r = await consumeLoginToken(String(form.get('token') ?? ''));
  if (!r) return NextResponse.redirect(`${env.appUrl}/login?expired=1`, 303);
  await setSessionCookie(r.session);
  const to = r.role === 'agent' || r.role === 'admin' ? '/auth/2fa' : '/app';
  return NextResponse.redirect(`${env.appUrl}${to}`, 303);
}
