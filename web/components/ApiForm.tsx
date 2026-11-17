'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Submits a form as JSON to a Lumo API route. Checkboxes become booleans, numbers stay
// strings (the server validates and coerces). The API answers { redirect } or { message }.
export function ApiForm({ action, children, submit, className, confirm, method = 'POST', extra }: {
  action: string; children?: React.ReactNode; submit: string; className?: string; confirm?: string; method?: string;
  extra?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className={className} onSubmit={async (e) => {
      e.preventDefault();
      if (confirm && !window.confirm(confirm)) return;
      setBusy(true); setErr(null); setMsg(null);
      const fd = new FormData(e.currentTarget);
      const body: Record<string, unknown> = { ...extra };
      for (const el of Array.from(e.currentTarget.elements) as HTMLInputElement[]) {
        if (!el.name) continue;
        body[el.name] = el.type === 'checkbox' ? el.checked : fd.get(el.name);
      }
      try {
        const res = await fetch(action, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setErr(data.error === 'Invalid input' ? `Please check: ${data.issues?.join(', ') || 'the form'}` : data.error || 'Something went wrong'); return; }
        if (data.redirect) { if (/^https?:/.test(data.redirect)) window.location.href = data.redirect; else router.push(data.redirect); router.refresh(); return; }
        if (data.message) setMsg(data.message);
        router.refresh();
      } finally { setBusy(false); }
    }}>
      {children}
      <button className="btn block" disabled={busy}>{busy ? 'One moment…' : submit}</button>
      {err && <p className="error" role="alert">{err}</p>}
      {msg && <p className="ok" role="status">{msg}</p>}
    </form>
  );
}
