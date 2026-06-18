import { validateUserProfile } from '../profileValidation';
import type { UserProfile } from '../../../types/energy';

const valid: UserProfile = {
  weightKg: 78,
  heightCm: 168,
  age: 30,
  sex: 'male',
  occupation: 'sedentary',
};

describe('validateUserProfile', () => {
  it('accepts a valid profile', () => {
    expect(validateUserProfile(valid)).toBeNull();
  });

  it('accepts other plausible bodies (not just the example profile)', () => {
    expect(validateUserProfile({ ...valid, weightKg: 55, heightCm: 160, age: 25, sex: 'female' })).toBeNull();
    expect(validateUserProfile({ ...valid, weightKg: 120, heightCm: 195, age: 70 })).toBeNull();
  });

  it('rejects out-of-range weight', () => {
    expect(validateUserProfile({ ...valid, weightKg: 10 })).toMatch(/Cân nặng/);
    expect(validateUserProfile({ ...valid, weightKg: 500 })).toMatch(/Cân nặng/);
  });

  it('rejects out-of-range height', () => {
    expect(validateUserProfile({ ...valid, heightCm: 30 })).toMatch(/Chiều cao/);
    expect(validateUserProfile({ ...valid, heightCm: 400 })).toMatch(/Chiều cao/);
  });

  it('rejects out-of-range age', () => {
    expect(validateUserProfile({ ...valid, age: 0 })).toMatch(/Tuổi/);
    expect(validateUserProfile({ ...valid, age: 150 })).toMatch(/Tuổi/);
  });

  it('rejects non-finite values', () => {
    expect(validateUserProfile({ ...valid, weightKg: NaN })).toMatch(/Cân nặng/);
  });
});
