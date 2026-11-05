export function formatMW(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return `${val.toLocaleString('en-GB', { maximumFractionDigits: 1 })} MW`;
}

export function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return `${val.toFixed(1)}%`;
}

export function formatTimeUTC(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

/**
 * Format datetime in DD-MM-YYYY HH:mm UTC format
 */
export function formatDateTimeUTC(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = d.getUTCFullYear();
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes} UTC`;
  } catch {
    return '—';
  }
}

/**
 * Format date in DD-MM-YYYY format
 */
export function formatDateUTC(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    if (typeof isoString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
      const [y, m, d] = isoString.split('-');
      return `${d}-${m}-${y}`;
    }
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return '—';
  }
}

export const formatDateDDMMYYYY = formatDateUTC;
