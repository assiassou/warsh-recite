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
    // Warsh Mushaf text writes a final ya as ya barree (فِے, اَ۬لذِے).
    .replace(/[ےۓ]/g, 'ي')
    .replace(/[^ء-ي\s]/g, '')
    // Letters spelled doubled or single interchangeably: شيئا/شيا, يحيى/يحي,
    // داوود/داود, أإذا/إذا.
    .replace(/(ي|و|ا)\1+/g, '$1')
    // Alif after a final wow is written or not: أولوا/أولو, يدعوا/يدعو.
    .replace(/وا(?=\s|$)/g, 'و')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toWords(text) {
  return normalizeArabic(text).split(' ').filter(Boolean);
}

// Rewrites Uthmani spelling devices into everyday spelling: a ya carrying a
// dagger alif is ى at the end of a word (يٰمُوس۪يٰ → موسى) and ا inside it
// (اَ۬لتَّوْر۪يٰةَ → التوراة); any other dagger alif is a plain alif; a hamza
// on a kashida is written on an alif (يَسْـَٔلُونَكَ → يسألونك); a medial small
// wow is a full wow (دَاوُۥدُ → داوود).
function everydaySpelling(token) {
  return token
    .replace(/[يے]ٰ(?=[ً-ٟۖ-ۭ]*$)/, 'ى')
    .replace(/[يے]ٰ/g, 'ا')
    .replace(/ٰ/g, 'ا')
    .replace(/ـ[ً-ْ]*ٔ/g, 'ا')
    .replace(/ۥ(?=.*[ء-ي])/g, 'و');
}

// The Mushaf's Uthmani spelling differs from the everyday spelling speech
// recognition writes in ~10% of all words (measured against a standard-
// spelling Quran text), e.g. العٰلمين/العالمين, ءامنوا/آمنوا, الصلوٰة/الصلاة.
// Each reference word lists the everyday spellings of *that* word, so they
// count as a match without loosening comparison against any other word.
function spellingVariants(token) {
  const base = normalizeArabic(token);
  const everyday = normalizeArabic(everydaySpelling(token));
  const variants = new Set([everyday, everyday.replace(/واه$/, 'اه')]);
  for (const v of [...variants, base]) {
    variants.add(normalizeArabic(v.replace(/ءا/g, 'ا')));
    variants.add(normalizeArabic(v.replace(/ء/g, '')));
    variants.add(v.replace(/اليل/, 'الليل'));
  }
  variants.delete(base);
  variants.delete('');
  return [...variants];
}

// A reference word for alignment, built from one raw Mushaf token (or null if
// the token has no letters, e.g. a stand-alone sign).
export function refWord(token, meta = {}) {
  const word = normalizeArabic(token);
  if (!word) return null;
  return { word, alts: spellingVariants(token), ...meta };
}

// Speech recognition writes the vocative apart (يا أيها, يا قوم) where the
// Mushaf joins it (يٰٓأيها, يٰقوم); the Warsh text never has a lone يا.
function toSpokenWords(text) {
  const words = toWords(text);
  const merged = [];
  for (let k = 0; k < words.length; k++) {
    if (words[k] === 'يا' && k + 1 < words.length) merged.push(normalizeArabic(`يا${words[++k]}`));
    else merged.push(words[k]);
  }
  return merged;
}

// Word-level alignment via Levenshtein/edit-distance backtrace, so we can
// mark each reference word as correct / substituted / missing, and flag
// extra words the reciter added. `refWords` is either a plain string (no
// ayah tagging) or the `refWords` array from buildMushaf().
export function alignWords(refWords, spokenText) {
  const ref = typeof refWords === 'string' ? refWords.split(/\s+/).map((t) => refWord(t)).filter(Boolean) : refWords;
  const spoken = toSpokenWords(spokenText);
  const matches = (i, j) => ref[i - 1].word === spoken[j - 1] || !!ref[i - 1].alts?.includes(spoken[j - 1]);
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
  // Optional reference words (the Basmala at a surah start -- reciting it or
  // not are both valid) are nearly free to skip, but still cost more than a
  // match so they're matched whenever the reciter did say them.
  const delCost = (i) => (ref[i - 1].optional ? 0.01 : 1);

  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++) if (inBand(i, 0)) cost[i][0] = cost[i - 1][0] + delCost(i);
  for (let j = 1; j <= m; j++) if (inBand(0, j)) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (!inBand(i, j)) continue;
      // Standard Levenshtein recurrence: always compare all three options,
      // never take the diagonal (match/substitute) unconditionally just
      // because the words happen to be equal -- if this match's predecessor
      // is out-of-band (Infinity), a coincidental match at the wrong
      // position must lose to the correct "skip this word" alternative.
      const isMatch = matches(i, j);
      const diagonal = cost[i - 1][j - 1] + (isMatch ? POSITION_BIAS * i : 1);
      cost[i][j] = Math.min(diagonal, cost[i - 1][j] + delCost(i), cost[i][j - 1] + 1);
    }
  }

  const refEntry = (i, type, extra = {}) => ({
    type,
    index: i - 1,
    word: ref[i - 1].word,
    surah: ref[i - 1].surah,
    verse: ref[i - 1].verse,
    ...extra,
  });

  const result = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && matches(i, j) && cost[i][j] === cost[i - 1][j - 1] + POSITION_BIAS * i) {
      result.push(refEntry(i, 'correct'));
      i--; j--;
    } else if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + 1) {
      result.push(refEntry(i, 'substituted', { spoken: spoken[j - 1] }));
      i--; j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + delCost(i)) {
      result.push(refEntry(i, ref[i - 1].optional ? 'optional' : 'missing'));
      i--;
    } else {
      // afterIndex: the reference word this extra word was said after (-1 = before the first).
      result.push({ type: 'extra', word: spoken[j - 1], afterIndex: i - 1 });
      j--;
    }
  }
  result.reverse();

  return { alignment: result, mistakes: countMistakes(result), wordCount: countRefWords(result) };
}

const isMistake = (r) => r.type === 'substituted' || r.type === 'missing' || r.type === 'extra';
const countMistakes = (alignment) => alignment.filter(isMistake).length;
const countRefWords = (alignment) => alignment.filter((r) => r.type !== 'extra' && r.type !== 'optional').length;

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

// What kind of mistake an alignment entry is, for the tap-for-details popup.
// Word-level transcription carries no vowels, so tashkeel/tajweed kinds can't
// be detected yet -- only letters, whole words, and missing/extra words.
export function classifyMistake(item) {
  if (item.type === 'missing') return { kind: 'missing', title: 'كلمة ناقصة', detail: 'لم تُقرأ هذه الكلمة.' };
  if (item.type === 'extra') return { kind: 'extra', title: 'كلمة زائدة', detail: 'قُرئت كلمة ليست في هذا الموضع.' };
  if (item.type !== 'substituted') return null;
  const distance = editDistance(item.word, item.spoken);
  const closeEnough = distance <= 2 && distance / Math.max(item.word.length, item.spoken.length) <= 0.4;
  return closeEnough
    ? { kind: 'letter', title: 'خطأ في الحروف', detail: 'الكلمة قريبة من الصحيحة لكن يختلف فيها حرف أو حرفان.' }
    : { kind: 'word', title: 'كلمة مختلفة', detail: 'قُرئت كلمة أخرى بدل الكلمة الصحيحة.' };
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
  return { alignment: trimmed, mistakes: countMistakes(trimmed), wordCount: countRefWords(trimmed) };
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
