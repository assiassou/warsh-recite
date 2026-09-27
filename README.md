# ترتيل ورش — Warsh Recitation Checker

A mobile web app (installable PWA) to practice Quran recitation in
**Warsh 'an Nafi'**: pick a Thumn, recite it aloud, and see your mistakes
on a Mushaf-style page — the idea of Tarteel, but for Warsh, organized by
Hizb → Thumn the way Warsh reciters practice.

> **Start here if you're picking this project up:** read
> [HANDOVER.md](HANDOVER.md) — current status, how everything fits
> together, and the next steps.

## What it does today

- **Navigation:** 60 Hizbs → 8 Thumns each (480 Thumns, boundaries checked
  against a printed Warsh reference; 5 Thumns start mid-ayah, exactly where
  the Mushaf marks them).
- **Mushaf page:** Warsh text in the King Fahd Complex Warsh font, surah
  headers, Basmala at each surah start (not for Al-Fatiha, where it is ayah 1,
  nor At-Tawba), ayah markers.
- **Recitation check:** tap the green mic, recite, tap again to stop. Words
  are compared with the Mushaf text. Mistakes turn red; tap one to see what
  kind of mistake it is (letter mistake, different word, missing word, extra
  word) and expected vs heard.
- **Memorization mode** (eye button): words stay hidden until you recite
  them; lines and ayah markers stay visible.
- **Comparison tools** (collapsed at the bottom of the page, for
  development): record a clip and check it with the fine-tuned Whisper model
  running on this laptop.

Speech recognition is the browser's built-in engine (free, live, Chrome on
Android/desktop). It works on **words**, so it can't hear vowel (tashkeel)
or tajweed mistakes — that needs the phoneme model described in HANDOVER.md.

## Running it on this laptop

You need [Node.js](https://nodejs.org) installed.

```bash
npm install
npm run dev
```

Open http://localhost:5173 in Chrome. For the Whisper comparison tool, also
start the model server from the sibling project (see
`../warsh-finetune/README.md`).

**On a phone:** the microphone only works on `https://` sites (or
`localhost`), so a phone can't use the laptop's `http://192.168…` address.
To use it on a phone, deploy it (next section).

## Deploying (so it works on any phone)

It's a static site: `npm run build` produces the `dist/` folder, which any
static host can serve. The simplest option, since you already use Vercel:
vercel.com → Add New → Project → import this GitHub repo → Deploy (Vercel
detects Vite automatically). Then open the URL in Chrome on Android →
menu → **Install app**. It then opens like a normal app and works offline
for reading.

Android app store: see "Publishing on Google Play" in HANDOVER.md.

## Project structure

| Path | What it is |
|---|---|
| `src/App.jsx` | Hizb list → Thumn list → recitation screen |
| `src/components/LiveRecite.jsx` | The recitation screen: mic, live matching, result |
| `src/components/MushafView.jsx` | Draws a Thumn as a Mushaf page |
| `src/components/MistakeSheet.jsx` | The popup when you tap a red word |
| `src/components/ModelTest.jsx` | Comparison tool for the local Whisper model |
| `src/lib/mushaf.js` | Builds the page layout (headers, Basmala, words, markers) |
| `src/lib/arabicMatch.js` | Text normalization, Mushaf-vs-everyday spelling variants, word alignment, mistake classification |
| `src/lib/liveSpeech.js` | Wraps the browser's speech recognition, restarts it after pauses |
| `src/lib/transcribe.js` | Sends audio to the local model server |
| `src/data/thumns.json` | All 480 Thumns with Warsh text (built by `scripts/build-thumns.mjs`) |
| `scripts/thumn-boundaries-manual.json` | Thumn start/end ayahs, transcribed from the reference PDF |
| `scripts/verse-splits.json` | The 5 Thumns that start mid-ayah |
| `public/fonts/warsh.10.woff2` | KFGQPC Warsh font |

## Rebuilding thumns.json

Only needed if you change Thumn boundaries. Download the raw Warsh text,
then run the build:

```bash
curl -L -o src/data/warsh-quran-raw.json https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranwarsh.json
node scripts/build-thumns.mjs
```

## Data and licenses

- Warsh text: King Fahd Glorious Quran Printing Complex (KFGQPC) text, via
  [fawazahmed0/quran-api](https://github.com/fawazahmed0/quran-api)
  (edition `ara-quranwarsh`).
- Font: KFGQPC Warsh font v10, via
  [thetruetruth/quran-data-kfgqpc](https://github.com/thetruetruth/quran-data-kfgqpc).
  KFGQPC distributes its fonts for free use; check their terms on
  fonts.qurancomplex.gov.sa before publishing commercially.
