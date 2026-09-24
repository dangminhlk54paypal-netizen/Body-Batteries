import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import { POWERLIFTING_VARIATIONS, findVariation } from '../../lib/powerliftingVariations';
import { activityLabel, isLiftingExercise, liftingMovementLabel } from '../../lib/activityLabels';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftingExercise, LiftingSet, WorkoutSession } from '../../types/energy';
import type { TrainingLogFormat } from '../../types/trainingLog';
import { movementLabel } from './trainingLogFormatter';

// The reverse of trainingLogFormatter: reads a day line the user wrote or
// edited ("S 130 4x3x115+3x100 PD 4x3x100") back into lifts and sets, so the
// page editor can push corrections into the Xả entries and the progress chart
// can count hand-written days. Same grammar (plan §2.2):
//   90               → 1 set × 1 rep @ 90
//   3x100            → 1 set × 3 reps @ 100
//   5x5x72.5         → 5 sets × 5 reps @ 72.5
//   6x4(+3)x75       → 5 sets × 4 + a last set of 7 @ 75
//   110x(4+5+5+4+8)  → one set per rep count @ 110
//   95 + 4x6x72.5    → a prime (warm-up 1 × 95), then the working sets —
//                      also "95+ 4x6x72.5"; see PRIME_JOIN in the formatter
// Clusters join with "+"; a comma between digits is a decimal ("72,5").
// Anything else in parentheses — "(95 ❌)", "(rpe9.2)", "(test)" — and
// struck-through / ❌ tokens are the user's annotations: set aside, never sets.
// Pure: labels come from translate() + the user's format, never from a store.

export interface MovementIdentity {
  exercise: LiftingExercise;
  variationId?: string; // library id; absent = standard lift
  variationName?: string; // free-text variation
}

export interface ParsedChain {
  raw: string; // as written, e.g. "4x3x115+3x100"
  sets: { reps: number; weightKg: number }[];
  // The movement's prime ("95" in "B 95 + 4x6x72.5"): its sets are warm-ups.
  isPrime?: boolean;
}

export interface ParsedMovement {
  label: string; // as written, e.g. "PS"
  identity: MovementIdentity | null; // null = a label no lift is known by
  chains: ParsedChain[];
  sets: LiftingSet[]; // every chain's sets: the prime's 'warmup', the rest 'working'
  text: string; // label + chains, normalized spacing
}

export interface ParsedDayBody {
  movements: ParsedMovement[];
  annotations: string[]; // "(95 ❌)", "1̶0̶2̶.̶5̶❌"…
  unparsed: string[]; // sets with no label, a label with no sets
}

const W = String.raw`\d+(?:\.\d+)?`;
const RE_SINGLE = new RegExp(`^(${W})$`);
const RE_REPS_WEIGHT = new RegExp(`^(\\d+)x(${W})$`);
const RE_EVEN = new RegExp(`^(\\d+)x(\\d+)x(${W})$`);
const RE_LAST_EXTRA = new RegExp(`^(\\d+)x(\\d+)\\(\\+(\\d+)\\)x(${W})$`);
const RE_UNEVEN = new RegExp(`^(${W})x\\((\\d+(?:\\+\\d+)*)\\)$`);
// Parentheses that are part of the notation: "(+3)" and "(4+5+5)".
const NOTATION_PARENS = /^\+?\d+(?:\+\d+)*$/;
const STRUCK_OR_FAILED = /[̶̵❌✗✘]/;

const MAX_SETS = 50;
const MAX_REPS = 100;
const MAX_WEIGHT_KG = 1000;

// "72,5" → "72.5", "×"/"X" → "x", and a unit glued to a number ("72.5kg") is dropped.
function normalizeSetToken(token: string, language: Language): string {
  const unit = translate(language, 'trainingLog.format.weightUnit').toLowerCase();
  let s = token.toLowerCase().replace(/[×]/g, 'x').replace(/(\d),(\d)/g, '$1.$2');
  if (unit) s = s.split(`${unit}`).join('');
  return s;
}

function validSet(reps: number, weightKg: number): boolean {
  return (
    Number.isInteger(reps) && reps >= 1 && reps <= MAX_REPS && weightKg >= 0 && weightKg <= MAX_WEIGHT_KG
  );
}

function parseCluster(cluster: string): { reps: number; weightKg: number }[] | null {
  let m = cluster.match(RE_SINGLE);
  if (m) return [{ reps: 1, weightKg: Number(m[1]) }];
  m = cluster.match(RE_REPS_WEIGHT);
  if (m) return [{ reps: Number(m[1]), weightKg: Number(m[2]) }];
  m = cluster.match(RE_EVEN);
  if (m) {
    const n = Number(m[1]);
    if (n < 1 || n > MAX_SETS) return null;
    return Array.from({ length: n }, () => ({ reps: Number(m![2]), weightKg: Number(m![3]) }));
  }
  m = cluster.match(RE_LAST_EXTRA);
  if (m) {
    const n = Number(m[1]);
    if (n < 2 || n > MAX_SETS) return null;
    const r = Number(m[2]);
    const w = Number(m[4]);
    const sets = Array.from({ length: n - 1 }, () => ({ reps: r, weightKg: w }));
    sets.push({ reps: r + Number(m[3]), weightKg: w });
    return sets;
  }
  m = cluster.match(RE_UNEVEN);
  if (m) {
    const w = Number(m[1]);
    return m[2].split('+').map((r) => ({ reps: Number(r), weightKg: w }));
  }
  return null;
}

// Splits on "+" outside parentheses ("110x(4+5)+3x100" → 2 clusters).
function splitTopLevel(chain: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of chain) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === '+' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

// One whitespace-free token as a chain of set clusters, or null when it is not
// set notation (then it is a label word).
export function parseSetChain(token: string, language: Language): ParsedChain | null {
  const normalized = normalizeSetToken(token, language);
  if (!/\d/.test(normalized)) return null;
  const clusters = splitTopLevel(normalized).filter((c) => c !== '');
  if (clusters.length === 0) return null;
  const sets: { reps: number; weightKg: number }[] = [];
  for (const c of clusters) {
    const parsed = parseCluster(c);
    if (!parsed || !parsed.every((s) => validSet(s.reps, s.weightKg))) return null;
    sets.push(...parsed);
  }
  return { raw: token, sets };
}

function labelKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function defaultAbbr(id: string, language: Language): string | null {
  const key = `trainingLog.abbr.${id}`;
  const value = translate(language, key);
  return value === key ? null : value;
}

function identityOfVariation(variationId: string): MovementIdentity | null {
  const v = findVariation(variationId);
  if (!v) return null;
  // A loadFactor-1 variation IS the standard lift (same rule as the formatter).
  return v.loadFactor === 1 ? { exercise: v.exercise } : { exercise: v.exercise, variationId: v.id };
}

export function identityOfWorkout(w: WorkoutSession): MovementIdentity | null {
  if (w.bbMet != null || !isLiftingExercise(w.type)) return null;
  if (w.variationName) return { exercise: w.type, variationName: w.variationName };
  if (w.variationId) return identityOfVariation(w.variationId) ?? { exercise: w.type };
  return { exercise: w.type };
}

// Every label a lift can be written with, in this priority: how the day's own
// Xả sessions print (so a free-text variation resolves), the user's own
// abbreviations, the default abbreviations, then the full names. Matching is
// case-insensitive, so the old Notes' "pS" still reads as paused squat.
export function buildLabelLookup(
  format: TrainingLogFormat,
  language: Language,
  known: WorkoutSession[] = []
): Map<string, MovementIdentity> {
  const map = new Map<string, MovementIdentity>();
  const add = (label: string | null | undefined, identity: MovementIdentity | null) => {
    if (!label || !identity) return;
    const key = labelKey(label);
    if (key && !map.has(key)) map.set(key, identity);
  };

  for (const w of known) {
    const identity = identityOfWorkout(w);
    add(movementLabel(w, format, language), identity);
    add(liftingMovementLabel(w, language), identity);
  }
  for (const [key, value] of Object.entries(format.abbreviations)) {
    if (key.startsWith('lift:')) {
      const exercise = key.slice(5);
      if (isLiftingExercise(exercise as LiftingExercise)) add(value, { exercise: exercise as LiftingExercise });
    } else if (key.startsWith('var:')) {
      add(value, identityOfVariation(key.slice(4)));
    }
  }
  for (const exercise of LIFTING_EXERCISES) add(defaultAbbr(exercise, language), { exercise });
  for (const v of POWERLIFTING_VARIATIONS) add(defaultAbbr(v.id, language), identityOfVariation(v.id));
  for (const exercise of LIFTING_EXERCISES) add(activityLabel(exercise, language), { exercise });
  for (const v of POWERLIFTING_VARIATIONS) {
    add(translate(language, `blockVariations.${v.id}.label`), identityOfVariation(v.id));
  }
  return map;
}

// Pulls the user's annotations out of a line: parenthesized text that is not
// notation, and tokens with strike-through or ❌. Returns the cleaned text.
function extractAnnotations(body: string, annotations: string[]): string {
  const cleaned = body.replace(/\(([^()]*)\)/g, (whole, inner: string) => {
    if (NOTATION_PARENS.test(inner.replace(/\s+/g, ''))) return whole;
    annotations.push(whole);
    return ' ';
  });
  return cleaned
    .split(/\s+/)
    .filter((tok) => {
      if (STRUCK_OR_FAILED.test(tok)) {
        annotations.push(tok);
        return false;
      }
      return true;
    })
    .join(' ');
}

// " · 312 kcal" at the end of a line (showKcal) is not a movement.
export function stripKcalSuffix(body: string, language: Language): string {
  const template = translate(language, 'trainingLog.format.kcalSuffix');
  const pattern = template
    .split('{{kcal}}')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\d+');
  return body.replace(new RegExp(`\\s*·\\s*${pattern}\\s*$`), '');
}

export function parseDayBody(
  body: string,
  ctx: { format: TrainingLogFormat; language: Language; known?: WorkoutSession[] }
): ParsedDayBody {
  const { format, language, known } = ctx;
  const lookup = buildLabelLookup(format, language, known);
  const annotations: string[] = [];
  const unparsed: string[] = [];
  const movements: ParsedMovement[] = [];

  const cleaned = extractAnnotations(stripKcalSuffix(body, language), annotations);
  const tokens = cleaned.split(/\s+/).filter((tok) => tok !== '');

  let label: string[] = [];
  let chains: ParsedChain[] = [];
  const flush = () => {
    if (label.length === 0) return;
    const text = label.join(' ');
    if (chains.length === 0) {
      unparsed.push(text);
    } else {
      // A "prime" with nothing after it was just a trailing "+".
      if (chains.length === 1 && chains[0].isPrime) chains[0] = { raw: chains[0].raw, sets: chains[0].sets };
      movements.push({
        label: text,
        identity: lookup.get(labelKey(text)) ?? null,
        chains,
        sets: chains.flatMap((c) =>
          c.sets.map((s) => ({ kind: c.isPrime ? ('warmup' as const) : ('working' as const), ...s }))
        ),
        text: `${text} ${chains.map((c) => (c.isPrime ? `${c.raw} +` : c.raw)).join(' ')}`,
      });
    }
    label = [];
    chains = [];
  };
  // "95 + 4x6x72.5" / "95+ 4x6x72.5": the movement's first chain, a single
  // cluster, set apart by a "+" from more sets → that first chain is the prime.
  const isPrimeCandidate = (chain: ParsedChain) =>
    label.length > 0 && chains.length === 0 && splitTopLevel(chain.raw).length === 1;
  const startsChain = (i: number) => {
    const next = tokens[i + 1];
    return next !== undefined && parseSetChain(next.replace(/^\+|\+$/g, ''), language) != null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    if (raw === '+' && label.length > 0 && chains.length === 1 && !chains[0].isPrime && startsChain(i)) {
      const only = chains[0];
      if (splitTopLevel(only.raw).length === 1) {
        chains[0] = { ...only, isPrime: true };
        continue;
      }
    }
    // Separators the formatter or the user put between movements.
    if (raw === '·' || raw === '-' || raw === '–' || raw === '+') {
      flush();
      continue;
    }
    const tok = raw.replace(/^\+|\+$/g, '').replace(/[,;:]$/, '');
    if (tok === '') continue;
    const chain = parseSetChain(tok, language);
    if (chain) {
      if (label.length === 0) unparsed.push(raw);
      else {
        const glued = /\+$/.test(raw) && isPrimeCandidate({ ...chain, raw: tok }) && startsChain(i);
        chains.push({ ...chain, raw: tok, ...(glued ? { isPrime: true } : {}) });
      }
      continue;
    }
    if (chains.length > 0) flush(); // a word after sets starts the next movement
    label.push(tok);
  }
  flush();

  return { movements, annotations, unparsed };
}

export function sameIdentity(a: MovementIdentity, b: MovementIdentity): boolean {
  return (
    a.exercise === b.exercise &&
    (a.variationId ?? '') === (b.variationId ?? '') &&
    (a.variationName ?? '').trim().toLowerCase() === (b.variationName ?? '').trim().toLowerCase()
  );
}

// The competition lift itself (what the progress chart plots), not a variation.
export function isStandardIdentity(identity: MovementIdentity): boolean {
  return !identity.variationId && !identity.variationName;
}
