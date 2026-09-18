// For each hizb (using trusted hizb-level start/end), find candidate thumn
// boundary points: every ۞ marker position (word-level) plus every surah
// start, in Quran order. A correct hizb should yield exactly 7 internal
// candidates (splitting it into 8 thumns).
import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(new URL('../src/data/warsh-quran-raw.json', import.meta.url)));
const hizbBounds = JSON.parse(readFileSync(new URL('./hizb-bounds.json', import.meta.url)));

const textByKey = new Map();
const versesPerSurah = new Map();
for (const { chapter, verse, text } of raw.quran) {
  textByKey.set(`${chapter}:${verse}`, text);
  versesPerSurah.set(chapter, Math.max(versesPerSurah.get(chapter) ?? 0, verse));
}

function nextVerse(surah, verse) {
  if (verse < versesPerSurah.get(surah)) return [surah, verse + 1];
  return [surah + 1, 1];
}

function verseWords(text) {
  // split on whitespace, keep the marker attached to the word it precedes
  return text.split(/\s+/).filter(Boolean);
}

const results = [];
for (const hb of hizbBounds) {
  let [s, v] = hb.start;
  const candidates = [];
  let isFirst = true;
  while (true) {
    if (v === 1 && !isFirst) {
      candidates.push({ surah: s, verse: v, wordIndex: 0, reason: 'surah-start' });
    }
    const text = textByKey.get(`${s}:${v}`);
    const words = verseWords(text);
    words.forEach((w, idx) => {
      if (w.includes('۞') && !(idx === 0 && v === 1 && !isFirst)) {
        candidates.push({ surah: s, verse: v, wordIndex: idx, reason: 'marker' });
      }
    });
    isFirst = false;
    if (s === hb.end[0] && v === hb.end[1]) break;
    [s, v] = nextVerse(s, v);
  }
  results.push({ hizb: hb.hizb, count: candidates.length, candidates });
}

for (const r of results) {
  console.log(`hizb ${r.hizb}: ${r.count} candidates ${r.count !== 7 ? '  <-- MISMATCH' : ''}`);
}
