// One-off build script: turns the raw downloaded Warsh text + chapter info
// into a single compact dataset the app bundles and reads at runtime.
// Also groups verses into the 240 traditional "thumn" (1/8 hizb) units,
// which is the recitation unit the app navigates by.
import { readFileSync, writeFileSync } from 'node:fs';

const warsh = JSON.parse(readFileSync(new URL('../src/data/warsh-quran-raw.json', import.meta.url)));
const info = JSON.parse(readFileSync(new URL('../src/data/info-raw.json', import.meta.url)));

const textByChapter = new Map();
for (const { chapter, verse, text } of warsh.quran) {
  if (!textByChapter.has(chapter)) textByChapter.set(chapter, new Map());
  textByChapter.get(chapter).set(verse, text);
}

// maqra (1..240) is the traditional thumn/quarter-hizb index: 8 per juz,
// 4 per hizb. Walk every verse in Mushaf order and group by maqra.
const thumns = [];
let current = null;
for (const c of info.chapters) {
  for (const v of c.verses) {
    if (!current || current.number !== v.maqra) {
      current = {
        number: v.maqra,
        juz: v.juz,
        hizb: Math.ceil((((v.maqra - 1) % 8) + 1) / 4) + (v.juz - 1) * 2,
        quarterInHizb: (((v.maqra - 1) % 4) + 1),
        verses: [],
      };
      thumns.push(current);
    }
    current.verses.push({
      surah: c.chapter,
      surahName: c.arabicname,
      verse: v.verse,
      text: textByChapter.get(c.chapter).get(v.verse),
    });
  }
}

writeFileSync(
  new URL('../src/data/thumns.json', import.meta.url),
  JSON.stringify({ thumns }),
);

console.log(`Wrote ${thumns.length} thumns.`);
