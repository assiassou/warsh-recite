// One-off build script: turns the raw downloaded Warsh text + chapter info
// into a single compact dataset the app bundles and reads at runtime.
import { readFileSync, writeFileSync } from 'node:fs';

const warsh = JSON.parse(readFileSync(new URL('../src/data/warsh-quran-raw.json', import.meta.url)));
const info = JSON.parse(readFileSync(new URL('../src/data/info-raw.json', import.meta.url)));

const textByChapter = new Map();
for (const { chapter, verse, text } of warsh.quran) {
  if (!textByChapter.has(chapter)) textByChapter.set(chapter, new Map());
  textByChapter.get(chapter).set(verse, text);
}

const chapters = info.chapters.map((c) => ({
  number: c.chapter,
  name: c.name,
  englishName: c.englishname,
  arabicName: c.arabicname,
  revelation: c.revelation,
  verses: c.verses.map((v) => textByChapter.get(c.chapter).get(v.verse)),
}));

writeFileSync(
  new URL('../src/data/warsh-quran.json', import.meta.url),
  JSON.stringify({ chapters }),
);

console.log(`Wrote ${chapters.length} chapters, ${chapters.reduce((n, c) => n + c.verses.length, 0)} verses.`);
