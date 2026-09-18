// Minimal transcription proxy: keeps the OpenAI API key server-side.
// Run with: OPENAI_API_KEY=sk-... node server/index.js
// Deploy this anywhere that can hold a secret (Render, Fly.io, a small VPS).
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

const app = express();
const upload = multer();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no audio uploaded' });
  try {
    const file = await toFile(req.file.buffer, 'recitation.webm');
    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'ar',
    });
    res.json({ text: transcription.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'transcription failed' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`transcribe server on :${port}`));
