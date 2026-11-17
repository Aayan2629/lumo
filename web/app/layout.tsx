import './globals.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'Lumo · Verified renters, real homes',
  description: 'Verify once, swipe on homes with real suburb data, and land in the agent’s inbox as a verified lead.',
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f5f5f7' };

// Reading headers makes every page render per request, so each response gets a fresh CSP
// nonce (set in middleware.ts) that Next.js attaches to its own scripts.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
