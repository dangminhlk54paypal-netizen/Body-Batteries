import { createCsvRecordReader, createUtf8Decoder, detectDelimiter } from '../libraryCsv';

const utf8 = (s: string) => new Uint8Array(Buffer.from(s, 'utf8'));

// Decode `bytes` split into pieces of `size` bytes, as the chunked file read does.
function decodeInChunks(bytes: Uint8Array, size: number): string {
  const decoder = createUtf8Decoder();
  let out = '';
  for (let i = 0; i < bytes.length; i += size) out += decoder.decode(bytes.slice(i, i + size));
  return out + decoder.flush();
}

// Feed `text` to a reader in pieces of `size` chars.
function readInChunks(text: string, size: number, delimiter: ',' | ';' | '\t' = ','): string[][] {
  const reader = createCsvRecordReader(delimiter);
  const out: string[][] = [];
  for (let i = 0; i < text.length; i += size) out.push(...reader.push(text.slice(i, i + size)));
  out.push(...reader.end());
  return out;
}

describe('createUtf8Decoder', () => {
  const sample = 'Cơm trắng, Brötchen 🍚 — Phở bò';

  it('decodes Vietnamese, German and emoji text in one piece', () => {
    expect(decodeInChunks(utf8(sample), 1_000)).toBe(sample);
  });

  it.each([1, 2, 3, 5, 7])('gives the same text when letters are split across %i-byte chunks', (size) => {
    expect(decodeInChunks(utf8(sample), size)).toBe(sample);
  });

  it('replaces invalid bytes and an unfinished letter at the end of the file', () => {
    const bytes = new Uint8Array([0x41, 0xff, 0x42, 0xe1, 0xbb]);
    expect(decodeInChunks(bytes, 10)).toBe('A�B�');
  });

  it('decodes a long ASCII run (more than one String.fromCharCode batch)', () => {
    const long = 'a'.repeat(10_000);
    expect(decodeInChunks(utf8(long), 6_000)).toBe(long);
  });
});

describe('detectDelimiter', () => {
  it('picks the separator used most in the header line', () => {
    expect(detectDelimiter('name,kcal,protein\n1;2;3;4;5')).toBe(',');
    expect(detectDelimiter('Name;Energie (kJ);Fett, gesamt\n')).toBe(';');
    expect(detectDelimiter('id\tname\tkcal\n')).toBe('\t');
  });

  it('ignores separators inside quotes and defaults to a comma', () => {
    expect(detectDelimiter('"a;b;c",kcal\n')).toBe(',');
    expect(detectDelimiter('name\n')).toBe(',');
  });
});

describe('createCsvRecordReader', () => {
  const csv =
    '﻿name,kcal,note\r\n' +
    '"White rice, cooked",130,"says ""plain"""\r\n' +
    '\r\n' +
    '"Two\nlines",52,\n' +
    'Apple,52,last';

  const expected = [
    ['name', 'kcal', 'note'],
    ['White rice, cooked', '130', 'says "plain"'],
    ['Two\nlines', '52', ''],
    ['Apple', '52', 'last'],
  ];

  it('reads quoted fields, escaped quotes, CRLF, blank lines and a missing final newline', () => {
    expect(readInChunks(csv, 10_000)).toEqual(expected);
  });

  it.each([1, 2, 3, 4, 11])('gives the same records when the text is cut every %i chars', (size) => {
    expect(readInChunks(csv, size)).toEqual(expected);
  });

  it('splits on the given delimiter only', () => {
    expect(readInChunks('Name;Fett\nKäse;27,5\n', 3, ';')).toEqual([
      ['Name', 'Fett'],
      ['Käse', '27,5'],
    ]);
  });

  it('keeps a stray quote in the middle of an unquoted field as text', () => {
    expect(readInChunks('a,5" pizza,b\n', 100)).toEqual([['a', '5" pizza', 'b']]);
  });
});
