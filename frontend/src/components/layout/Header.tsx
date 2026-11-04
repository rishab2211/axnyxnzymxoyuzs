import React from 'react';
import { Calendar, Clock, AlertCircle, Menu } from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';
import { MetricTooltip } from '@/components/ui/MetricTooltip';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onOpenMobileMenu }) => {
  const { deliveryDate, decisionCutoff, setDeliveryDate, setDecisionCutoff } = useFilters();

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 sm:py-5 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{subtitle}</p>}
        </div>
      </div>

      {/* Global Analytical Context Filters */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        {/* Delivery Date Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="font-semibold text-slate-500 hidden sm:inline">Delivery:</span>
          <input
            type="date"
            min="2026-01-01"
            max="2026-01-31"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer"
          />
        </div>

        {/* Decision Cutoff Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs text-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="font-semibold text-slate-500 hidden sm:inline">Cutoff:</span>
          <select
            value={decisionCutoff}
            onChange={(e) => setDecisionCutoff(e.target.value)}
            className="bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer text-xs"
          >
            <option value="08:00">08:00 UTC</option>
            <option value="09:00">09:00 UTC</option>
            <option value="10:00">10:00 UTC</option>
            <option value="11:00">11:00 UTC (Default)</option>
            <option value="12:00">12:00 UTC</option>
            <option value="14:00">14:00 UTC</option>
            <option value="16:00">16:00 UTC</option>
          </select>
          <MetricTooltip content="Day-ahead procurement decision cutoff. Only forecasts published strictly ON or BEFORE this timestamp are eligible. Default 11:00 UTC is an evaluation assumption." />
        </div>

        {/* Context Badge */}
        <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Cutoff: {decisionCutoff} UTC [Assumption]</span>
        </div>
      </div>
    </header>
  );
};
