import 'server-only';
import { env } from '../env';
import { withService } from '../db';

// Transactional email. Production uses Resend from a Lumo domain with SPF, DKIM and DMARC
// (p=reject). The pilot can run with EMAIL_PROVIDER=outbox, which keeps emails in the
// dev_outbox table and shows them at /dev/outbox instead of sending them.

export type Email = { to: string; subject: string; html: string; text: string };
export interface EmailProvider { name: string; send(e: Email): Promise<{ id: string }>; }

function outbox(): EmailProvider {
  if (!env.allowMocks) throw new Error('Outbox email is disabled (set LUMO_ALLOW_MOCKS=1 for the pilot)');
  return {
    name: 'outbox',
    async send(e) {
      const { rows } = await withService((db) => db.query(
        'insert into dev_outbox ("to", subject, html, text) values ($1, $2, $3, $4) returning id', [e.to, e.subject, e.html, e.text]));
      return { id: rows[0].id };
    },
  };
}

function resend(): EmailProvider {
  const key = env.req('RESEND_API_KEY');
  const from = env.req('EMAIL_FROM'); // e.g. "Lumo <match@mail.lumo.au>"
  return {
    name: 'resend',
    async send(e) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [e.to], subject: e.subject, html: e.html, text: e.text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}`);
      return { id: ((await res.json()) as { id: string }).id };
    },
  };
}

export function emailProvider(): EmailProvider {
  return env.provider('EMAIL') === 'resend' ? resend() : outbox();
}
