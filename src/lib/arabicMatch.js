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

  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) cost[i][0] = i;
  for (let j = 0; j <= m; j++) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1].word === spoken[j - 1]) {
        cost[i][j] = cost[i - 1][j - 1];
      } else {
        cost[i][j] = 1 + Math.min(cost[i - 1][j - 1], cost[i - 1][j], cost[i][j - 1]);
      }
    }
  }

  const result = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1].word === spoken[j - 1]) {
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
