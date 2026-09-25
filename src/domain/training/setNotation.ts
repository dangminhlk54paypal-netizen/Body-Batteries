import type { LiftingSet } from '../../types/energy';

// Reads the user's own set shorthand (the one formatSetSequence writes, plan
// §2.2 of the training-log notebook) back into sets, so a plan can be typed the
// way it is written in Notes:
//
//   90            one set of 1 rep at 90 kg        (a top single)
//   3x100         one set: 3 reps at 100 kg        (reps x weight; "110x1"
//                 weight x reps also reads — the smaller number is the reps)
//   5x5x72.5      5 sets x 5 reps x 72.5 kg        (sets x reps x weight)
//   5x5@72.5      the same, spreadsheet style      (sets x reps @ weight)
//   6x4(+3)x75    6 sets of 4, the last one +3 reps
//   110x(4+5+5)   sets of 4, 5, 5 reps at 110 kg
//   (4x2+5)x90    4 sets of 2 then a set of 5 at 90 kg
//   95 + 4x6x72.5 a prime (the warm-up's heaviest single, 95 kg) before the
//                 working sets — "95+ 4x6x72.5" too; the spaced "+" is what
//                 tells it apart from a top single or a cluster (PRIME_JOIN)
//
// Tokens are separated by spaces, "+", "-" or "," (outside parentheses), so
// "110x1 - 5x5@95", "130 4x3x115+3x100" and "8x20+6x60" all read. "×", "X"
// and "*" count as "x"; a decimal comma (72,5 — phone keypads in vi/de) counts
// as a dot; a trailing "kg" is ignored. Every set comes back as a WORKING set,
// except the prime, which is a 'warmup' single.

export type SetNotationResult =
  | { ok: true; sets: LiftingSet[] }
  | { ok: false; badToken: string }; // '' = nothing was typed

const W = '(\\d+(?:\\.\\d+)?)';
const MAX_SETS = 30;
const MAX_REPS = 100;
const MAX_WEIGHT = 1000;

function normalize(text: string): string {
  return text
    .trim()
    .replace(/[×X*]/g, 'x')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)\s*kg\b/gi, '$1');
}

// Splits on separators that are NOT inside parentheses.
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /[\s+,-]/.test(ch)) {
      if (current) tokens.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function working(weightKg: number, reps: number): LiftingSet {
  return { kind: 'working', weightKg, reps };
}

function repeat(n: number, weightKg: number, reps: number): LiftingSet[] {
  return Array.from({ length: n }, () => working(weightKg, reps));
}

// One token → its sets, or null when it doesn't match any form.
function parseToken(token: string): LiftingSet[] | null {
  let m: RegExpExecArray | null;

  if ((m = new RegExp(`^(\\d+)x(\\d+)\\(\\+(\\d+)\\)x${W}$`).exec(token))) {
    const [n, r, extra, w] = [+m[1], +m[2], +m[3], +m[4]];
    if (n < 1) return null;
    return [...repeat(n - 1, w, r), working(w, r + extra)];
  }
  if ((m = new RegExp(`^(\\d+)x(\\d+)[x@]${W}$`).exec(token))) {
    return repeat(+m[1], +m[3], +m[2]);
  }
  if ((m = new RegExp(`^${W}x\\((\\d+(?:\\+\\d+)*)\\)$`).exec(token))) {
    const w = +m[1];
    return m[2].split('+').map((r) => working(w, +r));
  }
  if ((m = new RegExp(`^\\(((?:\\d+x)?\\d+(?:\\+(?:\\d+x)?\\d+)*)\\)x${W}$`).exec(token))) {
    const w = +m[2];
    return m[1].split('+').flatMap((item) => {
      const [a, b] = item.split('x');
      return b == null ? [working(w, +a)] : repeat(+a, w, +b);
    });
  }
  if ((m = new RegExp(`^${W}x${W}$`).exec(token))) {
    // Two numbers: the log writes reps x weight ("3x100", "8x20"), the user's
    // spreadsheet writes weight x reps ("110x1", "95x5"). Reps are the smaller
    // number (a tie reads reps first). Known limit: a set lighter in kg than its
    // rep count ("12x10" meaning 12 reps of 10 kg) reads the other way round —
    // the preview in the editor shows it before anything is saved.
    const [a, b] = [+m[1], +m[2]];
    const [reps, weight] = a <= b ? [a, b] : [b, a];
    return Number.isInteger(reps) ? [working(weight, reps)] : null;
  }
  if ((m = new RegExp(`^${W}$`).exec(token))) {
    return [working(+m[1], 1)];
  }
  return null;
}

function plausible(sets: LiftingSet[]): boolean {
  return sets.every(
    (s) => Number.isFinite(s.weightKg) && s.weightKg >= 0 && s.weightKg <= MAX_WEIGHT && s.reps >= 1 && s.reps <= MAX_REPS
  );
}

const PRIME = new RegExp(`^${W}(?:\\s+\\+\\s*|\\+\\s+)(?=\\S)`);

export function parseSetNotation(text: string): SetNotationResult {
  const normalized = normalize(text);
  const prime = PRIME.exec(normalized);
  if (prime) {
    const primeKg = +prime[1];
    const rest = parseSetNotation(normalized.slice(prime[0].length));
    if (!rest.ok) return rest;
    if (!plausible([working(primeKg, 1)])) return { ok: false, badToken: prime[1] };
    return { ok: true, sets: [{ kind: 'warmup', weightKg: primeKg, reps: 1 }, ...rest.sets] };
  }
  const tokens = tokenize(normalized);
  if (tokens.length === 0) return { ok: false, badToken: '' };
  const sets: LiftingSet[] = [];
  for (const token of tokens) {
    const parsed = parseToken(token);
    if (!parsed || parsed.length === 0 || !plausible(parsed)) return { ok: false, badToken: token };
    sets.push(...parsed);
    if (sets.length > MAX_SETS) return { ok: false, badToken: token };
  }
  return { ok: true, sets };
}
