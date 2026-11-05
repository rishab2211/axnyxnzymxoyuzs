import React from 'react';
import { MetricTooltip } from '@/components/ui/MetricTooltip';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  description?: string;
  formula?: string;
  interpretation?: string;
  status?: 'good' | 'neutral' | 'warning' | 'danger';
  sampleCount?: number;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  unit,
  description,
  formula,
  interpretation,
  status = 'neutral',
  sampleCount,
  className,
}) => {
  const statusBorder = {
    good: 'border-l-4 border-l-emerald-500',
    neutral: 'border-l-4 border-l-slate-400',
    warning: 'border-l-4 border-l-amber-500',
    danger: 'border-l-4 border-l-rose-500',
  }[status];

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition-shadow hover:shadow-md flex flex-col justify-between',
        statusBorder,
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <span>{label}</span>
          {formula && (
            <MetricTooltip
              title={label}
              content={`Formula: ${formula}${interpretation ? ` • ${interpretation}` : ''}`}
              side="bottom"
              align="right"
            />
          )}
        </div>

        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value !== null && value !== undefined ? value : '—'}
          </span>
          {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>{description || (interpretation ? interpretation : 'Baseline KPI')}</span>
        {sampleCount !== undefined && (
          <span className="tabular-nums font-mono text-[11px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
            n={sampleCount}
          </span>
        )}
      </div>
    </div>
  );
};
