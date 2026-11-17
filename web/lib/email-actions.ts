import 'server-only';
import { env } from './env';
import { withService } from './db';
import { audit } from './audit';
import { consumeActionToken, peekActionToken, type ActionName } from './tokens';
import { sendAgentEmail, sendEmail } from './match';
import { applicationEmail } from './emails/templates';
import { answerReference } from './verification';
import { notifyNewSlots, sydneyToUtc } from './slots';

// The NSW standard application form isn't published yet. Point this at it once it is.
const NSW_FORM_URL = () => env.opt('NSW_APPLICATION_FORM_URL') ?? 'https://www.fairtrading.nsw.gov.au/housing-and-property/renting';

export const ACTIONS: Record<string, ActionName> = {
  offer: 'offer_inspection', apply: 'send_application', reroute: 'reroute', reference: 'reference_confirm',
};

export async function describeAction(action: string, token: string) {
  const name = ACTIONS[action];
  if (!name) return null;
  return withService(async (db) => {
    const p = await peekActionToken(db, token, name);
    if (!p) return null;
    if (p.referenceId) {
      const r = (await db.query('select r.past_address, u.name from reference_requests r join users u on u.id = r.user_id where r.id = $1', [p.referenceId])).rows[0];
      return r ? { kind: 'reference' as const, pastAddress: r.past_address as string, firstName: String(r.name ?? 'The renter').split(' ')[0] } : null;
    }
    const m = (await db.query(
      `select m.id, m.status, m.agent_email, u.name, l.id as listing_id, l.address, l.type from matches m join users u on u.id = m.user_id join listings l on l.id = m.listing_id where m.id = $1`, [p.matchId])).rows[0];
    if (!m) return null;
    const slots = (await db.query(`select starts_at from inspection_slots where listing_id = $1 and starts_at > now() order by starts_at`, [m.listing_id])).rows;
    return { kind: 'match' as const, address: m.address as string, type: m.type as 'rent' | 'sale', status: m.status as string, agentEmail: m.agent_email as string,
      firstName: String(m.name ?? 'The renter').split(' ')[0], slots: slots.map((s) => s.starts_at as Date) };
  });
}

type Result = { error: string } | { message: string; notifyListing?: string };

export async function performAction(action: string, token: string, input: Record<string, string>): Promise<Result> {
  const r = await doAction(action, token, input);
  if ('notifyListing' in r && r.notifyListing) await notifyNewSlots(r.notifyListing); // after the slot is committed
  return r;
}

async function doAction(action: string, token: string, input: Record<string, string>): Promise<Result> {
  const name = ACTIONS[action];
  if (!name) return { error: 'Unknown action' };
  return withService(async (db): Promise<Result> => {
    const p = await consumeActionToken(db, token, name);
    if (!p) return { error: 'This link has already been used or has expired.' };
    if (name === 'reference_confirm') {
      await answerReference(p.referenceId, input.answer === 'confirm');
      return { message: input.answer === 'confirm' ? 'Thanks, the reference is confirmed.' : 'Thanks, we’ve noted that you can’t confirm it.' };
    }
    const m = (await db.query(`select m.*, l.address, l.type, u.email as renter_email from matches m join listings l on l.id = m.listing_id join users u on u.id = m.user_id where m.id = $1`, [p.matchId])).rows[0];
    if (!m) return { error: 'This match no longer exists.' };
    if (name === 'offer_inspection') {
      const at = sydneyToUtc(input.startsAt ?? '');
      if (!(at.getTime() > Date.now())) return { error: 'Pick a time in the future.' };
      await db.query('insert into inspection_slots (listing_id, starts_at) values ($1, $2)', [m.listing_id, at]);
      await audit(db, `email:${m.agent_email}`, 'slot.add', m.listing_id);
      return { message: 'Time added. The renter has been asked to book it.', notifyListing: m.listing_id as string };
    }
    if (name === 'send_application') {
      await db.query(`update matches set status = 'applied', updated_at = now() where id = $1 and status in ('new', 'inspection')`, [m.id]);
      await sendEmail(db, { ...applicationEmail({ address: m.address, formUrl: NSW_FORM_URL(), listingType: m.type }), to: m.renter_email, template: 'application', matchId: m.id });
      await audit(db, `email:${m.agent_email}`, 'match.applied', m.id);
      return { message: m.type === 'rent' ? 'Sent. The renter has the NSW standard application form.' : 'Done. The buyer knows the contract is coming.' };
    }
    // reroute
    const to = String(input.email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { error: 'Enter a valid email address.' };
    await db.query('update matches set agent_email = $1, updated_at = now() where id = $2', [to, m.id]);
    await audit(db, `email:${m.agent_email}`, 'match.reroute', `${m.id}->${to}`);
    await sendAgentEmail(db, m.id);
    return { message: `Sent to ${to}. Thanks for letting us know.` };
  });
}
