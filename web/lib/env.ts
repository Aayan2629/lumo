import 'server-only';

// Every secret is read here, on the server, from the environment (a secrets manager in
// production). Nothing here is ever sent to the browser: only NEXT_PUBLIC_* values are, and
// the only one Lumo uses is the Turnstile site key, which is public by design.

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing environment variable ${name}`);
  return v;
}
const opt = (name: string) => process.env[name] || undefined;

export const env = {
  get databaseUrl() { return req('DATABASE_URL'); },
  get appUrl() { return req('APP_URL', 'http://localhost:3000').replace(/\/+$/, ''); },
  get fieldKey() { return req('FIELD_ENCRYPTION_KEY'); },
  get isProd() { return process.env.NODE_ENV === 'production'; },
  // Mock providers let the pilot run end to end without contracts in place. They are refused
  // unless this flag is set, so a production deploy can't silently run on fake checks.
  get allowMocks() { return process.env.LUMO_ALLOW_MOCKS === '1'; },
  provider(name: 'MICROBURBS' | 'ID' | 'BANK' | 'EMAIL' | 'BILLING' | 'LICENCE' | 'TURNSTILE') {
    return (process.env[`${name}_PROVIDER`] || 'mock').toLowerCase();
  },
  opt,
  req,
};
