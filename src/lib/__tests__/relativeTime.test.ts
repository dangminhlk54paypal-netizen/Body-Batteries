import { formatRelativeTime } from '../relativeTime';

describe('formatRelativeTime', () => {
  const now = 1_000_000_000_000; // arbitrary fixed "now" in ms

  it('returns "vừa xong" for under a minute', () => {
    expect(formatRelativeTime(now - 30_000, now, 'vi')).toBe('vừa xong');
    expect(formatRelativeTime(now, now, 'vi')).toBe('vừa xong');
  });

  it('formats minutes', () => {
    expect(formatRelativeTime(now - 15 * 60_000, now, 'vi')).toBe('15 phút trước');
    expect(formatRelativeTime(now - 59 * 60_000, now, 'vi')).toBe('59 phút trước');
  });

  it('formats hours', () => {
    expect(formatRelativeTime(now - 60 * 60_000, now, 'vi')).toBe('1 giờ trước');
    expect(formatRelativeTime(now - 5 * 60 * 60_000, now, 'vi')).toBe('5 giờ trước');
    expect(formatRelativeTime(now - 23 * 60 * 60_000, now, 'vi')).toBe('23 giờ trước');
  });

  it('formats days', () => {
    expect(formatRelativeTime(now - 24 * 60 * 60_000, now, 'vi')).toBe('1 ngày trước');
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60_000, now, 'vi')).toBe('3 ngày trước');
  });

  it('clamps future timestamps to "vừa xong" instead of a negative value', () => {
    expect(formatRelativeTime(now + 60_000, now, 'vi')).toBe('vừa xong');
  });

  it('formats in English and German', () => {
    expect(formatRelativeTime(now - 15 * 60_000, now, 'en')).toBe('15 min ago');
    expect(formatRelativeTime(now - 60 * 60_000, now, 'de')).toBe('vor 1 Std.');
  });
});
