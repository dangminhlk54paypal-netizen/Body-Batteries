// Streaming CSV reading for "Nguồn của tôi" (the user's own food tables).
//
// A file can be a few hundred MB, so it is never loaded whole: the service
// reads it in byte chunks (expo-file-system FileHandle.readBytes), and the two
// readers below turn each chunk into text and then into records while
// carrying over whatever was cut off at the chunk boundary — half of a
// multi-byte UTF-8 letter, half of a quoted field, the "\n" of a "\r\n".
// Pure and dependency-free (no TextDecoder: not every RN JS engine ships it),
// so the whole thing is unit-tested under plain Jest.

export interface Utf8StreamDecoder {
  // Decodes one chunk. Bytes of a letter split across chunks are held back
  // and finished by the next call.
  decode(bytes: Uint8Array): string;
  // End of file: a letter still unfinished becomes U+FFFD.
  flush(): string;
}

const REPLACEMENT = 0xfffd;

export function createUtf8Decoder(): Utf8StreamDecoder {
  let pending = new Uint8Array(0);

  return {
    decode(bytes: Uint8Array): string {
      let buf = bytes;
      if (pending.length > 0) {
        buf = new Uint8Array(pending.length + bytes.length);
        buf.set(pending, 0);
        buf.set(bytes, pending.length);
        pending = new Uint8Array(0);
      }

      const n = buf.length;
      let out = '';
      let units: number[] = [];
      const flushUnits = () => {
        out += String.fromCharCode(...units);
        units = [];
      };

      let i = 0;
      while (i < n) {
        const b = buf[i];
        if (b < 0x80) {
          units.push(b);
          i++;
        } else {
          let need: number;
          let cp: number;
          if (b >= 0xc2 && b <= 0xdf) {
            need = 1;
            cp = b & 0x1f;
          } else if (b >= 0xe0 && b <= 0xef) {
            need = 2;
            cp = b & 0x0f;
          } else if (b >= 0xf0 && b <= 0xf4) {
            need = 3;
            cp = b & 0x07;
          } else {
            units.push(REPLACEMENT);
            i++;
            continue;
          }

          // Count the continuation bytes that are actually there.
          let have = 0;
          while (have < need && i + 1 + have < n && (buf[i + 1 + have] & 0xc0) === 0x80) have++;

          if (have < need) {
            if (i + 1 + have >= n) {
              // Cut off by the chunk boundary — finish it next call.
              pending = buf.slice(i);
              break;
            }
            units.push(REPLACEMENT);
            i += 1 + have;
            continue;
          }

          for (let k = 1; k <= need; k++) cp = (cp << 6) | (buf[i + k] & 0x3f);
          const overlong = (need === 2 && cp < 0x800) || (need === 3 && cp < 0x10000);
          const invalid = overlong || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff);
          if (invalid) {
            units.push(REPLACEMENT);
          } else if (cp >= 0x10000) {
            const v = cp - 0x10000;
            units.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
          } else {
            units.push(cp);
          }
          i += 1 + need;
        }
        // Keep String.fromCharCode's argument list well under engine limits.
        if (units.length >= 4096) flushUnits();
      }
      flushUnits();
      return out;
    },

    flush(): string {
      const out = pending.length > 0 ? String.fromCharCode(REPLACEMENT) : '';
      pending = new Uint8Array(0);
      return out;
    },
  };
}

export type CsvDelimiter = ',' | ';' | '\t';

// Guesses the separator from the header line: whichever of , ; TAB appears
// most often outside quotes. German/Vietnamese Excel saves ";" because the
// comma is their decimal mark; a TAB is common in database exports.
export function detectDelimiter(text: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && (ch === ',' || ch === ';' || ch === '\t')) counts[ch]++;
  }
  let best: CsvDelimiter = ',';
  for (const d of [';', '\t'] as CsvDelimiter[]) if (counts[d] > counts[best]) best = d;
  return best;
}

export interface CsvRecordReader {
  // Feeds one chunk of text; returns the records completed by it.
  push(text: string): string[][];
  // End of file: returns the last record if the file had no final newline.
  end(): string[][];
}

// RFC 4180 records, lenient the way spreadsheet exports need: a field may be
// quoted ("White rice, cooked"), a doubled quote inside one is a literal
// quote, a quoted field may contain newlines, lines end in \n, \r\n or \r,
// and blank lines are skipped. A byte-order mark at the very start is dropped.
export function createCsvRecordReader(delimiter: CsvDelimiter): CsvRecordReader {
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  // A '"' was the last char of a chunk while inside quotes: the next chunk's
  // first char says whether it was an escaped quote or the closing one.
  let pendingQuote = false;
  // A '\r' ended the last chunk: a '\n' starting the next one belongs to it.
  let skipLineFeed = false;
  let atStart = true;

  function endRecord(out: string[][]) {
    record.push(field);
    field = '';
    const blank = record.length === 1 && record[0].trim() === '';
    if (!blank) out.push(record);
    record = [];
  }

  return {
    push(chunk: string): string[][] {
      const out: string[][] = [];
      let text = chunk;
      if (atStart && text.length > 0) {
        atStart = false;
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      }
      const n = text.length;
      let i = 0;

      if (n > 0 && skipLineFeed) {
        skipLineFeed = false;
        if (text[0] === '\n') i = 1;
      }
      if (n > i && pendingQuote) {
        pendingQuote = false;
        if (text[i] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      }

      while (i < n) {
        if (inQuotes) {
          const q = text.indexOf('"', i);
          if (q === -1) {
            field += text.slice(i);
            break;
          }
          field += text.slice(i, q);
          if (q + 1 >= n) {
            pendingQuote = true;
            break;
          }
          if (text[q + 1] === '"') {
            field += '"';
            i = q + 2;
          } else {
            inQuotes = false;
            i = q + 1;
          }
          continue;
        }

        const ch = text[i];
        if (ch === '"' && field === '') {
          inQuotes = true;
          i++;
        } else if (ch === delimiter) {
          record.push(field);
          field = '';
          i++;
        } else if (ch === '\n') {
          endRecord(out);
          i++;
        } else if (ch === '\r') {
          endRecord(out);
          if (i + 1 < n) {
            if (text[i + 1] === '\n') i++;
          } else {
            skipLineFeed = true;
          }
          i++;
        } else {
          // Copy a plain run in one slice instead of char by char.
          let j = i + 1;
          while (j < n) {
            const c = text[j];
            if (c === delimiter || c === '\n' || c === '\r' || c === '"') break;
            j++;
          }
          // A stray '"' in the middle of an unquoted field is kept as text.
          if (ch === '"') j = i + 1;
          field += text.slice(i, j);
          i = j;
        }
      }
      return out;
    },

    end(): string[][] {
      const out: string[][] = [];
      if (pendingQuote) {
        pendingQuote = false;
        inQuotes = false;
      }
      if (field !== '' || record.length > 0) endRecord(out);
      return out;
    },
  };
}
