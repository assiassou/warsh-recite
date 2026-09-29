// Builds src/data/hafs-variants.json: for every word where the Warsh reading
// differs from Hafs (ملك/مالك, يومنون/يؤمنون is only spelling, but تعملون/يعملون,
// ننشرها/ننشزها...), the everyday spelling of the Hafs word. Speech
// recognition is trained mostly on Hafs and often writes the Hafs form even
// when Warsh was recited, so the app shows those as "check this" (amber), not
// as mistakes.
//
// Needs the raw texts (not committed):
//   curl -L -o src/data/warsh-quran-raw.json https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranwarsh.json
//   curl -L -o src/data/hafs-quran-raw.json  https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quransimple.json
// then: node scripts/build-hafs-variants.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { alignWords, refWord, toWords } from '../src/lib/arabicMatch.js';

const warsh = JSON.parse(readFileSync(new URL('../src/data/warsh-quran-raw.json', import.meta.url))).quran;
const hafs = JSON.parse(readFileSync(new URL('../src/data/hafs-quran-raw.json', import.meta.url))).quran;
const hafsByKey = new Map(hafs.map((v) => [`${v.chapter}:${v.verse}`, v.text]));

const variants = {};
let count = 0;
for (const v of warsh) {
  const key = `${v.chapter}:${v.verse}`;
  const ref = v.text
    .replaceAll('۞', '')
    .split(/\s+/)
    .map((t) => refWord(t))
    .filter(Boolean);
  const { alignment } = alignWords(ref, toWords(hafsByKey.get(key)).join(' '));
  for (const a of alignment) {
    if (a.type !== 'substituted') continue;
    (variants[key] ??= {})[a.index] = a.spoken;
    count++;
  }
}
writeFileSync(new URL('../src/data/hafs-variants.json', import.meta.url), JSON.stringify(variants));
console.log(`${count} words differ between the Warsh and Hafs readings, in ${Object.keys(variants).length} ayahs`);
