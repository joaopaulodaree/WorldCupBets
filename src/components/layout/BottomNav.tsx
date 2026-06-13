'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    href: '/matches',
    label: 'Jogos',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M12 3c0 0 1.5 3 1.5 9s-1.5 9-1.5 9M3 12h18M5.5 6.5c1.5 1 3.5 1.5 6.5 1.5s5-0.5 6.5-1.5M5.5 17.5c1.5-1 3.5-1.5 6.5-1.5s5 .5 6.5 1.5" />
      </svg>
    ),
  },
  {
    href: '/groups',
    label: 'Grupos',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18M3 3h18v18H3z" />
      </svg>
    ),
  },
  {
    href: '/leaderboard',
    label: 'Ranking',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21H5a2 2 0 01-2-2v-5l3-3M16 21h3a2 2 0 002-2v-5l-3-3M12 21V9M5 10V6a1 1 0 011-1h3M19 10V6a1 1 0 00-1-1h-3M12 9l-3-4 3-2 3 2-3 4z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'rgba(8, 12, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border-color)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors relative"
              style={{ color: active ? 'var(--brand-green)' : 'var(--text-tertiary)' }}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: 'var(--brand-green)' }}
                />
              )}
              {item.icon}
              <span
                className="text-xs font-medium"
                style={{ fontSize: '10px', letterSpacing: '0.03em' }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
