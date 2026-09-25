import { maxEditsFor, osaDistance, scoreCompact, scoreToken } from '../fuzzyMatch';

describe('osaDistance', () => {
  it('counts insert / delete / substitute / neighbour swap as one edit each', () => {
    expect(osaDistance('chiken', 'chicken', 2)).toBe(1);
    expect(osaDistance('bahn', 'banh', 2)).toBe(1); // swap
    expect(osaDistance('youghurt', 'yogurt', 2)).toBe(2);
    expect(osaDistance('pho', 'pho', 0)).toBe(0);
  });

  it('gives up past the limit (max + 1)', () => {
    expect(osaDistance('salmon', 'banana', 1)).toBe(2);
    expect(osaDistance('a', 'abcdef', 2)).toBe(3);
  });
});

describe('scoreToken', () => {
  it('exact > prefix > inside a word, none fuzzy', () => {
    expect(scoreToken('pho', 'pho')).toEqual({ score: 1, fuzzy: false });
    const prefix = scoreToken('chick', 'chicken');
    expect(prefix.fuzzy).toBe(false);
    expect(prefix.score).toBeGreaterThan(0.85);
    expect(prefix.score).toBeLessThan(1);
    expect(scoreToken('gurt', 'yogurt')).toEqual({ score: 0.55, fuzzy: false });
  });

  it('allows typos only on longer words, and flags them', () => {
    expect(scoreToken('chiken', 'chicken')).toMatchObject({ fuzzy: true });
    expect(scoreToken('salmn', 'salmon').score).toBeGreaterThan(0);
    expect(scoreToken('chikc', 'chicken')).toEqual({ score: 0.6, fuzzy: true });
    // 3 letters: no typo room — "pho" is not "cho", "tam" not "tom"...
    expect(scoreToken('pho', 'cho').score).toBe(0);
    expect(scoreToken('tam', 'vitamin').score).toBe(0);
    // ...except a doubled last letter.
    expect(scoreToken('boo', 'bo')).toEqual({ score: 0.65, fuzzy: true });
    expect(scoreToken('com', 'co').score).toBe(0);
    expect(maxEditsFor(3)).toBe(0);
  });
});

describe('scoreCompact', () => {
  it('matches words run together or split differently', () => {
    expect(scoreCompact('phobo', 'phobo')).toEqual({ score: 1, fuzzy: false });
    expect(scoreCompact('banhmi', 'banhmiokhong')).toEqual({ score: 0.9, fuzzy: false });
    expect(scoreCompact('bahnmi', 'banhmi')).toMatchObject({ fuzzy: true });
    // Short queries get one edit only: "cahoi" is not "chao".
    expect(scoreCompact('cahoi', 'chao').score).toBe(0);
    expect(scoreCompact('pho', 'phobo').score).toBe(0); // under 4 letters: the word match covers it
  });
});
