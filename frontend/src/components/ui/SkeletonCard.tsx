import React from 'react';
import { cn } from '@/lib/utils';

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-5 shadow-xs animate-pulse', className)}>
      <div className="flex justify-between items-center mb-3">
        <div className="h-3 bg-slate-200 rounded w-1/3"></div>
        <div className="h-3 w-3 bg-slate-200 rounded-full"></div>
      </div>
      <div className="h-8 bg-slate-200 rounded w-1/2 mb-4"></div>
      <div className="h-3 bg-slate-100 rounded w-full pt-2"></div>
    </div>
  );
};
