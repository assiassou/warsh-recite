// Letter/vowel/tajweed check of a recorded recitation by the syllable model
// on the local server (../../../warsh-finetune/server.py, /check). Testing
// path until the checker is hosted: it runs on this laptop's CPU.
// Same origin when the page is served by server.py itself (phone use);
// the laptop's local server when running the Vite dev server.
const SERVER = window.location.port === '5173' ? 'http://localhost:8788' : '';

// `save`: keep the recording on the laptop to improve the model (the user's choice).
export async function checkRecitation(blob, verses, save = false) {
  const form = new FormData();
  form.append('audio', blob, 'recitation.webm');
  form.append('fragments', JSON.stringify(verses.map((v) => ({ surah: v.surah, ayah: v.verse, text: v.text }))));
  if (save) form.append('save', '1');
  const res = await fetch(`${SERVER}/check`, { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`فشل الفحص (${res.status}). ${detail.slice(0, 200)}`);
  }
  return res.json();
}

// The reciter's own verdict on a saved recording: correct ones become training data.
export async function sendVerdict(recordingId, correct) {
  const res = await fetch(`${SERVER}/recordings/${recordingId}/verdict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correct }),
  });
  if (!res.ok) throw new Error(`تعذر الحفظ (${res.status})`);
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
