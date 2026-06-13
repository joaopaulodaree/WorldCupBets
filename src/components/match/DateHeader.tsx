'use client';

export function DateHeader({ dateKey }: { dateKey: string }) {
  // dateKey is YYYY-MM-DD UTC — parse as local date to display in user's timezone
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  const formatted = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(date);
  const label = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${formatted}`;

  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="font-display text-lg tracking-wider whitespace-nowrap"
        style={{ color: 'var(--brand-yellow)' }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
    </div>
  );
}
