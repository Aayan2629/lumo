import { z } from 'zod';
import { performAction } from '@/lib/email-actions';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ t: z.string().min(20).max(100), answer: z.string().max(20).optional(), startsAt: z.string().max(30).optional(), email: z.string().max(200).optional() });

export const POST = route(async (req: Request, ctx: { params: Promise<{ action: string }> }) => {
  const { action } = await ctx.params;
  const b = await parse(req, Body);
  const r = await performAction(action, b.t, b as Record<string, string>);
  return 'error' in r ? json({ error: r.error }, 400) : json({ message: r.message });
});
