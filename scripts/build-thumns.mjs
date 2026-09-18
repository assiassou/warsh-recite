// Builds the real 480-thumn dataset (1/8 hizb, the actual Warsh recitation
// unit) from manually transcribed boundaries (scripts/thumn-boundaries-manual.json,
// sourced from the user's reference PDF: بدايات ونهايات أرباع القرآن ورش).
//
// Each hizb entry lists its 8 thumn *end* points as [surah, verse]. A
// thumn's start is the verse right after the previous thumn's end — rolling
// over to the next surah when the previous surah is exhausted. Hizb 1
// implicitly starts at Fatiha 1.
import { readFileSync, writeFileSync } from 'node:fs';

const warsh = JSON.parse(readFileSync(new URL('../src/data/warsh-quran-raw.json', import.meta.url)));
const boundaries = JSON.parse(readFileSync(new URL('./thumn-boundaries-manual.json', import.meta.url)));

const textByKey = new Map();
const versesPerSurah = new Map();
for (const { chapter, verse, text } of warsh.quran) {
  textByKey.set(`${chapter}:${verse}`, text);
  versesPerSurah.set(chapter, Math.max(versesPerSurah.get(chapter) ?? 0, verse));
}

function nextVerse(surah, verse) {
  if (verse < versesPerSurah.get(surah)) return [surah, verse + 1];
  return [surah + 1, 1];
}

const thumns = [];
let cursor = [1, 1];
for (let hizb = 1; hizb <= 60; hizb++) {
  const ends = boundaries.hizbs[String(hizb)];
  for (let q = 0; q < 8; q++) {
    const [endSurah, endVerse] = ends[q];
    const [startSurah, startVerse] = cursor;
    const verses = [];
    let [s, v] = [startSurah, startVerse];
    while (true) {
      const text = textByKey.get(`${s}:${v}`);
      if (!text) throw new Error(`Missing text for ${s}:${v} (hizb ${hizb}, thumn ${q + 1})`);
      verses.push({ surah: s, verse: v, text });
      if (s === endSurah && v === endVerse) break;
      [s, v] = nextVerse(s, v);
    }
    thumns.push({
      number: thumns.length + 1,
      hizb,
      quarterInHizb: q + 1,
      verses,
    });
    cursor = nextVerse(endSurah, endVerse);
  }
}

if (thumns.length !== 480) throw new Error(`Expected 480 thumns, got ${thumns.length}`);

writeFileSync(
  new URL('../src/data/thumns.json', import.meta.url),
  JSON.stringify({ thumns }),
);

console.log(`Wrote ${thumns.length} thumns.`);
console.log('Last verse:', thumns[479].verses.at(-1));
