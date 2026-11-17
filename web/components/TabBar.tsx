'use client';
import { usePathname } from 'next/navigation';

const TABS = [['/app', 'Swipe'], ['/app/saved', 'Saved'], ['/app/matches', 'Matches'], ['/app/profile', 'Profile']] as const;
export function TabBar() {
  const p = usePathname();
  return (
    <nav className="tabbar glass" aria-label="Main">
      {TABS.map(([href, label]) => <a key={href} href={href} aria-current={p === href ? 'page' : undefined}>{label}</a>)}
    </nav>
  );
}
