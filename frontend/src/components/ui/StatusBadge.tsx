import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
  showDot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  danger: {
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  neutral: {
    bg: 'bg-slate-100 border-slate-200',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant,
  className,
  showDot = true,
}) => {
  const resolvedVariant: BadgeVariant = React.useMemo(() => {
    if (variant) return variant;
    const lower = (label || '').toLowerCase();
    if (['success', 'matched', 'healthy', 'connected', 'eligible'].some((k) => lower.includes(k))) return 'success';
    if (['failed', 'danger', 'error', 'missing'].some((k) => lower.includes(k))) return 'danger';
    if (['warning', 'partial', 'degraded'].some((k) => lower.includes(k))) return 'warning';
    if (['running', 'info', 'in progress'].some((k) => lower.includes(k))) return 'info';
    return 'neutral';
  }, [variant, label]);

  const styles = variantStyles[resolvedVariant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        styles.bg,
        styles.text,
        className
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)} />}
      {label}
    </span>
  );
};
