// Email bodies. Rule: nothing sensitive beyond the badge summary. No income figures, no ID
// details, no phone numbers. Every link is a single-use token that expires in 7 days.

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const shell = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,sans-serif;color:#1d1d1f">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;padding:28px">
<tr><td><div style="font-weight:700;font-size:20px;letter-spacing:-.02em">Lumo</div>
<h1 style="font-size:22px;letter-spacing:-.02em;margin:18px 0 8px">${esc(title)}</h1>${body}
<p style="font-size:12px;color:#86868b;margin-top:28px">Lumo will never ask you to pay a deposit to view a property. Verified by Lumo: agents see badges, never documents.</p>
</td></tr></table></td></tr></table></body></html>`;

const button = (href: string, label: string, primary = true) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600;${primary ? 'background:#1d1d1f;color:#fff' : 'background:#f0f0f3;color:#1d1d1f'}">${esc(label)}</a>`;

export function loginEmail(link: string) {
  return {
    subject: 'Your Lumo sign-in link',
    html: shell('Sign in to Lumo', `<p>Tap the button to sign in. The link works once and expires in 15 minutes.</p>${button(link, 'Sign in')}<p style="font-size:13px;color:#86868b">Didn't ask for this? You can ignore it.</p>`),
    text: `Sign in to Lumo: ${link}\nThe link works once and expires in 15 minutes.`,
  };
}

export type LeadSummary = {
  firstName: string; badges: { label: string; ok: boolean }[]; moveIn: string | null; occupants: number | null; pets: string | null;
};

export function agentNextStepEmail(o: {
  address: string; listingType: 'rent' | 'sale'; lead: LeadSummary; offerUrl: string; applyUrl: string; rerouteUrl: string; dashboardUrl: string;
}) {
  const rows = o.lead.badges.map((b) => `<li style="margin:4px 0">${b.ok ? '✅' : '⚪️'} ${esc(b.label)}</li>`).join('');
  const details = o.listingType === 'rent'
    ? `<p style="margin:4px 0">Move-in: ${esc(o.lead.moveIn ?? 'flexible')} · People: ${esc(o.lead.occupants ?? '-')} · Pets: ${esc(o.lead.pets ?? 'none')}</p>`
    : '';
  const ask = o.listingType === 'rent'
    ? `${button(o.offerUrl, 'Book inspection')}${button(o.applyUrl, 'Send application', false)}`
    : `${button(o.offerUrl, 'Book private inspection')}${button(o.applyUrl, 'Send contract of sale', false)}`;
  return {
    subject: `New verified match: ${o.lead.firstName} for ${o.address}`,
    html: shell(`It's a match for ${o.address}`, `<p>${esc(o.lead.firstName)} liked your listing and you liked them back. Lumo has checked:</p>
<ul style="padding-left:18px">${rows}</ul>${details}<p>Next step:</p>${ask}
<p style="font-size:13px;margin-top:18px"><a href="${esc(o.dashboardUrl)}">Open in the dashboard</a> · <a href="${esc(o.rerouteUrl)}">Not your listing?</a></p>`),
    text: `It's a match for ${o.address}.\n${o.lead.firstName}\n${o.lead.badges.map((b) => '- ' + b.label).join('\n')}\nBook inspection: ${o.offerUrl}\n${o.listingType === 'rent' ? 'Send application' : 'Send contract'}: ${o.applyUrl}\nNot your listing? ${o.rerouteUrl}`,
  };
}

export function renterMatchEmail(o: { address: string; url: string }) {
  return {
    subject: `You matched with ${o.address}`,
    html: shell(`You matched with ${o.address}`, `<p>The agent liked your verified profile. Pick an inspection time that suits you.</p>${button(o.url, 'Pick an inspection time')}`),
    text: `You matched with ${o.address}. Pick an inspection time: ${o.url}`,
  };
}

export function inspectionEmail(o: { address: string; when: string; calendarUrl: string; forAgent: boolean; name?: string }) {
  return {
    subject: `Inspection booked: ${o.address}, ${o.when}`,
    html: shell('Inspection booked', `<p>${o.forAgent ? `${esc(o.name)} booked` : 'You are booked in for'} an inspection of <b>${esc(o.address)}</b> on <b>${esc(o.when)}</b>.</p>${button(o.calendarUrl, 'Add to calendar')}`),
    text: `Inspection: ${o.address}, ${o.when}. Add to calendar: ${o.calendarUrl}`,
  };
}

export function applicationEmail(o: { address: string; formUrl: string; listingType: 'rent' | 'sale' }) {
  return o.listingType === 'rent' ? {
    subject: `Apply for ${o.address}`,
    html: shell(`Apply for ${o.address}`, `<p>The agent has invited you to apply. The application uses the NSW standard tenancy application form, pre-filled only with what you agreed to share. Photo ID is asked for only if you're the preferred applicant, before the lease is signed.</p>${button(o.formUrl, 'Open the application')}`),
    text: `The agent invited you to apply for ${o.address}: ${o.formUrl}`,
  } : {
    subject: `Contract of sale requested: ${o.address}`,
    html: shell(`Contract of sale: ${o.address}`, `<p>The selling agent will send you the contract of sale. Lumo shows data, not advice: talk to a conveyancer before you sign.</p>`),
    text: `The selling agent will send you the contract of sale for ${o.address}.`,
  };
}

export function newSlotsEmail(o: { address: string; url: string }) {
  return {
    subject: `Inspection times are open for ${o.address}`,
    html: shell('Inspection times are open', `<p>The agent added inspection times for <b>${esc(o.address)}</b>.</p>${button(o.url, 'Pick a time')}`),
    text: `Inspection times are open for ${o.address}: ${o.url}`,
  };
}

export function matchExpiredEmail(o: { address: string; url: string }) {
  return {
    subject: `Update on ${o.address}`,
    html: shell(`Update on ${o.address}`, `<p>The agent hasn't taken the next step on this one in 7 days, so we've closed the match. That says nothing about you: your verified profile is ready for the next place.</p>${button(o.url, 'Keep swiping')}`),
    text: `The match for ${o.address} has closed after 7 days without a next step. Keep swiping: ${o.url}`,
  };
}

export function refereeEmail(o: { renterFirstName: string; pastAddress: string; url: string }) {
  return {
    subject: `${o.renterFirstName} listed you as a rental reference`,
    html: shell('Confirm a rental reference', `<p>${esc(o.renterFirstName)} says they rented <b>${esc(o.pastAddress)}</b> and listed you as a reference. One click confirms it. Lumo won't contact you again about this.</p>${button(o.url, 'Confirm or decline')}`),
    text: `${o.renterFirstName} listed you as a reference for ${o.pastAddress}. Confirm or decline: ${o.url}`,
  };
}
