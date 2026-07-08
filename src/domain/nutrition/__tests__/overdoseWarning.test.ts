import { computeOverdoseWarnings } from '../overdoseWarning';
import type { MicroBatteryState } from '../../../types/nutrition';

function micro(overrides: Partial<MicroBatteryState>): MicroBatteryState {
  return {
    id: 'iron',
    kind: 'goal',
    nameVi: 'Sắt',
    unit: 'mg',
    color: '#000',
    current: 0,
    target: 0,
    percentage: 0,
    over: false,
    ...overrides,
  };
}

describe('computeOverdoseWarnings', () => {
  it('fires a warning when current exceeds the tolerable upper limit', () => {
    const micros = [micro({ id: 'iron', nameVi: 'Sắt', unit: 'mg', current: 60 })];
    const warnings = computeOverdoseWarnings(micros);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('iron');
    expect(warnings[0].current).toBe(60);
    expect(warnings[0].limit).toBe(45);
  });

  it('stays empty when nothing exceeds its upper limit', () => {
    const micros = [
      micro({ id: 'iron', current: 10 }),
      micro({ id: 'calcium', current: 800, unit: 'mg' }),
    ];
    expect(computeOverdoseWarnings(micros)).toHaveLength(0);
  });

  it('stays empty for nutrients without a defined upper limit (e.g. fiber)', () => {
    const micros = [micro({ id: 'fiber', current: 999999, unit: 'g' })];
    expect(computeOverdoseWarnings(micros)).toHaveLength(0);
  });

  it('produces a gentle, non-alarmist referential message with no medical/diagnostic wording', () => {
    const micros = [micro({ id: 'calcium', nameVi: 'Canxi', unit: 'mg', current: 3000 })];
    const [warning] = computeOverdoseWarnings(micros);
    expect(warning.messageVi).toContain('tham khảo');
    expect(warning.messageVi).toContain('Canxi');
    expect(warning.messageVi.toLowerCase()).not.toContain('nguy hiểm');
    expect(warning.messageVi.toLowerCase()).not.toContain('chẩn đoán');
  });

  it('fires independently for multiple exceeded nutrients', () => {
    const micros = [
      micro({ id: 'iron', current: 100 }),
      micro({ id: 'sodium', nameVi: 'Natri', unit: 'mg', current: 3000 }),
      micro({ id: 'fiber', current: 10, unit: 'g' }),
    ];
    const warnings = computeOverdoseWarnings(micros);
    expect(warnings.map((w) => w.id).sort()).toEqual(['iron', 'sodium']);
  });

  it('suppresses the redundant sodium warning when salt (derived from sodium) already exceeds its limit', () => {
    const micros = [
      micro({ id: 'sodium', nameVi: 'Natri', unit: 'mg', current: 3000 }),
      micro({ id: 'salt', nameVi: 'Muối (NaCl)', unit: 'g', current: 7.5 }),
    ];
    const warnings = computeOverdoseWarnings(micros);
    expect(warnings.map((w) => w.id)).toEqual(['salt']);
  });
});
