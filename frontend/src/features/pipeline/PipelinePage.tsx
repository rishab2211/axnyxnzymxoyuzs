import React, { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { PageShell } from '@/components/layout/PageShell';

import { PipelineNode } from './PipelineNode';
import { NodeInfoPanel } from './NodeInfoPanel';
import { INITIAL_NODES, INITIAL_EDGES, PIPELINE_METADATA } from './pipelineData';
import { Workflow, Info } from 'lucide-react';

export const PipelinePage: React.FC = () => {
  const [nodes, , onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('engine-vintage');

  const nodeTypes = useMemo(() => ({ pipelineNode: PipelineNode }), []);

  // Fetch cached health, data bounds, and data-quality data without redundant polling
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    staleTime: 60_000,
  });

  const { data: bounds } = useQuery({
    queryKey: ['data-bounds'],
    queryFn: () => api.getDataBounds(),
    staleTime: 60_000,
  });

  const { data: quality } = useQuery({
    queryKey: ['data-quality', bounds?.min_date || '2026-01-01', bounds?.max_date || '2026-01-31'],
    queryFn: () => api.getDataQuality(bounds?.min_date || '2026-01-01', bounds?.max_date || '2026-01-31'),
    staleTime: 60_000,
  });

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const activeMetadata = selectedNodeId ? PIPELINE_METADATA[selectedNodeId] : null;

  const liveStats = {
    actualCount: bounds?.total_actual_records ?? quality?.actual_30m_records ?? health?.tables?.actual_generation,
    forecastCount: bounds?.total_forecast_records ?? quality?.forecasts_available ?? health?.tables?.wind_forecasts,
    matchedCount: quality?.matched_intervals,
    hourlyActualCount: quality?.hourly_actuals_available ?? health?.tables?.actual_generation_hourly,
    dbStatus: health?.database?.status === 'connected' ? 'Connected (Healthy)' : 'Operational',
  };

  return (
    <PageShell
      title="Interactive Architecture & Data Pipeline"
      subtitle="React Flow visual lineage explorer with live data counters and business rules inspection"
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg text-xs text-slate-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span>14 Pipeline Nodes • Live Cache Linked</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedNodeId(selectedNodeId ? null : 'engine-vintage')}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-xs transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-teal-600" />
            {selectedNodeId ? 'Hide Inspector' : 'Show Inspector'}
          </button>
        </div>
      }
    >
      <div className="relative w-full h-[720px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-xs flex">
        {/* ReactFlow Canvas Area */}
        <div className="flex-1 h-full relative">
          {/* Stage Progression Breadcrumb Bar at top */}
          <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-lg px-3 py-1.5 shadow-xs flex items-center gap-3 text-[11px] font-semibold text-slate-600 pointer-events-none">
            <span className="text-blue-700">1. Sources</span>
            <span className="text-slate-300">&rarr;</span>
            <span className="text-amber-700">2. Ingestion</span>
            <span className="text-slate-300">&rarr;</span>
            <span className="text-emerald-700">3. Storage</span>
            <span className="text-slate-300">&rarr;</span>
            <span className="text-teal-700">4. Analytics</span>
            <span className="text-slate-300">&rarr;</span>
            <span className="text-indigo-700">5. API</span>
            <span className="text-slate-300">&rarr;</span>
            <span className="text-purple-700">6. Frontend</span>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            minZoom={0.2}
            maxZoom={1.8}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          >
            <Background color="#cbd5e1" gap={20} size={1} variant={BackgroundVariant.Dots} />
            <Controls className="bg-white border-slate-200 shadow-xs rounded-lg overflow-hidden !m-3" />
            <MiniMap
              className="!bg-white !border-slate-200 !shadow-xs !rounded-lg overflow-hidden !m-3"
              nodeStrokeColor="#0d9488"
              nodeColor="#f1f5f9"
              nodeBorderRadius={4}
            />
          </ReactFlow>

          {/* Prompt to click on node */}
          {!selectedNodeId && (
            <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 shadow-xs flex items-center gap-2">
              <Workflow className="w-4 h-4 text-teal-600" />
              <span>Click on any node to inspect business rules, inputs/outputs, and live records.</span>
            </div>
          )}
        </div>

        {/* Slide-in Node Info Panel */}
        {selectedNodeId && (
          <NodeInfoPanel
            nodeMeta={activeMetadata}
            onClose={() => setSelectedNodeId(null)}
            liveStats={liveStats}
          />
        )}
      </div>
    </PageShell>
  );
};
