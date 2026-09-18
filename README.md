# ترتيل ورش — Warsh Recitation Checker

A simple, installable mobile web app (PWA) to practice Quran recitation in
**Warsh 'an Nafi'** (the riwayah used in most of North/West Africa), with
AI-assisted mistake checking — the same idea as Tarteel, but Warsh-focused.

Built as a PWA on purpose: it works on any phone with a browser (old or new,
Android or iPhone), no app store, no install size — matters since Warsh
recitation is most used in regions where phones and networks vary a lot.

## What's here

- `src/data/warsh-quran.json` — the full Warsh Mushaf text (114 Surahs,
  6236 verses), sourced from the King Fahd Complex text via the
  [quran-api](https://github.com/fawazahmed0/quran-api) project.
- `src/App.jsx` — Surah list → verse list → tap a verse to record.
- `src/components/Recorder.jsx` — record with the mic, play back, send for
  checking.
- `src/lib/arabicMatch.js` — normalizes Arabic text and aligns the reciter's
  words against the reference verse (word-level diff) to flag missing,
  extra, or substituted words.
- `src/lib/transcribe.js` — client-side call to `/api/transcribe`.
- `server/` — minimal reference backend that holds the OpenAI API key and
  proxies to Whisper. **Not deployed anywhere yet** — you need to run/host
  this yourself (see below) for the "check recitation" button to work.

## Running locally

```bash
npm install
npm run dev
```

The app works and is browsable without the backend — recording and playback
work standalone. "Check recitation" needs the backend running:

```bash
cd server
npm install
OPENAI_API_KEY=sk-... npm start
```

Then set Vite to proxy `/api` to the backend during dev (add to
`vite.config.js`'s `server.proxy`), or just deploy both together in
production behind the same domain.

## Known limitations (honest MVP scope)

- **Speech recognition accuracy**: Whisper is not tuned for classical/
  Quranic Arabic, and there's no Warsh-specific speech model available
  today. It will catch big mistakes (wrong/missing/extra words) but not
  subtle tajweed errors. A real accuracy upgrade later means fine-tuning
  a model on Warsh recitation audio — a separate project.
- **Cost**: transcription costs money per API call (~$0.006/min with
  OpenAI). Fine for early usage; needs a self-hosted transcription server
  if usage grows a lot.
- **No user accounts, progress tracking, or offline transcription yet** —
  intentionally left out of this first version to keep it focused.
