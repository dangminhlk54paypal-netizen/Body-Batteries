import { notebookFontSize, resolveTrainingLogFormat } from '../trainingLog';

describe('notebookFontSize', () => {
  it('keeps the base size at medium', () => {
    expect(notebookFontSize(14, 'medium')).toBe(14);
    expect(notebookFontSize(19, 'medium')).toBe(19);
  });

  it('shrinks at small and grows at large, in whole points', () => {
    expect(notebookFontSize(14, 'small')).toBe(12);
    expect(notebookFontSize(20, 'small')).toBe(17);
    expect(notebookFontSize(14, 'large')).toBe(16);
  });

  it('never goes below a readable minimum', () => {
    expect(notebookFontSize(12, 'small')).toBe(11);
  });
});

describe('resolveTrainingLogFormat textSize', () => {
  it('gives a device that saved the format before the option existed the small default', () => {
    expect(resolveTrainingLogFormat({ labelStyle: 'full' }).textSize).toBe('small');
  });

  it('keeps a stored choice', () => {
    expect(resolveTrainingLogFormat({ textSize: 'large' }).textSize).toBe('large');
  });
});
