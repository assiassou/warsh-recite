// Letter/vowel/tajweed check of a recorded recitation by the syllable model
// on the local server (../../../warsh-finetune/server.py, /check). Testing
// path until the checker is hosted: it runs on this laptop's CPU.
const CHECK_URL = 'http://localhost:8788/check';

export async function checkRecitation(blob, verses) {
  const form = new FormData();
  form.append('audio', blob, 'recitation.webm');
  form.append('fragments', JSON.stringify(verses.map((v) => ({ surah: v.surah, ayah: v.verse, text: v.text }))));
  const res = await fetch(CHECK_URL, { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`فشل الفحص (${res.status}). ${detail.slice(0, 200)}`);
  }
  return res.json();
}

// Turns the server's per-word results into alignment-style entries keyed by
// the app's word index (refWords from buildMushaf), so MushafView and
// MistakeSheet can show them like any other result.
export function toAlignment(words, verses, refWords) {
  const indicesByVerse = new Map();
  refWords.forEach((w, index) => {
    if (w.optional) return;
    const key = `${w.surah}:${w.verse}`;
    if (!indicesByVerse.has(key)) indicesByVerse.set(key, []);
    indicesByVerse.get(key).push(index);
  });
  const alignment = [];
  for (const r of words) {
    const v = verses[r.fragment];
    const index = indicesByVerse.get(`${v.surah}:${v.verse}`)?.[r.word];
    if (index === undefined || r.status === 'unrecited') continue;
    const base = { index, word: refWords[index].word, surah: v.surah, verse: v.verse, precise: true };
    if (r.status === 'ok') alignment.push({ ...base, type: 'correct' });
    else if (r.status === 'uncertain')
      alignment.push({ ...base, type: 'uncertain', kind: r.kind, expectedSyllables: r.expected, heardSyllables: r.heard });
    else
      alignment.push({
        ...base,
        type: r.kind === 'missing' ? 'missing' : 'substituted',
        kind: r.kind,
        rules: r.rules ?? [],
        expectedSyllables: r.expected,
        heardSyllables: r.heard,
      });
  }
  return alignment;
}
