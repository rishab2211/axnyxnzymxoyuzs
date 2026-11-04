import React from 'react';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  children,
  headerAction,
  className,
}) => {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-6 shadow-xs', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
};
