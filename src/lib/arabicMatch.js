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

// Word-level alignment via Levenshtein/edit-distance backtrace, so we can
// mark each reference word as correct / substituted / missing, and flag
// extra words the reciter added.
export function alignWords(referenceText, spokenText) {
  const ref = toWords(referenceText);
  const spoken = toWords(spokenText);
  const n = ref.length;
  const m = spoken.length;

  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) cost[i][0] = i;
  for (let j = 0; j <= m; j++) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === spoken[j - 1]) {
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
    if (i > 0 && j > 0 && ref[i - 1] === spoken[j - 1]) {
      result.push({ type: 'correct', word: ref[i - 1] });
      i--; j--;
    } else if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + 1) {
      result.push({ type: 'substituted', word: ref[i - 1], spoken: spoken[j - 1] });
      i--; j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      result.push({ type: 'missing', word: ref[i - 1] });
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
