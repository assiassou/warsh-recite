// Sends a clip to the Hafs-only syllable model on the local server, for
// side-by-side comparison with the Warsh fine-tune. Output is raw syllables,
// not word-level text, so it's shown as-is rather than aligned against the
// reference (see ../components/HafsModelTest.jsx).
const URL_ = 'http://localhost:8788/transcribe-hafs-syllable';

export async function transcribeHafsSyllables(blob) {
  const form = new FormData();
  form.append('audio', blob, 'recitation.webm');

  const res = await fetch(URL_, { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`فشل التعرف على الصوت (${res.status}). ${detail}`);
  }
  const data = await res.json();
  return data.text ?? '';
}
