import React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Workflow } from 'lucide-react';

export const PipelinePage: React.FC = () => {
  return (
    <PageShell
      title="Interactive Architecture & Data Pipeline"
      subtitle="React Flow visual architecture showing ingestion, validation, and analytics lineage"
    >
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <Workflow className="w-12 h-12 text-teal-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">React Flow Pipeline Explorer</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Interactive node diagram visualizing the flow from Elexon API to normalization, storage, and accuracy calculations.
        </p>
      </div>
    </PageShell>
  );
};
