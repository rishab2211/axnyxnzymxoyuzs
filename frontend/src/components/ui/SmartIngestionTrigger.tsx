import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { RefreshCw, DownloadCloud, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDateUTC } from '@/lib/formatters';

interface SmartIngestionTriggerProps {
  startDate: string;
  endDate?: string;
  dataset?: 'ALL' | 'FUELHH' | 'WINDFOR';
  title?: string;
  description?: string;
  variant?: 'card' | 'banner' | 'button';
  buttonLabel?: string;
  onSuccess?: () => void;
}

export const SmartIngestionTrigger: React.FC<SmartIngestionTriggerProps> = ({
  startDate,
  endDate,
  dataset = 'ALL',
  title = 'Data Not Ingested for Selected Period',
  description,
  variant = 'card',
  buttonLabel,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const targetEnd = endDate || startDate;
  const isSingleDay = startDate === targetEnd;
  const formattedStart = formatDateUTC(startDate);
  const formattedEnd = formatDateUTC(targetEnd);
  const dateLabel = isSingleDay ? formattedStart : `${formattedStart} to ${formattedEnd}`;

  const mutation = useMutation({
    mutationFn: async () => {
      setFeedback(null);
      return await api.triggerIngest(dataset, startDate, targetEnd);
    },
    onSuccess: (res) => {
      setFeedback({
        type: 'success',
        message: res?.message || `Successfully ingested Elexon records for ${dateLabel}.`,
      });
      // Invalidate all analytical and health caches across the application
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['forecasts'] });
      queryClient.invalidateQueries({ queryKey: ['vintages'] });
      queryClient.invalidateQueries({ queryKey: ['accuracy-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accuracy-trend'] });
      queryClient.invalidateQueries({ queryKey: ['accuracy-distribution'] });
      queryClient.invalidateQueries({ queryKey: ['accuracy-worst'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality'] });
      queryClient.invalidateQueries({ queryKey: ['data-bounds'] });
      queryClient.invalidateQueries({ queryKey: ['health'] });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (err: Error) => {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to ingest data from Elexon BMRS.',
      });
    },
  });

  const defaultDescription = description || (
    `The local database does not have generation or forecast records for ${dateLabel}. ` +
    `Triggering on-demand ingestion will query Elexon BMRS (FUELHH actuals & WINDFOR forecasts) and populate the database.`
  );

  const defaultButtonLabel = buttonLabel || (
    mutation.isPending
      ? 'Ingesting from Elexon...'
      : `Fetch & Ingest ${dateLabel}`
  );

  if (variant === 'button') {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <DownloadCloud className="w-3.5 h-3.5" />
          )}
          <span>{defaultButtonLabel}</span>
        </button>
        {feedback && (
          <p className={`text-[11px] ${feedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {feedback.message}
          </p>
        )}
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">{title}:</span> {defaultDescription}
            {feedback && (
              <p className={`mt-1 font-medium ${feedback.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {feedback.message}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{defaultButtonLabel}</span>
        </button>
      </div>
    );
  }

  // Default 'card' variant
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center max-w-lg mx-auto shadow-xs">
      <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto mb-4">
        {mutation.isPending ? (
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
        ) : (
          <DownloadCloud className="w-6 h-6 text-teal-600" />
        )}
      </div>

      <h3 className="text-base font-bold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-md mx-auto">
        {defaultDescription}
      </p>

      {feedback && (
        <div
          className={`mb-5 p-3 rounded-lg text-xs flex items-center gap-2 text-left ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Contacting Elexon BMRS...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{defaultButtonLabel}</span>
            </>
          )}
        </button>
      </div>

      {mutation.isPending && (
        <p className="text-[11px] text-slate-400 mt-3 animate-pulse">
          Fetching chunked records and updating outturn tables. This typically takes 10–25 seconds.
        </p>
      )}
    </div>
  );
};
