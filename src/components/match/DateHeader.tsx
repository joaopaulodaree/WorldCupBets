'use client';

interface DateHeaderProps {
  dateKey: string;
  isToday?: boolean;
  isPast?: boolean;
  collapsed?: boolean;
  matchCount?: number;
  onToggle?: () => void;
}

export function DateHeader({ dateKey, isToday, isPast, collapsed, matchCount, onToggle }: DateHeaderProps) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  const formatted = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(date);
  const label = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${formatted}`;

  const inner = (
    <div className="flex items-center gap-3 mb-4 w-full">
      <span
        className="font-display text-lg tracking-wider whitespace-nowrap"
        style={{ color: isToday ? 'var(--brand-green)' : 'var(--brand-yellow)' }}
      >
        {label}
      </span>
      {isToday && (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full tracking-widest"
          style={{ background: 'var(--brand-green)', color: '#000' }}
        >
          HOJE
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
      {isPast && collapsed && matchCount != null && (
        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
          {matchCount} {matchCount === 1 ? 'jogo' : 'jogos'}
        </span>
      )}
      {isPast && (
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
          {collapsed ? '▸' : '▾'}
        </span>
      )}
    </div>
  );

  if (isPast && onToggle) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center w-full text-left"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        {inner}
      </button>
    );
  }

  return <div className="flex items-center w-full">{inner}</div>;
}
