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
  // The opening letters (الٓمٓ, كٓهيعٓصٓ, صٓ…) are recited by their names, which
  // speech recognition writes out: "الف لام ميم" (joined in toSpokenWords).
  if (token.includes('ٓ') && base.length <= 5 && [...base].every((c) => LETTER_NAMES[c])) {
    variants.add([...base].map((c) => LETTER_NAMES[c]).join(''));
  }
  variants.delete(base);
  variants.delete('');
  return [...variants];
}

const LETTER_NAMES = {
  ا: 'الف', ل: 'لام', م: 'ميم', ر: 'را', ص: 'صاد', ك: 'كاف', ه: 'ها',
  ي: 'يا', ع: 'عين', ط: 'طا', س: 'سين', ح: 'حا', ق: 'قاف', ن: 'نون',
};
const NAMES = new Set(Object.values(LETTER_NAMES));
const letterName = (w) => (NAMES.has(w.replace(/ء$/, '')) ? w.replace(/ء$/, '') : null);

// A reference word for alignment, built from one raw Mushaf token (or null if
// the token has no letters, e.g. a stand-alone sign).
export function refWord(token, meta = {}) {
  const word = normalizeArabic(token);
  if (!word) return null;
  // Speech recognition can't hear the opening letters' names reliably (writes
  // الملام for الٓمٓ): the live check accepts whatever it wrote there.
  const any = token.includes('ٓ') && word.length <= 5 && [...word].every((c) => LETTER_NAMES[c]);
  return { word, alts: spellingVariants(token), ...(any ? { any: true } : {}), ...meta };
}

// Speech recognition writes as separate words what the Mushaf writes as one:
// the names of the opening letters (الف لام ميم for الٓمٓ -- two or more names
// in a row are joined), and the vocative (يا أيها, يا قوم for يٰٓأيها, يٰقوم;
// the Warsh text never has a lone يا).
function toSpokenWords(text) {
  const words = toWords(text);
  const letters = [];
  for (let k = 0; k < words.length; k++) {
    let end = k;
    while (end < words.length && letterName(words[end])) end++;
    if (end - k >= 2) {
      letters.push(words.slice(k, end).map(letterName).join(''));
      k = end - 1;
    } else letters.push(words[k]);
  }
  const merged = [];
  for (let k = 0; k < letters.length; k++) {
    if (letters[k] === 'يا' && k + 1 < letters.length) merged.push(normalizeArabic(`يا${letters[++k]}`));
    else merged.push(letters[k]);
  }
  return merged;
}

// Word-level alignment via Levenshtein/edit-distance backtrace, so we can
// mark each reference word as correct / substituted / missing, and flag
// extra words the reciter added. `refWords` is either a plain string (no
// ayah tagging) or the `refWords` array from buildMushaf().
//
// Only the stretch actually recited is checked: if the reciter starts partway
// into the reference, the words before are left out of the result (not
// flagged as missing), just like the unrecited words after they stop.
export function alignWords(refWords, spokenText) {
  const fullRef = typeof refWords === 'string' ? refWords.split(/\s+/).map((t) => refWord(t)).filter(Boolean) : refWords;
  const spoken = toSpokenWords(spokenText);
  const start = findStart(fullRef, spoken);
  const ref = start ? fullRef.slice(start) : fullRef;
  const matches = (i, j) => ref[i - 1].any || refMatches(ref[i - 1], spoken[j - 1]);
  // Speech recognition is trained mostly on Hafs and writes the Hafs form of a
  // word (مالك) even when Warsh (ملك) was recited: shown as "check this", not a
  // mistake. Costs a little more than a real match, less than a substitution.
  const hafsMatch = (i, j) => !!ref[i - 1].hafs && ref[i - 1].hafs === spoken[j - 1];
  const HAFS_COST = 0.1;
  const n = ref.length;
  const m = spoken.length;
  const forms = (r) => [r.word, ...(r.alts ?? [])];
  // Spoken word j = reference words i-1 and i said as one (a final ة is heard
  // as ت when joined: الاخرة + هم -> الاخرتهم).
  const joinedMatch = (i, j) =>
    i >= 2 &&
    forms(ref[i - 2]).some((a) => [a, a.replace(/ه$/, 'ت')].some((a2) => forms(ref[i - 1]).some((b) => a2 + b === spoken[j - 1])));
  // Spoken words j-1 and j = reference word i said in two pieces.
  const splitMatch = (i, j) => j >= 2 && refMatches(ref[i - 1], spoken[j - 2] + spoken[j - 1]);

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
  // A hair above 1: in the middle of a recitation a substitution (1) still
  // beats an extra + a missing word (2), but past the last word, where
  // unrecited reference words are free, an extra word now beats mismatching
  // it against the next ayah (e.g. the tail of an ayah recited again).
  const SUB_COST = 1 + 1e-3;
  // Optional reference words (the Basmala at a surah start -- reciting it or
  // not are both valid) are nearly free to skip, but still cost more than a
  // match so they're matched whenever the reciter did say them.
  const delCost = (i) => (ref[i - 1].optional ? 0.01 : 1);

  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  // jumpFrom[i][j]: set when the best way to reach (i, j) is restarting from
  // a later reference position -- see the restart step below.
  const jumpFrom = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-1));
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++) if (inBand(i, 0)) cost[i][0] = cost[i - 1][0] + delCost(i);
  for (let j = 1; j <= m; j++) {
    if (inBand(0, j)) cost[0][j] = cost[0][j - 1] + 1;
    for (let i = 1; i <= n; i++) {
      if (!inBand(i, j)) continue;
      // Standard Levenshtein recurrence: always compare all three options,
      // never take the diagonal (match/substitute) unconditionally just
      // because the words happen to be equal -- if this match's predecessor
      // is out-of-band (Infinity), a coincidental match at the wrong
      // position must lose to the correct "skip this word" alternative.
      const isMatch = matches(i, j);
      const diagonal = cost[i - 1][j - 1] + (isMatch ? POSITION_BIAS * i : hafsMatch(i, j) ? HAFS_COST : SUB_COST);
      cost[i][j] = Math.min(diagonal, cost[i - 1][j] + delCost(i), cost[i][j - 1] + 1);
      // Speech recognition joins two words it hears as one (وبالاخرتهم for
      // وَبِالَاخِرَةِ هُمْ) or splits one (نست عين for نَسْتَعِينُ): both correct.
      if (joinedMatch(i, j)) cost[i][j] = Math.min(cost[i][j], cost[i - 2][j - 1] + POSITION_BIAS * i);
      if (splitMatch(i, j)) cost[i][j] = Math.min(cost[i][j], cost[i - 1][j - 2] + POSITION_BIAS * i);
    }
    // Restart: stopping and resuming from an earlier word (waqf and ibtida',
    // or repeating an ayah to memorize it) is correct recitation. Going back
    // costs RESTART_COST (below 1, so re-reading even one word beats calling
    // it extra); the re-read words then match normally. A wrong word that
    // just happens to occur a little earlier gains nothing: getting back to
    // where the reciter really is would mean skipping words.
    for (let i = n - 1; i >= 0; i--) {
      if (!inBand(i, j)) continue;
      for (let from = i + 1; from <= Math.min(n, i + RESTART_LOOKBACK); from++) {
        const viaRestart = cost[from][j] + RESTART_COST;
        if (viaRestart < cost[i][j]) {
          cost[i][j] = viaRestart;
          jumpFrom[i][j] = from;
        }
      }
    }
  }

  const refEntry = (i, type, extra = {}) => ({
    type,
    index: start + i - 1,
    word: ref[i - 1].word,
    surah: ref[i - 1].surah,
    verse: ref[i - 1].verse,
    ...extra,
  });

  // The reciter usually stops before the end of the reference. Reference
  // words after the last spoken word are simply not recited yet, so the
  // alignment may end anywhere in the reference at no cost -- otherwise it
  // "uses up" that unrecited tail by mismatching extra spoken words (e.g. a
  // repeated phrase) against it.
  let end = n;
  for (let k = 0; k <= n; k++) if (cost[k][m] < cost[end][m]) end = k;

  const result = [];
  for (let k = n; k > end; k--) result.push(refEntry(k, ref[k - 1].optional ? 'optional' : 'missing'));
  let i = end;
  let j = m;
  while (i > 0 || j > 0) {
    if (jumpFrom[i][j] >= 0) {
      // In reading order: the reciter reached `from`, then restarted at word i+1.
      result.push({ type: 'restart', restartAt: start + i });
      i = jumpFrom[i][j];
    } else if (i > 0 && j > 0 && matches(i, j) && cost[i][j] === cost[i - 1][j - 1] + POSITION_BIAS * i) {
      result.push(refEntry(i, 'correct'));
      i--; j--;
    } else if (i > 0 && j > 0 && hafsMatch(i, j) && cost[i][j] === cost[i - 1][j - 1] + HAFS_COST) {
      result.push(refEntry(i, 'uncertain', { kind: 'riwayah', spoken: spoken[j - 1] }));
      i--; j--;
    } else if (i > 1 && j > 0 && joinedMatch(i, j) && cost[i][j] === cost[i - 2][j - 1] + POSITION_BIAS * i) {
      result.push(refEntry(i, 'correct'), refEntry(i - 1, 'correct'));
      i -= 2; j--;
    } else if (i > 0 && j > 1 && splitMatch(i, j) && cost[i][j] === cost[i - 1][j - 2] + POSITION_BIAS * i) {
      result.push(refEntry(i, 'correct'));
      i--; j -= 2;
    } else if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + SUB_COST) {
      result.push(refEntry(i, 'substituted', { spoken: spoken[j - 1] }));
      i--; j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + delCost(i)) {
      result.push(refEntry(i, ref[i - 1].optional ? 'optional' : 'missing'));
      i--;
    } else {
      // afterIndex: the reference word this extra word was said after (-1 = before the first).
      result.push({ type: 'extra', word: spoken[j - 1], afterIndex: start + i - 1 });
      j--;
    }
  }
  result.reverse();
  const alignment = keepLastAttempt(result);

  return { alignment, mistakes: countMistakes(alignment), wordCount: countRefWords(alignment) };
}

const SAID = new Set(['correct', 'substituted', 'uncertain']);
const RESTART_COST = 0.5;
const RESTART_LOOKBACK = 200;

// After a restart, the last attempt at each word is the one that counts: the
// abandoned attempt (including any stumble that made the reciter restart) is
// marked 'repeat' -- never a mistake, never shown. Words the reciter read in
// the abandoned attempt but stopped before reaching again keep their result.
function keepLastAttempt(items) {
  const out = [];
  let justRestarted = false;
  for (const item of items) {
    if (item.type !== 'restart') {
      // Extra words right at a restart point are part of the stumble that
      // caused it (من امرونا | من امرنا) -- the alignment may equally place
      // them just before or just after the restart.
      const stumble = justRestarted && item.type === 'extra';
      out.push(stumble ? { ...item, type: 'repeat', was: 'extra' } : item);
      if (item.type !== 'extra') justRestarted = false;
      continue;
    }
    justRestarted = true;
    for (let k = out.length - 1; k >= 0; k--) {
      const position = out[k].index ?? out[k].afterIndex;
      if (position < item.restartAt) break;
      if (out[k].type !== 'repeat') out[k] = { ...out[k], type: 'repeat', was: out[k].type };
    }
  }
  let lastSaid = -1;
  for (const item of out) if (SAID.has(item.type)) lastSaid = Math.max(lastSaid, item.index);
  return out.map((item) => (item.type === 'repeat' && item.index > lastSaid ? { ...item, type: item.was } : item));
}

const refMatches = (r, w) => r.word === w || !!r.alts?.includes(w);
const START_PROBE = 3;

// Where in the reference the reciter began: the start, unless their first
// words don't fit there but all fit, in order, somewhere later.
function findStart(ref, spoken) {
  const probe = spoken.slice(0, START_PROBE);
  if (probe.length < START_PROBE) return 0;
  const fits = (s) => probe.filter((w, t) => s + t < ref.length && refMatches(ref[s + t], w)).length;
  if (fits(0) >= START_PROBE - 1) return 0;
  for (let s = 1; s <= ref.length - START_PROBE; s++) if (fits(s) === START_PROBE) return s;
  return 0;
}
const isMistake = (r) => r.type === 'substituted' || r.type === 'missing' || r.type === 'extra';
const countMistakes = (alignment) => alignment.filter(isMistake).length;
const countRefWords = (alignment) =>
  alignment.filter((r) => r.index !== undefined && r.type !== 'optional' && r.type !== 'repeat').length;

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
    if (SAID.has(item.type)) lastMatched = i;
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
    if (SAID.has(item.type)) {
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
