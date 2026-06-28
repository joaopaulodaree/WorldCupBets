'use client';

interface Props {
  label: string;
  pickCount: number;
  total: number;
  active: boolean;
  onClick: () => void;
}

export function RoundTab({ label, pickCount, total, active, onClick }: Props) {
  const complete = pickCount === total;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all flex-shrink-0"
      style={{
        background: active ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
        border: active ? '1px solid var(--brand-green)' : '1px solid transparent',
        color: active ? 'var(--brand-green)' : 'var(--text-secondary)',
      }}
    >
      <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
      <span
        className="text-xs"
        style={{ color: complete ? 'var(--brand-green)' : 'var(--text-tertiary)', fontSize: '10px' }}
      >
        {pickCount}/{total}
      </span>
    </button>
  );
}
