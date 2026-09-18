// Sends the recorded clip to our own backend, which holds the STT API key
// server-side (never expose that key in client code — anyone could read it
// out of the bundle and run up your bill). See /server for the reference
// implementation to deploy.
export async function transcribeAudio(blob) {
  const form = new FormData();
  form.append('audio', blob, 'recitation.webm');

  const res = await fetch('/api/transcribe', { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`فشل التعرف على الصوت (${res.status}). ${detail}`);
  }
  const data = await res.json();
  return data.text ?? '';
}
