import { NICKNAME_MAX_LENGTH, normalizeNickname } from '../nickname';

describe('normalizeNickname', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeNickname('  Minh   Anh \n')).toBe('Minh Anh');
  });

  it('turns a blank entry into "not set"', () => {
    expect(normalizeNickname('   ')).toBe('');
  });

  it('caps the length without leaving a trailing space', () => {
    const long = 'a'.repeat(NICKNAME_MAX_LENGTH - 1) + ' bcdef';
    const out = normalizeNickname(long);
    expect(out.length).toBeLessThanOrEqual(NICKNAME_MAX_LENGTH);
    expect(out).toBe('a'.repeat(NICKNAME_MAX_LENGTH - 1));
  });
});
