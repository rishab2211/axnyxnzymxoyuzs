import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Compass,
  BarChart3,
  ShieldCheck,
  Workflow,
  Wind,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { formatDateUTC } from '@/lib/formatters';

const navigationItems = [
  { name: 'Overview', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Forecast Explorer', to: '/forecasts', icon: Compass },
  { name: 'Accuracy Analytics', to: '/accuracy', icon: BarChart3 },
  { name: 'Data Quality', to: '/data-quality', icon: ShieldCheck },
  { name: 'Data Pipeline', to: '/pipeline', icon: Workflow },
];

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const SidebarContent: React.FC<{ onClose?: () => void; isMobile?: boolean }> = ({
  onClose,
  isMobile,
}) => {
  const { data: bounds } = useQuery({
    queryKey: ['data-bounds'],
    queryFn: () => api.getDataBounds(),
    staleTime: 60_000,
  });
  return (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Wind className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">WindScope</h1>
            <p className="text-[11px] text-slate-400 font-mono">Day-Ahead Intel</p>
          </div>
        </div>
        {isMobile && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Intelligence Modules
        </div>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                if (isMobile && onClose) onClose();
              }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 font-semibold border-l-2 border-teal-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Scope Metadata Card */}
      <div className="p-3.5 mx-3 mb-5 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
        <div className="flex items-center gap-2 mb-1.5 text-slate-200 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-100">Live Evaluation Scope</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          National GB Wind (<span className="text-teal-300 font-mono">FUELHH</span> &amp; <span className="text-blue-300 font-mono">WINDFOR</span>)
        </p>
        {bounds?.min_date && bounds?.max_date ? (
          <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-col gap-0.5 text-[10px] text-slate-400 font-mono">
            <div className="flex justify-between items-center text-slate-300">
              <span>Database Scope:</span>
              <span className="font-bold text-teal-400">{bounds.total_actual_records.toLocaleString()} records</span>
            </div>
            <div className="text-slate-400 text-[10px]">
              {formatDateUTC(bounds.min_date)} &rarr; {formatDateUTC(bounds.max_date)}
            </div>
          </div>
        ) : (
          <div className="mt-1.5 text-[10px] text-slate-400">Loading dataset bounds...</div>
        )}
      </div>

      {/* Footer System Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>v1.0.0 Production</span>
        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono">BMRS LIVE</span>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  return (
    <>
      {/* Desktop Sidebar (lg and above) */}
      <aside className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex-col shrink-0 min-h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer (screens below lg) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-full z-10 shadow-2xl">
            <SidebarContent onClose={onClose} isMobile={true} />
          </aside>
        </div>
      )}
    </>
  );
};
