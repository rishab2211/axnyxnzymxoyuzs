import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  BarChart3,
  ShieldCheck,
  Workflow,
  Wind,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigationItems = [
  { name: 'Overview', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Forecast Explorer', to: '/forecasts', icon: Compass },
  { name: 'Accuracy Analytics', to: '/accuracy', icon: BarChart3 },
  { name: 'Data Quality', to: '/data-quality', icon: ShieldCheck },
  { name: 'Data Pipeline', to: '/pipeline', icon: Workflow },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
          <Wind className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide">WindScope</h1>
          <p className="text-[11px] text-slate-400 font-mono">Day-Ahead Intel</p>
        </div>
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
      <div className="p-4 mx-3 mb-6 bg-slate-800/50 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2 mb-2 text-slate-200 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Evaluation Scope</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          National GB Wind Only (FUELHH & WINDFOR). Evaluation period: Jan 1–31, 2026.
        </p>
      </div>

      {/* Footer System Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>v1.0.0 Production</span>
        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono">BMRS LIVE</span>
      </div>
    </aside>
  );
};
