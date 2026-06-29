'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Header() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
      style={{
        background: 'rgba(8, 12, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <Link href="/" className="flex items-center gap-2 select-none">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--brand-green)' }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <circle cx="12" cy="12" r="10" fill="none" stroke="#000" strokeWidth="1.5" />
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
              fill="#000"
              opacity="0.2"
            />
            <path
              d="M12 6l1.5 3.5L17 10l-2.5 2.5.5 3.5L12 14.5 9 16l.5-3.5L7 10l3.5-.5L12 6z"
              fill="#000"
            />
          </svg>
        </div>
        <span
          className="font-display text-xl tracking-wide"
          style={{ color: 'var(--text-primary)' }}
        >
          COPA 2026
        </span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-6">
        {[
          { href: '/matches', label: 'Jogos' },
          { href: '/groups', label: 'Grupos' },
          { href: '/leaderboard', label: 'Ranking' },
          { href: '/knockout', label: 'Mata-mata' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        disabled={loading}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        style={{
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)',
          background: 'transparent',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)';
        }}
      >
        {loading ? '...' : 'Sair'}
      </button>
    </header>
  );
}
