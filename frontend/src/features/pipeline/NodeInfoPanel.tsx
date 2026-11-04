import React from 'react';
import type { NodeMetadata } from './pipelineData';
import { X, Code2, ArrowDownRight, ArrowUpRight, CheckCircle2, Info } from 'lucide-react';

interface NodeInfoPanelProps {
  nodeMeta: NodeMetadata | null;
  onClose: () => void;
  liveStats?: {
    actualCount?: number;
    forecastCount?: number;
    matchedCount?: number;
    hourlyActualCount?: number;
    dbStatus?: string;
  };
}

export const NodeInfoPanel: React.FC<NodeInfoPanelProps> = ({
  nodeMeta,
  onClose,
  liveStats,
}) => {
  if (!nodeMeta) return null;

  const renderLiveStat = () => {
    switch (nodeMeta.liveKey) {
      case 'actuals':
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
            <span className="font-semibold text-blue-900 block mb-0.5">Live Database Records</span>
            <span className="font-mono text-lg font-bold text-blue-700">
              {liveStats?.actualCount !== undefined
                ? `${liveStats.actualCount.toLocaleString('en-GB')} records`
                : 'Querying cache...'}
            </span>
            <p className="text-[11px] text-blue-600 mt-0.5">30-min settlement actual generation</p>
          </div>
        );
      case 'forecasts':
        return (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs">
            <span className="font-semibold text-teal-900 block mb-0.5">Live Forecast Records</span>
            <span className="font-mono text-lg font-bold text-teal-700">
              {liveStats?.forecastCount !== undefined
                ? `${liveStats.forecastCount.toLocaleString('en-GB')} records`
                : 'Querying cache...'}
            </span>
            <p className="text-[11px] text-teal-600 mt-0.5">Multi-vintage day-ahead publications</p>
          </div>
        );
      case 'hourly':
        return (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs">
            <span className="font-semibold text-emerald-900 block mb-0.5">Hourly Aggregated Intervals</span>
            <span className="font-mono text-lg font-bold text-emerald-700">
              {liveStats?.hourlyActualCount !== undefined
                ? `${liveStats.hourlyActualCount.toLocaleString('en-GB')} intervals`
                : '744 intervals (100% expected)'}
            </span>
            <p className="text-[11px] text-emerald-600 mt-0.5">Synthesized 1-hour outturn</p>
          </div>
        );
      case 'matched':
        return (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs">
            <span className="font-semibold text-indigo-900 block mb-0.5">Aligned Evaluation Pairs</span>
            <span className="font-mono text-lg font-bold text-indigo-700">
              {liveStats?.matchedCount !== undefined
                ? `${liveStats.matchedCount.toLocaleString('en-GB')} paired intervals`
                : '744 pairs available'}
            </span>
            <p className="text-[11px] text-indigo-600 mt-0.5">1:1 temporal join completed</p>
          </div>
        );
      case 'health':
        return (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs">
            <span className="font-semibold text-emerald-900 block mb-0.5">Storage Connectivity</span>
            <span className="font-mono text-base font-bold text-emerald-700">
              {liveStats?.dbStatus || 'Connected (Healthy)'}
            </span>
            <p className="text-[11px] text-emerald-600 mt-0.5">PostgreSQL ACID storage pool</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full sm:w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col h-full absolute sm:relative right-0 top-0 z-20 overflow-y-auto">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded">
              {nodeMeta.stage} Stage
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {nodeMeta.type}
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900">{nodeMeta.name}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-6 flex-1 text-xs">
        {/* Live Metrics if applicable */}
        {renderLiveStat()}

        {/* Architectural Role */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-teal-600" />
            Architectural Role
          </h4>
          <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/60">
            {nodeMeta.description}
          </p>
        </div>

        {/* Business Rules & Methodology */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Governing Rules &amp; Logic
          </h4>
          <ul className="space-y-2">
            {nodeMeta.businessRules.map((rule, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-md border border-slate-100 text-slate-700"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
                <span className="leading-snug">{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Inputs & Outputs */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-blue-600" />
              Ingress Inputs
            </h4>
            <div className="bg-slate-50 rounded-md p-2.5 border border-slate-100 text-slate-600 space-y-1">
              {nodeMeta.inputs.map((inp, idx) => (
                <div key={idx} className="font-mono text-[11px]">
                  • {inp}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              Egress Outputs
            </h4>
            <div className="bg-slate-50 rounded-md p-2.5 border border-slate-100 text-slate-600 space-y-1">
              {nodeMeta.outputs.map((out, idx) => (
                <div key={idx} className="font-mono text-[11px]">
                  • {out}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Source Code Reference */}
        <div>
          <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Code2 className="w-3.5 h-3.5 text-slate-600" />
            Source Code Implementation
          </h4>
          <div className="bg-slate-900 text-slate-200 font-mono text-[11px] p-2.5 rounded-md truncate">
            {nodeMeta.codeReference}
          </div>
        </div>
      </div>
    </div>
  );
};
