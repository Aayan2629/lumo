// LLM answers (provider set on hackathon day). Lumo answers in its own words using the knowledge files,
// the listing and the checks. Without an LLM key in lumo/.env, the page shows "Insert key".

let KB = null;
async function knowledge() {
  if (KB) return KB;
  const load = async (f) => (await fetch(chrome.runtime.getURL('knowledge/' + f))).json();
  const text = async (f) => { try { return await (await fetch(chrome.runtime.getURL('knowledge/' + f))).text(); } catch { return ''; } };
  const [findings, surroundings, claims, sources, traps, wants] = await Promise.all([load('findings.json'), load('surroundings.json'), load('claims.json'), load('data-sources.json'), text('investor-traps.md'), text('investor-features.md')]);
  KB = { findings, surroundings, claims, sources, investor: { traps, wants } };
  return KB;
}

// Investor mode: the same rules, but for someone weighing up a home to buy and rent out.
function investorPrompt(kb, ctx) {
  return `You are Lumo, a calm assistant that sits beside a property ad for sale in New South Wales and checks it for an investor.
Rules:
- Answer in 1 to 3 short sentences. Plain words. No emojis. No lists unless asked.
- Use only the facts and numbers below. If something is missing, say what would prove it. Never invent numbers.
- Say when a number is an estimate. You are not a financial adviser: give the facts, not a buy or sell recommendation.
- Be fair to the listing: say what is good too.

Listing as shown on the page:
${JSON.stringify(ctx.listing)}

Lumo's weekly sums at the investor's settings (price, rent, costs, loan, yield, cash to buy):
${JSON.stringify(ctx.numbers || {})}

Checks Lumo already ran (red = problem, amber = worth checking, green = good sign, info = useful):
${JSON.stringify(ctx.checks)}

Raw facts (Microburbs market, valuation, sales, rentals, planning):
${JSON.stringify(ctx.facts).slice(0, 7000)}

Traps investors fall for, and what checks each one:
${(kb.investor?.traps || '').slice(0, 7000)}`;
}

function systemPrompt(kb, ctx) {
  if (ctx.mode === 'invest') return investorPrompt(kb, ctx);
  const top = kb.findings.findings.slice(0, 40).map((f) => `#${f.id} ${f.title}: ${f.check}`).join('\n');
  const cats = [...new Set(kb.surroundings.items.map((i) => i.category))]
    .map((c) => c + ': ' + kb.surroundings.items.filter((i) => i.category === c).map((i) => i.issue).join('; ')).join('\n');
  return `You are Lumo, a calm assistant that sits beside a rental ad in Sydney and checks it for a renter.
Rules:
- Answer in 1 to 3 short sentences. Plain words. No emojis. No lists unless asked.
- Use only the facts below. If a fact is missing, say what you would check and which data would prove it. Never invent numbers.
- Say when a fact is sample data or an estimate.
- You answer questions yourself. Do not tell the renter to ask the agent unless only the agent could know.
- Be fair to the listing: say what is good too.

Renter profile:
${JSON.stringify(ctx.profile)}

Listing as shown on the page:
${JSON.stringify(ctx.listing)}

Checks Lumo already ran (level red = problem, amber = worth checking, green = good sign, grey = not checked yet):
${JSON.stringify(ctx.checks)}

Raw facts from data sources:
${JSON.stringify(ctx.facts).slice(0, 6000)}

What Lumo knows how to check, most useful first:
${top}

Things that can be wrong near a rental, by type:
${cats}

Data sources Lumo can draw on:
${kb.sources.sources.map((x) => `${x.name} (${x.status}): ${x.powers.join(', ')}`).join('\n')}`;
}

// Returns { text } on success, { noKey: true } when no LLM key is set.
export async function askLLM(env, ctx, history) {
  if (!env.LLM_API_KEY) return { noKey: true };
  const kb = await knowledge();
  const text = await callModel({
    endpoint: env.LLM_ENDPOINT, model: env.LLM_MODEL, key: env.LLM_API_KEY,
    system: systemPrompt(kb, ctx), messages: history, maxTokens: 400
  });
  return { text };
}

// TODO(hackathon): call the provider we're given. See to-do.md for sample request formats.
// Must return the reply as a plain string.
async function callModel({ endpoint, model, key, system, messages, maxTokens }) {
  throw new Error('callModel not implemented yet');
}

export { knowledge };
