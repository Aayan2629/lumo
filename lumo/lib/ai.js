// Lumo's voice. With an Anthropic key, Lumo answers in its own words using the knowledge files,
// the listing and the checks. Without one, the content script answers from rules (see content/chat.js).

let KB = null;
async function knowledge() {
  if (KB) return KB;
  const load = async (f) => (await fetch(chrome.runtime.getURL('knowledge/' + f))).json();
  const [findings, surroundings, claims, sources] = await Promise.all([load('findings.json'), load('surroundings.json'), load('claims.json'), load('data-sources.json')]);
  KB = { findings, surroundings, claims, sources };
  return KB;
}

function systemPrompt(kb, ctx) {
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

export async function askLLM(S, ctx, history) {
  if (!S.anthropicKey) return null;
  const kb = await knowledge();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': S.anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: S.anthropicModel || 'claude-haiku-5-5', max_tokens: 400, system: systemPrompt(kb, ctx), messages: history })
  });
  if (!res.ok) throw new Error('Anthropic ' + res.status);
  const j = await res.json();
  return (j.content || []).map((b) => b.text || '').join('').trim();
}

// Optional spoken reply for the demo video. Returns a data URL the page can play.
export async function speak(S, text) {
  if (!S.elevenLabsKey || !S.elevenLabsVoice) return null;
  const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + S.elevenLabsVoice, {
    method: 'POST',
    headers: { 'xi-api-key': S.elevenLabsKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5' })
  });
  if (!res.ok) throw new Error('ElevenLabs ' + res.status);
  const buf = new Uint8Array(await res.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return 'data:audio/mpeg;base64,' + btoa(s);
}

export { knowledge };
