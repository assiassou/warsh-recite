// Regression tests for the recitation matcher (src/lib/arabicMatch.js).
// Run: node scripts/test-matching.mjs   -- exits non-zero if anything fails.
import fs from 'node:fs';
import { alignWords, trimUnrecitedTail } from '../src/lib/arabicMatch.js';
import { buildMushaf } from '../src/lib/mushaf.js';

const { thumns } = JSON.parse(fs.readFileSync(new URL('../src/data/thumns.json', import.meta.url), 'utf8'));
const verse = (s, v) => thumns.flatMap((t) => t.verses).find((x) => x.surah === s && x.verse === v).text;

const kahf = [verse(18, 9), verse(18, 10), verse(18, 11)].join(' ');
const kahf10 = 'اذ اوى الفتيه الى الكهف فقالوا ربنا اتنا من لدنك رحمه وهيئ لنا من امرنا رشدا';
const hizb1 = buildMushaf(thumns[0]).refWords;
const fatiha =
  'بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم ملك يوم الدين اياك نعبد واياك نستعين اهدنا الصراط المستقيم صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين';

// [name, reference, what speech recognition wrote, expected mistakes, expected mistake words]
const cases = [
  ['clean recitation', kahf, kahf10, 0],
  ['everyday spelling of Mushaf words', hizb1, `${fatiha} بسم الله الرحمن الرحيم الم ذلك الكتاب لا ريب فيه هدى للمتقين الذين يؤمنون بالغيب ويقيمون الصلاة`, 0],
  ['Basmala skipped at a surah start', hizb1, `${fatiha} الم ذلك الكتاب`, 0],
  ['wrong word', hizb1, fatiha.replace('نعبد', 'نعمل'), 1, ['نعبد']],
  ['missing word', kahf, kahf10.replace('اتنا ', ''), 1, ['ءاتنا']],
  ['extra word', kahf, kahf10.replace('رحمه', 'رحمه كبيره'), 1, ['كبيره']],
  ['extra word that occurs nearby', kahf, kahf10.replace('فقالوا', 'فقالوا الكهف'), 1, ['الكهف']],
  ['stop and restart (waqf/ibtida)', kahf, kahf10.replace('رحمه', 'رحمه ربنا اتنا من لدنك رحمه'), 0],
  ['stutter', kahf, kahf10.replace('ربنا', 'ربنا ربنا'), 0],
  ['ayah recited 3 times', kahf, `${kahf10} ${kahf10} ${kahf10}`, 0],
  ['Fatiha recited 3 times', hizb1, `${fatiha} ${fatiha} ${fatiha}`, 0],
  ['stumble, then restart correctly', kahf, kahf10.replace('من امرنا', 'من امرونا من امرنا'), 0],
  ['mistake in the last attempt counts', kahf, kahf10.replace('رحمه', 'رحمه ربنا اتنا من عندك رحمه'), 1, ['لدنك']],
  ['starting partway into the reference', kahf, kahf10.split(' ').slice(6).join(' '), 0],
  ['two words heard as one (وبالاخرتهم)', hizb1, `${fatiha} الم ذلك الكتاب لا ريب فيه هدى للمتقين الذين يومنون بالغيب ويقيمون الصلاه ومما رزقناهم ينفقون والذين يومنون بما انزل اليك وما انزل من قبلك وبالاخرتهم يوقنون`, 0],
  ['one word heard as two (نست عين، الض الين)', hizb1, fatiha.replace('نستعين', 'نست عين').replace('الضالين', 'الض الين'), 0],
  ['opening letters by name (الف لام ميم)', hizb1, `${fatiha} بسم الله الرحمن الرحيم الف لام ميم ذلك الكتاب`, 0],
  ['opening letters garbled by speech recognition (الملام)', hizb1, `${fatiha} الملام ذلك الكتاب`, 0],
  ['Hafs form written for a Warsh word (مالك) is uncertain, not a mistake', hizb1, fatiha.replace('ملك', 'مالك'), 0],
  ['Hafs form still shown as uncertain', hizb1, fatiha.replace('ملك', 'مالك'), 0, [], ['ملك']],
];

let failed = 0;
for (const [name, ref, spoken, expected, words, uncertain] of cases) {
  const r = trimUnrecitedTail(alignWords(ref, spoken));
  const got = r.alignment.filter((a) => ['substituted', 'missing', 'extra'].includes(a.type)).map((a) => a.word);
  const gotUncertain = r.alignment.filter((a) => a.type === 'uncertain').map((a) => a.word);
  const ok =
    r.mistakes === expected &&
    (!words || words.every((w, k) => got[k] === w)) &&
    (!uncertain || (uncertain.length === gotUncertain.length && uncertain.every((w, k) => gotUncertain[k] === w)));
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  — expected ${expected} ${words ?? ''}, got ${r.mistakes} ${got.join(' ')}`}`);
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
