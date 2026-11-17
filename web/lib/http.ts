import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { RateLimitError } from './ratelimit';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function parse<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const body = await req.json().catch(() => ({}));
  return schema.parse(body);
}

// Wraps a route: validation errors are 400, rate limits 429, everything else a plain 500
// with no internals leaked.
export function route<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof ZodError) return json({ error: 'Invalid input', issues: e.issues.map((i) => i.path.join('.')) }, 400);
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof RateLimitError) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(e.retryAfterSec) } });
      if (e && typeof e === 'object' && 'digest' in e) throw e; // Next.js redirect / notFound
      console.error(e);
      return json({ error: 'Something went wrong' }, 500);
    }
  };
}
