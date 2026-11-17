'use client';
import Script from 'next/script';
import { useEffect, useState } from 'react';

// Cloudflare Turnstile. With no site key configured (local pilot) it renders a hidden
// dev token, which the server accepts only when mocks are allowed.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export function Turnstile({ nonce }: { nonce?: string }) {
  if (!SITE_KEY) return <input type="hidden" name="turnstile" value="dev-pass" />;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer nonce={nonce} />
      <div className="cf-turnstile" data-sitekey={SITE_KEY} data-response-field-name="turnstile" style={{ margin: '6px 0 14px' }} />
    </>
  );
}

// Hook for client code that needs a token without a form (the swipe deck).
export function useTurnstileToken() {
  const [token, setToken] = useState<string | null>(SITE_KEY ? null : 'dev-pass');
  useEffect(() => {
    if (!SITE_KEY) return;
    const w = window as unknown as { turnstile?: { render: (el: HTMLElement, o: object) => void } };
    const el = document.getElementById('ts-deck');
    const t = setInterval(() => {
      if (w.turnstile && el) { clearInterval(t); w.turnstile.render(el, { sitekey: SITE_KEY, callback: (v: string) => setToken(v) }); }
    }, 200);
    return () => clearInterval(t);
  }, []);
  return token;
}
