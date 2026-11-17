import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getUser } from '@/lib/auth';
import { withService } from '@/lib/db';
import { decryptField, encryptField } from '@/lib/crypto';
import { newTotpSecret, otpauthUrl } from '@/lib/totp';
import { ApiForm } from '@/components/ApiForm';

export const dynamic = 'force-dynamic';

// Agents must use an authenticator app. First visit: enrol (QR code). Later: enter a code.
export default async function TwoFactor() {
  const u = await getUser();
  if (!u) redirect('/login');
  if (u.role !== 'agent') redirect('/app');
  if (u.mfaOk) redirect('/agent');
  const { secret, enrolled } = await withService(async (db) => {
    const { rows } = await db.query('select totp_secret_enc, totp_enabled_at from agents where user_id = $1', [u.id]);
    if (rows[0]?.totp_enabled_at) return { secret: null, enrolled: true };
    let s = rows[0]?.totp_secret_enc ? decryptField(rows[0].totp_secret_enc) : null;
    if (!s) { s = newTotpSecret(); await db.query('update agents set totp_secret_enc = $1 where user_id = $2', [encryptField(s), u.id]); }
    return { secret: s, enrolled: false };
  });
  const qr = secret ? await QRCode.toDataURL(otpauthUrl(secret, u.email), { margin: 1, width: 220 }) : null;
  return (
    <main className="wrap">
      <a className="logo" href="/"><i />Lumo</a>
      <div className="card stack" style={{ marginTop: 24 }}>
        <h1>{enrolled ? 'Enter your code' : 'Set up two-factor sign-in'}</h1>
        {enrolled ? <p className="muted">Open your authenticator app and enter the 6-digit code for Lumo.</p> : (
          <>
            <p className="muted">Agents see verified renters’ details, so every agent account needs an authenticator app (Google Authenticator, 1Password, Authy). Scan this code, then enter the 6 digits it shows.</p>
            {qr && <img src={qr} alt="QR code for your authenticator app" width={220} height={220} style={{ borderRadius: 12, background: '#fff' }} />}
            <p className="small muted">Can’t scan? Enter this key by hand:</p>
            <p className="code" data-testid="totp-secret">{secret}</p>
          </>
        )}
        <ApiForm action="/api/auth/2fa" submit="Verify">
          <div className="field"><label htmlFor="code">6-digit code</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required /></div>
        </ApiForm>
      </div>
    </main>
  );
}
