# ترتيل ورش — Warsh Recitation Checker

A simple, installable mobile web app (PWA) to practice Quran recitation in
**Warsh 'an Nafi'** (the riwayah used in most of North/West Africa), with
live AI-assisted mistake checking — the same idea as Tarteel, but
Warsh-focused, and organized the way Warsh reciters actually practice: by
**thumn** (1/8 hizb), not by individual ayah.

Built as a PWA on purpose: it works on any phone with a browser (old or new,
Android or iPhone), no app store, no install size — matters since Warsh
recitation is most used in regions where phones and networks vary a lot.

## How it works

Juz (30) → Thumn (8 per juz, 240 total) → live recitation screen: tap
"ابدأ التلاوة", recite the whole thumn out loud, watch the live transcript
appear as you go (like live dictation), tap "إنهاء" to stop — the app then
diffs what you said against the reference Warsh text and highlights
missing/extra/substituted words.

Live transcription uses the browser's **built-in speech recognition**
(Web Speech API — `webkitSpeechRecognition` in Chrome/Android). This is
free and genuinely real-time, unlike calling a cloud STT API per request.
Trade-off: like Whisper, it's not tuned for classical/Quranic Arabic, so
it'll catch big mistakes (wrong/missing/extra words) but not subtle
tajweed errors. It also only works in Chromium-based browsers — no
Firefox, limited/no support on iOS Safari.

## What's here

- `src/data/thumns.json` — the full Warsh Mushaf text (114 Surahs, 6236
  verses) grouped into the 240 traditional thumn units, sourced from the
  King Fahd Complex text via the
  [quran-api](https://github.com/fawazahmed0/quran-api) project. Boundaries
  (juz/hizb/thumn) come from that project's standard Mushaf page/maqra
  metadata, which is riwayah-independent and lines up with Warsh's verse
  numbering exactly (verified — 0 mismatches across all 114 Surahs).
- `scripts/build-data.mjs` — regenerates `thumns.json` from the raw API
  data (see comments in the file for the download step).
- `src/App.jsx` — Juz list → Thumn list → live recite screen.
- `src/components/LiveRecite.jsx` — the live recitation screen itself.
- `src/lib/liveSpeech.js` — wraps the Web Speech API, auto-restarting it
  so it feels like one continuous session (the browser stops it after
  every pause in speech).
- `src/lib/arabicMatch.js` — normalizes Arabic text and word-aligns the
  reciter's speech against the reference text to flag mistakes.
- `src/lib/transcribe.js` + `server/` — an **alternate, currently unused**
  path: record audio, send to a backend that proxies to OpenAI Whisper.
  Kept as a fallback option for browsers without live speech support, or
  if Whisper's accuracy ever proves better than the browser's built-in
  recognizer. Not wired into the UI right now, and the backend isn't
  deployed anywhere.

## Running locally

```bash
npm install
npm run dev
```

Then open it on your phone (same Wi-Fi/hotspot as your computer) at
`http://<your-computer's-LAN-IP>:5173` — the live mic-based flow needs a
real device to test meaningfully.

## Known limitations (honest MVP scope)

- **Speech recognition accuracy**: see above — expect it to miss subtle
  tajweed errors. A real accuracy upgrade means fine-tuning a speech
  model specifically on Warsh recitation audio, which is a separate,
  bigger project (needs a paired audio+text dataset; compute cost for the
  fine-tuning itself is cheap, roughly $10-30, but finding/preparing a
  Warsh audio dataset is the real effort).
- **Browser support**: live recitation needs Chrome/Android (Web Speech
  API). No Firefox, no reliable iOS support yet.
- **No memorization mode, user accounts, or progress tracking yet** —
  intentionally left out of this first version to keep it focused on the
  core "recite a thumn, see your mistakes" loop.
