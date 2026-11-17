import 'server-only';
import { env } from './env';
import { withService, type Db } from './db';
import { audit } from './audit';
import { badgeLabels, badgesFor } from './badges';
import { createActionToken } from './tokens';
import { emailProvider, type Email } from './providers/email';
import { billingProvider, PRICES } from './providers/billing';
import { agentNextStepEmail, renterMatchEmail, type LeadSummary } from './emails/templates';

export async function sendEmail(db: Db, e: Email & { template: string; matchId?: string | null }) {
  const r = await emailProvider().send(e);
  await db.query('insert into emails (match_id, "to", template, provider_ref) values ($1, $2, $3, $4)', [e.matchId ?? null, e.to, e.template, r.id]);
  return r;
}

export async function leadSummary(db: Db, userId: string, listing: { type: 'rent' | 'sale'; price: number }): Promise<LeadSummary> {
  const { rows } = await db.query(
    `select u.name, p.move_in_date, p.occupants, p.pets from users u left join profiles p on p.user_id = u.id where u.id = $1`, [userId]);
  const u = rows[0] ?? {};
  const b = await badgesFor(db, userId);
  return {
    firstName: String(u.name ?? 'A verified renter').split(' ')[0],
    badges: badgeLabels(b, listing),
    moveIn: u.move_in_date ? new Date(u.move_in_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
    occupants: u.occupants ?? null,
    pets: u.pets ?? null,
  };
}

// Sends the next-step email to whoever is on the match now. Used on match and on reroute.
export async function sendAgentEmail(db: Db, matchId: string) {
  const { rows } = await db.query(
    `select m.id, m.user_id, m.agent_email, l.id as listing_id, l.address, l.type, l.price
     from matches m join listings l on l.id = m.listing_id where m.id = $1`, [matchId]);
  const m = rows[0];
  const lead = await leadSummary(db, m.user_id, m);
  const p = { matchId };
  // One connection, so one query at a time.
  const offer = await createActionToken(db, 'offer_inspection', p);
  const apply = await createActionToken(db, 'send_application', p);
  const reroute = await createActionToken(db, 'reroute', p);
  const base = env.appUrl;
  const mail = agentNextStepEmail({
    address: m.address, listingType: m.type, lead,
    offerUrl: `${base}/e/offer?t=${offer}`, applyUrl: `${base}/e/apply?t=${apply}`, rerouteUrl: `${base}/e/reroute?t=${reroute}`,
    dashboardUrl: `${base}/agent/listings/${m.listing_id}`,
  });
  await sendEmail(db, { ...mail, to: m.agent_email, template: 'agent_next_step', matchId });
}

// Called after either side swipes right. Creates the match once both have, then emails the
// listing's assigned agent (falling back to the agency's leasing inbox) and the renter.
// Runs in the same request as the swipe, so the agent's email goes out within seconds.
export async function maybeMatch(userId: string, listingId: string) {
  return withService(async (db) => {
    const { rows } = await db.query(
      `select l.id, l.address, l.type, l.price, l.agency_id, coalesce(nullif(l.assigned_agent_email, ''), a.leasing_email) as agent_email,
              a.billing_customer_ref
       from listings l join agencies a on a.id = l.agency_id
       join swipes s on s.listing_id = l.id and s.user_id = $1 and s.direction = 'right'
       join agent_swipes x on x.listing_id = l.id and x.user_id = $1 and x.direction = 'right'
       where l.id = $2 and l.status = 'active'`, [userId, listingId]);
    const l = rows[0];
    if (!l) return null;
    const ins = await db.query(
      `insert into matches (user_id, listing_id, agent_email) values ($1, $2, $3)
       on conflict (user_id, listing_id) do nothing returning id`, [userId, listingId, l.agent_email]);
    if (!ins.rows[0]) return null; // already matched
    const matchId = ins.rows[0].id as string;
    await audit(db, 'system', 'match.create', matchId);

    await sendAgentEmail(db, matchId);
    const renter = await db.query('select email from users where id = $1', [userId]);
    await sendEmail(db, { ...renterMatchEmail({ address: l.address, url: `${env.appUrl}/app/matches` }), to: renter.rows[0].email, template: 'renter_match', matchId });

    if (l.type === 'sale') {
      const charge = await billingProvider().chargeLead({ agencyId: l.agency_id, customerRef: l.billing_customer_ref, matchId });
      await db.query(
        `insert into billing_events (agency_id, kind, amount_cents, listing_id, match_id, provider_ref, status) values ($1, 'investor_lead', $2, $3, $4, $5, $6)`,
        [l.agency_id, PRICES.investor_lead, listingId, matchId, charge.ref, charge.status]);
    }
    return matchId;
  });
}
