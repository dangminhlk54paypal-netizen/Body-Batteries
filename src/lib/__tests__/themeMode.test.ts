import { darkColors, lightColors, resolveThemeMode } from '../theme';

describe('resolveThemeMode', () => {
  it('keeps an explicit choice regardless of the phone setting', () => {
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
    expect(resolveThemeMode('light', 'dark')).toBe('light');
  });

  it('follows the phone in system mode and falls back to dark', () => {
    expect(resolveThemeMode('system', 'light')).toBe('light');
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', null)).toBe('dark');
    expect(resolveThemeMode('system', undefined)).toBe('dark');
  });
});

describe('palette', () => {
  it('uses a soft white, not pure #fff, for dark-mode primary text', () => {
    expect(darkColors.textPrimary.toLowerCase()).not.toBe('#fff');
    expect(darkColors.textPrimary.toLowerCase()).not.toBe('#ffffff');
  });

  it('keeps "low" status off the alarm reds in both themes', () => {
    for (const c of [darkColors, lightColors]) {
      expect(c.statusLow).not.toBe(c.danger);
      expect(c.statusLow).not.toBe(c.dangerStrong);
    }
  });
});
