import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  AlertCircle,
  Menu,
  DownloadCloud,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';
import { MetricTooltip } from '@/components/ui/MetricTooltip';
import { SmartIngestionTrigger } from '@/components/ui/SmartIngestionTrigger';
import { api } from '@/services/api';
import { formatDateUTC } from '@/lib/formatters';
import { DateInput } from '@/components/ui/DateInput';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onOpenMobileMenu }) => {
  const { deliveryDate, decisionCutoff, setDeliveryDate, setDecisionCutoff } = useFilters();
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [modalStartDate, setModalStartDate] = useState(deliveryDate);
  const [modalEndDate, setModalEndDate] = useState(deliveryDate);

  const { data: bounds } = useQuery({
    queryKey: ['data-bounds'],
    queryFn: () => api.getDataBounds(),
    staleTime: 60_000,
  });

  const isDateOutsideBounds = Boolean(
    bounds?.min_date &&
    bounds?.max_date &&
    (deliveryDate < bounds.min_date || deliveryDate > bounds.max_date)
  );

  const stepDate = (days: number) => {
    try {
      const current = new Date(deliveryDate + 'T00:00:00Z');
      if (isNaN(current.getTime())) return;
      current.setUTCDate(current.getUTCDate() + days);
      setDeliveryDate(current.toISOString().slice(0, 10));
    } catch {
      // ignore
    }
  };

  return (
    <>
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
          {/* Delivery Date Stepper */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs text-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => stepDate(-1)}
              className="p-1 hover:bg-slate-200/70 rounded text-slate-500 hover:text-slate-800 transition-colors"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 pointer-events-none" />
              <DateInput
                value={deliveryDate}
                onChange={setDeliveryDate}
              />
            </div>
            <button
              type="button"
              onClick={() => stepDate(1)}
              className="p-1 hover:bg-slate-200/70 rounded text-slate-500 hover:text-slate-800 transition-colors"
              title="Next Day"
              aria-label="Next Day"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Jump to Latest Ingested Date Button */}
          {bounds?.max_date && deliveryDate !== bounds.max_date && (
            <button
              type="button"
              onClick={() => setDeliveryDate(bounds.max_date!)}
              className="hidden md:inline-flex items-center px-2 py-1 rounded bg-slate-100 hover:bg-slate-200/80 text-[11px] font-medium text-slate-600 transition-colors"
              title={`Jump to latest ingested date (${formatDateUTC(bounds.max_date)})`}
            >
              Latest ({formatDateUTC(bounds.max_date)})
            </button>
          )}

          {/* Quick Alert button if date is not currently in DB */}
          {isDateOutsideBounds && (
            <button
              type="button"
              onClick={() => {
                setModalStartDate(deliveryDate);
                setModalEndDate(deliveryDate);
                setShowIngestModal(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              title={`Date ${formatDateUTC(deliveryDate)} is outside local database records (${formatDateUTC(bounds?.min_date)} to ${formatDateUTC(bounds?.max_date)}). Click to ingest.`}
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Ingest {formatDateUTC(deliveryDate)}</span>
            </button>
          )}

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
            <MetricTooltip
              title="Day-Ahead Decision Cutoff"
              content="Day-ahead procurement decision cutoff. Only forecasts published strictly ON or BEFORE this timestamp are eligible. Default 11:00 UTC is an evaluation assumption."
              side="bottom"
              align="center"
            />
          </div>

          {/* Smart Ingest Modal Trigger Button */}
          <button
            type="button"
            onClick={() => {
              setModalStartDate(deliveryDate);
              setModalEndDate(deliveryDate);
              setShowIngestModal(true);
            }}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span className="hidden sm:inline">Smart Ingest</span>
          </button>

          {/* Context Badge */}
          <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Cutoff: {decisionCutoff} UTC [Assumption]</span>
          </div>
        </div>
      </header>

      {/* On-Demand Ingestion Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Smart On-Demand Ingestion</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIngestModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs text-slate-600 mb-3">
                  Query and pull actual wind generation (<code className="text-teal-700 font-semibold">FUELHH</code>) and day-ahead forecast (<code className="text-teal-700 font-semibold">WINDFOR</code>) horizons directly from the official Elexon BMRS API.
                </p>
                {bounds?.min_date && bounds?.max_date && (
                  <div className="bg-slate-100/80 rounded-lg p-2.5 text-[11px] text-slate-600 flex items-center justify-between mb-4">
                    <span className="font-medium text-slate-500">Currently in Database:</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateUTC(bounds.min_date)} to {formatDateUTC(bounds.max_date)} ({bounds.total_actual_records.toLocaleString()} actuals)
                    </span>
                  </div>
                )}
              </div>

              {/* Target Period Pickers */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Target Ingestion Period</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1">Start Date</span>
                    <div className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white flex items-center justify-between">
                      <DateInput
                        value={modalStartDate}
                        onChange={setModalStartDate}
                        className="w-full"
                      />
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1">End Date</span>
                    <div className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white flex items-center justify-between">
                      <DateInput
                        value={modalEndDate}
                        onChange={setModalEndDate}
                        className="w-full"
                      />
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ingestion Trigger Button Component */}
              <div className="pt-2">
                <SmartIngestionTrigger
                  startDate={modalStartDate}
                  endDate={modalEndDate}
                  dataset="ALL"
                  variant="card"
                  title="Fetch & Ingest Dataset"
                  description={`Fetches both FUELHH actuals and WINDFOR forecasts from ${formatDateUTC(modalStartDate)} to ${formatDateUTC(modalEndDate)}.`}
                  buttonLabel={`Execute Ingestion (${formatDateUTC(modalStartDate)} to ${formatDateUTC(modalEndDate)})`}
                  onSuccess={() => {
                    setDeliveryDate(modalStartDate);
                    setShowIngestModal(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
