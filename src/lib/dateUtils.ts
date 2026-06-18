// Format a Date as YYYY-MM-DD using LOCAL calendar fields. Using toISOString()
// here would key data by the UTC day, which rolls over at the wrong moment for
// any non-UTC timezone (e.g. an evening intake could land on "tomorrow").
export function dateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayString(): string {
  return dateString(new Date());
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateString(d);
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayString();
}

export function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / msPerDay;
}

export function formatDisplayDate(dateStr: string): string {
  // Parse as local midnight ('YYYY-MM-DD' alone is parsed as UTC, which can
  // render the previous day's weekday in negative-offset displays).
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function nowTimestamp(): number {
  return Date.now();
}
