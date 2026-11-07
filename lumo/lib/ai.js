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

// Works out the provider from LLM_ENDPOINT, or from the key when no endpoint is set:
// Anthropic (sk-ant-...), Google Gemini (AIza...), or anything OpenAI-compatible (OpenAI, Mistral, Groq, OpenRouter, ...).
// Returns the reply as a plain string.
async function callModel({ endpoint, model, key, system, messages, maxTokens }) {
  const ep = String(endpoint || '').trim();
  const anthropic = /anthropic/i.test(ep) || (!ep && /^sk-ant-/.test(key));
  const gemini = /generativelanguage/i.test(ep) || (!ep && /^AIza/.test(key));
  // A model wants the conversation to start with a user turn.
  const msgs = messages.filter((m, i) => m.content && (i > 0 || m.role === 'user'));
  if (!msgs.length) throw new Error('nothing to ask');

  if (anthropic) {
    const url = ep ? (/\/messages\/?$/.test(ep) ? ep : ep.replace(/\/+$/, '') + (/\/v1$/.test(ep.replace(/\/+$/, '')) ? '' : '/v1') + '/messages') : 'https://api.anthropic.com/v1/messages';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: model || 'claude-haiku-4-5', max_tokens: maxTokens, system, messages: msgs })
    });
    if (!res.ok) throw new Error('LLM ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const j = await res.json();
    return (j.content || []).map((b) => b.text || '').join('').trim();
  }

  // OpenAI-style chat completions. Gemini has an OpenAI-compatible endpoint too.
  let url = ep || (gemini ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' : 'https://api.openai.com/v1/chat/completions');
  if (!/\/chat\/completions\/?$/.test(url)) url = url.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: model || (gemini ? 'gemini-2.5-flash' : 'gpt-4o-mini'), max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...msgs] })
  });
  if (!res.ok) throw new Error('LLM ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const j = await res.json();
  const c = j.choices?.[0]?.message?.content;
  return (Array.isArray(c) ? c.map((x) => x.text || '').join('') : c || '').trim();
}

export { knowledge };
