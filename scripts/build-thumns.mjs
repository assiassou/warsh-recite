// Builds the real 480-thumn dataset (1/8 hizb, the actual Warsh recitation
// unit) from manually transcribed boundaries (scripts/thumn-boundaries-manual.json,
// sourced from the user's reference PDF: بدايات ونهايات أرباع القرآن ورش).
//
// Each hizb entry lists its 8 thumn *end* points as [surah, verse]. A
// thumn's start is the verse right after the previous thumn's end — rolling
// over to the next surah when the previous surah is exhausted. Hizb 1
// implicitly starts at Fatiha 1.
//
// A handful of verses (scripts/verse-splits.json) have a Thumn boundary
// mid-ayah, confirmed against the PDF directly. Those verses are split into
// two text fragments so the app can show the Thumn ending exactly where the
// Mushaf marks it, not rounded out to the full verse.
import { readFileSync, writeFileSync } from 'node:fs';

const warsh = JSON.parse(readFileSync(new URL('../src/data/warsh-quran-raw.json', import.meta.url)));
const boundaries = JSON.parse(readFileSync(new URL('./thumn-boundaries-manual.json', import.meta.url)));
const verseSplits = new Set(JSON.parse(readFileSync(new URL('./verse-splits.json', import.meta.url))).verses);

const textByKey = new Map();
const versesPerSurah = new Map();
for (const { chapter, verse, text } of warsh.quran) {
  // ۞ (rub'/waqf ornament) is stripped everywhere except the handful of
  // split verses below, where it's used only to locate the split point.
  const key = `${chapter}:${verse}`;
  const clean = verseSplits.has(key) ? text : text.replaceAll('۞', '');
  textByKey.set(key, clean);
  versesPerSurah.set(chapter, Math.max(versesPerSurah.get(chapter) ?? 0, verse));
}

function nextVerse(surah, verse) {
  if (verse < versesPerSurah.get(surah)) return [surah, verse + 1];
  return [surah + 1, 1];
}

function splitVerseText(text) {
  const [part1, part2] = text.split('۞');
  if (part2 === undefined) throw new Error(`Expected a split marker in: ${text}`);
  return [part1.trim(), part2.trim()];
}

const thumns = [];
let cursor = [1, 1];
let pendingFragment = null; // {surah, verse, text} left over from a split verse
for (let hizb = 1; hizb <= 60; hizb++) {
  const ends = boundaries.hizbs[String(hizb)];
  for (let q = 0; q < 8; q++) {
    const [endSurah, endVerse] = ends[q];
    const verses = [];
    let [s, v] = cursor;

    if (pendingFragment) {
      verses.push(pendingFragment);
      pendingFragment = null;
      if (s === endSurah && v === endVerse) {
        // the whole rest of this thumn was just the leftover fragment
      } else {
        [s, v] = nextVerse(s, v);
      }
    }

    while (!(verses.length && verses.at(-1).surah === endSurah && verses.at(-1).verse === endVerse)) {
      const key = `${s}:${v}`;
      const text = textByKey.get(key);
      if (!text) throw new Error(`Missing text for ${key} (hizb ${hizb}, thumn ${q + 1})`);

      if (s === endSurah && v === endVerse && verseSplits.has(key)) {
        const [part1, part2] = splitVerseText(text);
        verses.push({ surah: s, verse: v, text: part1, ayahEnds: false });
        pendingFragment = { surah: s, verse: v, text: part2 };
        cursor = [s, v]; // next thumn starts with the pending fragment, same verse
        break;
      }

      verses.push({ surah: s, verse: v, text });
      if (s === endSurah && v === endVerse) {
        cursor = nextVerse(endSurah, endVerse);
        break;
      }
      [s, v] = nextVerse(s, v);
    }

    thumns.push({
      number: thumns.length + 1,
      hizb,
      quarterInHizb: q + 1,
      verses,
    });
  }
}

if (thumns.length !== 480) throw new Error(`Expected 480 thumns, got ${thumns.length}`);

writeFileSync(
  new URL('../src/data/thumns.json', import.meta.url),
  JSON.stringify({ thumns }),
);

console.log(`Wrote ${thumns.length} thumns.`);
console.log('Last verse:', thumns[479].verses.at(-1));
for (const t of thumns) {
  if (t.verses.some((v, i) => i > 0 && t.verses[i - 1].surah === v.surah && t.verses[i - 1].verse === v.verse)) {
    console.log('split thumn:', t.number, 'hizb', t.hizb, 'q', t.quarterInHizb, JSON.stringify(t.verses.at(-1)));
  }
}
