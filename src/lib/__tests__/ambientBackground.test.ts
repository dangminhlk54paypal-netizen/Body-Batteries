import { ambientTint, mixHex } from '../ambientBackground';
import { darkColors } from '../theme';

describe('mixHex', () => {
  it('returns the ends at t = 0 and t = 1', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('blends halfway and clamps t', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#102030', '#405060', 2)).toBe('#405060');
    expect(mixHex('#102030', '#405060', -1)).toBe('#102030');
  });
});

describe('ambientTint', () => {
  it('is coral when nearly empty, mint when full, amber in between', () => {
    expect(ambientTint(0)).toBe(darkColors.statusLow.toLowerCase());
    expect(ambientTint(100)).toBe(darkColors.statusGood.toLowerCase());
    expect(ambientTint(45)).toBe(darkColors.statusMid.toLowerCase());
  });

  it('clamps out-of-range input', () => {
    expect(ambientTint(-20)).toBe(ambientTint(0));
    expect(ambientTint(140)).toBe(ambientTint(100));
  });

  it('changes gradually between anchors', () => {
    const a = ambientTint(60);
    expect(a).not.toBe(ambientTint(45));
    expect(a).not.toBe(ambientTint(80));
    expect(a).toMatch(/^#[0-9a-f]{6}$/);
  });
});
