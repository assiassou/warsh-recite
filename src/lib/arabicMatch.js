// Normalizes Arabic text for lenient comparison: strips tashkeel/tatweel and
// unifies letter forms that STT output commonly varies on (alef variants,
// alef maksura vs yaa, taa marbuta vs haa) so we compare meaning, not spelling.
const DIACRITICS = /[ؐ-ًؚ-ٟۖ-ۜ۟-۪ۨ-ٰۭـ]/g;

export function normalizeArabic(text) {
  return text
    .replace(DIACRITICS, '')
    .replace(/[إأآٱا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^ء-ي\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toWords(text) {
  return normalizeArabic(text).split(' ').filter(Boolean);
}

// Flattens a thumn's verses into a word list tagged with the ayah (surah:verse)
// each word belongs to, so results can show which ayah the reciter is on.
export function wordsWithAyah(thumn) {
  const words = [];
  for (const v of thumn.verses) {
    for (const w of toWords(v.text)) {
      words.push({ word: w, surah: v.surah, verse: v.verse });
    }
  }
  return words;
}

// Word-level alignment via Levenshtein/edit-distance backtrace, so we can
// mark each reference word as correct / substituted / missing, and flag
// extra words the reciter added. `refWords` is either a plain string (no
// ayah tagging) or an array from wordsWithAyah().
export function alignWords(refWords, spokenText) {
  const ref = typeof refWords === 'string' ? toWords(refWords).map((word) => ({ word })) : refWords;
  const spoken = toWords(spokenText);
  const n = ref.length;
  const m = spoken.length;

  // A reciter proceeds through the reference roughly in order. Plain edit
  // distance doesn't know that, so when a word (e.g. "الله") repeats many
  // times, it can happily match a spoken word against some coincidentally
  // equal-cost occurrence elsewhere in the text instead of the correct
  // nearby one. Two safeguards against that:
  //  1. A "band" restricting how far ahead a match can be, so a repeat far
  //     outside the plausible range is structurally unreachable rather than
  //     just discouraged. Lifted entirely once every spoken word is used up
  //     (j === m), since the rest of the reference is simply the unrecited
  //     tail, deleted in one forced path with no ambiguity.
  //  2. Within the band, a genuine tie can still occur (e.g. Fatiha repeats
  //     "الرحمن الرحيم" a few words later) -- a minute bias, far smaller
  //     than any real integer edit cost, makes an earlier match strictly
  //     cheaper so ties resolve toward the nearest occurrence.
  const BAND = Math.max(15, m);
  const inBand = (i, j) => j >= m || Math.abs(i - j) <= BAND;
  const POSITION_BIAS = 1e-6;

  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++) if (inBand(i, 0)) cost[i][0] = i;
  for (let j = 1; j <= m; j++) if (inBand(0, j)) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (!inBand(i, j)) continue;
      // Standard Levenshtein recurrence: always compare all three options,
      // never take the diagonal (match/substitute) unconditionally just
      // because the words happen to be equal -- if this match's predecessor
      // is out-of-band (Infinity), a coincidental match at the wrong
      // position must lose to the correct "skip this word" alternative.
      const isMatch = ref[i - 1].word === spoken[j - 1];
      const diagonal = cost[i - 1][j - 1] + (isMatch ? POSITION_BIAS * i : 1);
      cost[i][j] = Math.min(diagonal, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }

  const result = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1].word === spoken[j - 1] && cost[i][j] === cost[i - 1][j - 1] + POSITION_BIAS * i) {
      result.push({ type: 'correct', word: ref[i - 1].word, surah: ref[i - 1].surah, verse: ref[i - 1].verse });
      i--; j--;
    } else if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + 1) {
      result.push({ type: 'substituted', word: ref[i - 1].word, spoken: spoken[j - 1], surah: ref[i - 1].surah, verse: ref[i - 1].verse });
      i--; j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      result.push({ type: 'missing', word: ref[i - 1].word, surah: ref[i - 1].surah, verse: ref[i - 1].verse });
      i--;
    } else {
      result.push({ type: 'extra', word: spoken[j - 1] });
      j--;
    }
  }
  result.reverse();

  const mistakes = result.filter((r) => r.type !== 'correct').length;
  return { alignment: result, mistakes, wordCount: n };
}

// Drops trailing reference words the reciter never got to (type 'missing' at
// the end of the alignment, after the last word they actually said) so
// stopping early or reciting only part of a Thumn doesn't flag the whole
// unrecited rest as mistakes. Only trims the *tail* — a skipped verse in the
// middle still shows correctly, since it's followed by more matched words.
// Recomputes mistakes/wordCount against the trimmed portion, since counting
// against the full Thumn would still be misleading once the tail is hidden.
export function trimUnrecitedTail({ alignment, mistakes, wordCount }) {
  let lastMatched = -1;
  alignment.forEach((item, i) => {
    if (item.type === 'correct' || item.type === 'substituted') lastMatched = i;
  });
  if (lastMatched === alignment.length - 1) return { alignment, mistakes, wordCount };

  const trimmed = alignment.slice(0, lastMatched + 1);
  const trimmedRefWordCount = trimmed.filter((item) => item.type !== 'extra').length;
  return {
    alignment: trimmed,
    mistakes: trimmed.filter((r) => r.type !== 'correct').length,
    wordCount: trimmedRefWordCount,
  };
}

// The ayah of the furthest reference word the reciter has actually said
// (matched or substituted) — used as a "you're currently on ayah N" indicator
// while listening. Returns null if nothing has matched yet.
export function currentAyahFromAlignment(alignment) {
  for (let k = alignment.length - 1; k >= 0; k--) {
    const item = alignment[k];
    if (item.type === 'correct' || item.type === 'substituted') {
      return { surah: item.surah, verse: item.verse };
    }
  }
  return null;
}

// Indices in `alignment` that are the last reference word of their ayah —
// render an ayah-end marker (﴿N﴾) right after these when displaying results.
export function ayahEndIndices(alignment) {
  const refIdxs = [];
  for (let idx = 0; idx < alignment.length; idx++) {
    if (alignment[idx].verse != null) refIdxs.push(idx);
  }
  const ends = new Set();
  for (let k = 0; k < refIdxs.length; k++) {
    const cur = alignment[refIdxs[k]];
    const next = k + 1 < refIdxs.length ? alignment[refIdxs[k + 1]] : null;
    if (!next || next.surah !== cur.surah || next.verse !== cur.verse) {
      ends.add(refIdxs[k]);
    }
  }
  return ends;
}
