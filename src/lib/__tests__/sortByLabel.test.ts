import { sortByLabel } from '../sortByLabel';

const titles = (list: string[]) => list;

describe('sortByLabel', () => {
  it('uses the Vietnamese alphabet (Đ after D, accents after the bare letter)', () => {
    const out = sortByLabel(titles(['THÔNG BÁO', 'ĐỒNG BỘ', 'DỮ LIỆU', 'GIAO DIỆN', 'SỨC KHOẺ']), (s) => s, 'vi');
    expect(out).toEqual(['DỮ LIỆU', 'ĐỒNG BỘ', 'GIAO DIỆN', 'SỨC KHOẺ', 'THÔNG BÁO']);
  });

  it('sorts German umlauts with their base letter', () => {
    const out = sortByLabel(['SPRACHE', 'OBERFLÄCHE', 'DATEN', 'KÖRPERPROFIL'], (s) => s, 'de');
    expect(out).toEqual(['DATEN', 'KÖRPERPROFIL', 'OBERFLÄCHE', 'SPRACHE']);
  });

  it('does not mutate the input', () => {
    const input = ['b', 'a'];
    sortByLabel(input, (s) => s, 'en');
    expect(input).toEqual(['b', 'a']);
  });
});
