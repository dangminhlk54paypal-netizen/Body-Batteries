// Forgiving word matching for the food search box — pure, no catalog knowledge.
// Someone who ate phở once types "pho", "pho boo", "phobo" or "fo bo"; someone
// who half-remembers types "chiken" or "youghurt". Every query token is scored
// against every word of a food's names (already accent-stripped by the caller):
//
//   exact word            1.0      "pho"  ~ "pho"
//   word prefix           0.85–1   "chick" ~ "chicken" (more complete = higher)
//   inside a word (≥4)    0.55     "gurt" ~ "yogurt" (3 letters sit inside too many words)
//   typo (fuzzy)          0.8/0.68 "chiken" ~ "chicken" (1 edit), "youghurt" ~ "yogurt" (2)
//   one letter too many   0.65     "boo" ~ "bo" (3-letter words get no other typo room)
//   typo in a prefix      0.6      "chikc" ~ "chicken"
//
// Typos are counted with the optimal-string-alignment distance (insert,
// delete, substitute, swap two neighbours — "bahn" ~ "banh" is ONE edit).
// Fuzzy scores are flagged, so the search can keep "exactly what you typed"
// results apart from "probably what you meant" ones.

export interface TokenMatch {
  score: number; // 0 = no match
  fuzzy: boolean; // true = only matched by allowing typos
}

const NO_MATCH: TokenMatch = { score: 0, fuzzy: false };

// How many typos a token of this length may carry. Short tokens get none:
// with three letters one edit already turns "pho" into "cho", "tam" into "tom".
export function maxEditsFor(length: number): number {
  if (length <= 3) return 0;
  if (length <= 4) return 1;
  if (length <= 8) return 2;
  return 3;
}

// Optimal string alignment distance, giving up (returning max + 1) as soon as
// it cannot stay within `max` — the search calls this thousands of times per
// keystroke, so the early exit matters.
export function osaDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[m];
}

// One query token against one word of a name (both normalized: lowercase, no accents).
export function scoreToken(token: string, word: string): TokenMatch {
  if (!token || !word) return NO_MATCH;
  if (word === token) return { score: 1, fuzzy: false };
  if (word.startsWith(token)) {
    if (token.length === 1) return { score: 0.5, fuzzy: false };
    return { score: 0.85 + 0.15 * (token.length / word.length), fuzzy: false };
  }
  if (token.length >= 4 && word.includes(token)) return { score: 0.55, fuzzy: false };

  // A doubled last letter on a short word ("boo" for "bo"; longer ones like
  // "phoo" are covered by the general typo rule below).
  if (token.length === 3 && word.length === 2 && token.startsWith(word) && token[2] === token[1]) {
    return { score: 0.65, fuzzy: true };
  }

  const max = maxEditsFor(token.length);
  // Typos are looked for only when the first letter agrees: people rarely
  // miss the first letter, and it skips most of the distance work per keystroke.
  if (max === 0 || word[0] !== token[0]) return NO_MATCH;
  const d = osaDistance(token, word, max);
  if (d <= max) return { score: 0.8 - 0.12 * (d - 1), fuzzy: true };
  // A typo in the part typed so far ("chikc" for "chicken").
  if (token.length >= 4 && word.length > token.length && osaDistance(token, word.slice(0, token.length), 1) <= 1) {
    return { score: 0.6, fuzzy: true };
  }
  return NO_MATCH;
}

// The whole query with its spaces removed against a whole name with its
// spaces removed — catches words run together or split differently
// ("phobo" ~ "pho bo", "banhmi" ~ "banh mi ...", "bun bohue" ~ "bun bo hue").
export function scoreCompact(query: string, name: string): TokenMatch {
  if (query.length < 4 || !name) return NO_MATCH;
  if (name === query) return { score: 1, fuzzy: false };
  if (name.startsWith(query)) return { score: 0.9, fuzzy: false };
  // Stricter than per word: a short run-together query is close to many
  // short names ("cahoi" is 2 edits from "chao").
  const max = query.length >= 7 ? 2 : 1;
  if (osaDistance(query, name, max) <= max) return { score: 0.75, fuzzy: true };
  if (name.length > query.length && osaDistance(query, name.slice(0, query.length), 1) <= 1) {
    return { score: 0.65, fuzzy: true };
  }
  return NO_MATCH;
}
