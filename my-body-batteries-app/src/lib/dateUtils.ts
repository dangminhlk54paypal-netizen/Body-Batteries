export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
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
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function nowTimestamp(): number {
  return Date.now();
}
