import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { withService, type Db } from './db';
import { randomToken, sha256 } from './crypto';
import { audit } from './audit';
import { HttpError } from './http';

export type Role = 'renter' | 'investor' | 'agent' | 'admin';
export type SessionUser = { id: string; role: Role; email: string; name: string | null; mfaOk: boolean };

const COOKIE = '__Host-lumo_session';
const DEV_COOKIE = 'lumo_session'; // __Host- needs https; local dev runs on http
const cookieName = () => (process.env.NODE_ENV === 'production' ? COOKIE : DEV_COOKIE);
const SESSION_DAYS = 30;
const LOGIN_TOKEN_MIN = 15;

// Email magic link. Returns the token so the caller can email it; only the hash is stored.
export async function createLoginToken(db: Db, userId: string) {
  const token = randomToken();
  await db.query('insert into login_tokens (token_hash, user_id, expires_at) values ($1, $2, $3)',
    [sha256(token), userId, new Date(Date.now() + LOGIN_TOKEN_MIN * 60_000)]);
  return token;
}

export async function findOrCreateUser(db: Db, email: string, role: Role) {
  const e = email.trim().toLowerCase();
  const found = await db.query('select id, role from users where email = $1 and deleted_at is null', [e]);
  if (found.rows[0]) return { id: found.rows[0].id as string, role: found.rows[0].role as Role, created: false };
  if (role === 'admin') throw new Error('Admins are created by hand');
  const { rows } = await db.query('insert into users (email, role) values ($1, $2) returning id', [e, role]);
  await audit(db, rows[0].id, 'user.signup', role);
  return { id: rows[0].id as string, role, created: true };
}

// Swaps a login token for a session. Agents and admins start with mfa_ok = false and must
// pass TOTP (or enrol it) before any /agent route will serve them.
export async function consumeLoginToken(token: string) {
  return withService(async (db) => {
    const { rows } = await db.query(
      `update login_tokens set used_at = now()
       where token_hash = $1 and used_at is null and expires_at > now() returning user_id`, [sha256(token)]);
    if (!rows[0]) return null;
    const userId = rows[0].user_id as string;
    const u = await db.query('select role from users where id = $1 and deleted_at is null', [userId]);
    if (!u.rows[0]) return null;
    const role = u.rows[0].role as Role;
    const session = randomToken();
    const needsMfa = role === 'agent' || role === 'admin';
    await db.query('insert into sessions (token_hash, user_id, mfa_ok, expires_at) values ($1, $2, $3, $4)',
      [sha256(session), userId, !needsMfa, new Date(Date.now() + SESSION_DAYS * 86_400_000)]);
    await db.query('update users set last_seen_at = now() where id = $1', [userId]);
    await audit(db, userId, 'session.create');
    return { session, role, userId };
  });
}

export async function setSessionCookie(session: string) {
  (await cookies()).set(cookieName(), session, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function currentSessionToken() {
  return (await cookies()).get(cookieName())?.value ?? null;
}

export async function getUser(): Promise<SessionUser | null> {
  const token = await currentSessionToken();
  if (!token) return null;
  return withService(async (db) => {
    const { rows } = await db.query(
      `select u.id, u.role, u.email, u.name, s.mfa_ok,
              a.removed_at as agent_removed, (a.user_id is not null) as is_agent_row
       from sessions s join users u on u.id = s.user_id
       left join agents a on a.user_id = u.id
       where s.token_hash = $1 and s.expires_at > now() and u.deleted_at is null`, [sha256(token)]);
    const r = rows[0];
    if (!r) return null;
    if (r.role === 'agent' && r.agent_removed) return null; // removed from agency: cut off at once
    return { id: r.id, role: r.role, email: r.email, name: r.name, mfaOk: r.mfa_ok };
  });
}

export async function markMfaOk() {
  const token = await currentSessionToken();
  if (!token) return;
  await withService((db) => db.query('update sessions set mfa_ok = true where token_hash = $1', [sha256(token)]));
}

export async function signOut() {
  const token = await currentSessionToken();
  if (token) await withService((db) => db.query('delete from sessions where token_hash = $1', [sha256(token)]));
  (await cookies()).delete(cookieName());
}

export async function requireUser(roles?: Role[]) {
  const u = await getUser();
  if (!u) redirect('/login');
  if (roles && !roles.includes(u.role)) redirect(u.role === 'agent' ? '/agent' : '/app');
  return u;
}

// Agents must have passed TOTP in this session. Not enrolled yet -> enrolment page.
export async function requireAgent() {
  const u = await requireUser(['agent']);
  if (!u.mfaOk) redirect('/auth/2fa');
  return u;
}

export async function clientIp() {
  const h = await headers();
  return (h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0] || 'local').trim();
}

// For API routes: same checks as requireUser/requireAgent, but answers 401/403 JSON instead
// of redirecting to a page.
export async function apiUser(roles?: Role[]) {
  const u = await getUser();
  if (!u) throw new HttpError(401, 'Please sign in');
  if (roles && !roles.includes(u.role)) throw new HttpError(403, 'Not allowed');
  if ((u.role === 'agent' || u.role === 'admin') && !u.mfaOk) throw new HttpError(403, 'Two-factor sign-in required');
  return u;
}
