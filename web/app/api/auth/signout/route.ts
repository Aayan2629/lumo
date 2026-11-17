import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { signOut } from '@/lib/auth';

export async function POST() {
  await signOut();
  return NextResponse.redirect(`${env.appUrl}/`, 303);
}
