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
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

export function formatDateTimeUTC(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes} UTC`;
  } catch {
    return '—';
  }
}

export function formatDateUTC(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return '—';
  }
}
