// Pure "time ago" formatter (Vietnamese) for small sync-status captions
// (Apple Health badge on Home, "Last synced" line in Settings). No I/O, no
// Date.now() default baked in as a side effect — callers pass `nowMs`
// explicitly so this stays deterministic and easy to unit-test.

export function formatRelativeTime(ts: number, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - ts);
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
