import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

const DEFAULT_DATE = '2026-01-01';
const DEFAULT_CUTOFF = '11:00';

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const deliveryDate = searchParams.get('date') || DEFAULT_DATE;
  const decisionCutoff = searchParams.get('cutoff') || DEFAULT_CUTOFF;

  const setDeliveryDate = useCallback(
    (newDate: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('date', newDate);
        return next;
      });
    },
    [setSearchParams]
  );

  const setDecisionCutoff = useCallback(
    (newCutoff: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('cutoff', newCutoff);
        return next;
      });
    },
    [setSearchParams]
  );

  const setFilters = useCallback(
    (newDate: string, newCutoff: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('date', newDate);
        next.set('cutoff', newCutoff);
        return next;
      });
    },
    [setSearchParams]
  );

  return {
    deliveryDate,
    decisionCutoff,
    setDeliveryDate,
    setDecisionCutoff,
    setFilters,
  };
}
