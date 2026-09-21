// Sends the recorded clip to the local fine-tuned Warsh Whisper model server
// (see ../../../warsh-finetune/server.py) for testing/comparison against the
// live Web Speech transcription. Not the production path -- this runs the
// model on CPU on this machine, a few seconds per clip.
const TRANSCRIBE_URL = 'http://localhost:8788/transcribe';

export async function transcribeAudio(blob, referenceText) {
  const form = new FormData();
  form.append('audio', blob, 'recitation.webm');
  if (referenceText) form.append('reference', referenceText);

  const res = await fetch(TRANSCRIBE_URL, { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`فشل التعرف على الصوت (${res.status}). ${detail}`);
  }
  const data = await res.json();
  return data.text ?? '';
}
