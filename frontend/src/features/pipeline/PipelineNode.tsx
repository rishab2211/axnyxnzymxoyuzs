import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { PIPELINE_METADATA } from './pipelineData';
import { Database, Radio, Cpu, Server, Layout, ArrowRight } from 'lucide-react';

export const PipelineNode: React.FC<NodeProps> = ({ id, selected }) => {
  const meta = PIPELINE_METADATA[id];

  if (!meta) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs">
        Node: {id}
      </div>
    );
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'Source':
        return <Radio className="w-3.5 h-3.5 text-blue-600" />;
      case 'Processing':
        return <Cpu className="w-3.5 h-3.5 text-amber-600" />;
      case 'Storage':
        return <Database className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Analytics':
        return <Cpu className="w-3.5 h-3.5 text-teal-600" />;
      case 'API':
        return <Server className="w-3.5 h-3.5 text-indigo-600" />;
      case 'Frontend':
        return <Layout className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <ArrowRight className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const getStageBadgeColor = (stage: string) => {
    switch (stage) {
      case 'Source':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Processing':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Storage':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Analytics':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'API':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Frontend':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div
      className={`w-64 bg-white rounded-xl border p-4 shadow-sm transition-all cursor-pointer ${
        selected
          ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md scale-[1.02]'
          : 'border-slate-200 hover:border-slate-300 hover:shadow'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-2.5 h-2.5 !bg-teal-600 !border-2 !border-white"
      />

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {getStageIcon(meta.stage)}
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {meta.stage}
          </span>
        </div>
        <span
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${getStageBadgeColor(
            meta.stage
          )}`}
        >
          {meta.badge}
        </span>
      </div>

      <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">{meta.name}</h4>
      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
        {meta.summary}
      </p>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate max-w-[140px] font-mono text-[10px] text-slate-500">
          {meta.codeReference.split('/').slice(-2).join('/')}
        </span>
        <span className="text-teal-600 font-semibold hover:underline">Inspect &rarr;</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-2.5 h-2.5 !bg-teal-600 !border-2 !border-white"
      />
    </div>
  );
};
