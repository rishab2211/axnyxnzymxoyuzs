import React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { ShieldCheck } from 'lucide-react';

export const DataQualityPage: React.FC = () => {
  return (
    <PageShell
      title="Data Quality & Lineage Diagnostics"
      subtitle="Expose interval completeness, ingestion records, and missing observation reports"
    >
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <ShieldCheck className="w-12 h-12 text-teal-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Data Lineage & Diagnostics</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Expected vs received interval validation, missing timestamps, and historical Elexon BMRS ingestion runs.
        </p>
      </div>
    </PageShell>
  );
};
