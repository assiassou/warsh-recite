# Warsh Recite — Project Handover

*Last updated: 27 September 2026.* This is the "start here" document for the
whole project. It covers both folders, what works, what we learned, and the
exact next steps. If you continue with an AI assistant or a developer, ask
them to read this file first.

---

## 1. The goal

A Tarteel-like Android app for **Warsh 'an Nafi'**: the user recites a Thumn,
and the app shows their mistakes on a Mushaf page — not only wrong words, but
eventually **letter, vowel (tashkeel) and tajweed mistakes** (e.g. "amrona"
instead of أَمْرِنَا must be caught), because every letter matters. No
existing app does this for Warsh.

## 2. Where everything is

| What | Where | In git? |
|---|---|---|
| The app | `C:\Users\Admin\Documents\warsh-recite` | yes |
| AI / model work | `C:\Users\Admin\Documents\warsh-finetune` | yes |
| Fine-tuned Whisper model (926 MB) | `warsh-finetune\model\` | **no — back it up** (Google Drive) |
| Reciter audio, 3 reciters (~5 GB) | `warsh-finetune\data\audio\` | no — re-downloadable with `scripts/download_audio.py` |
| Your test recordings | `warsh-finetune\data\eval\` | **no — back them up** |
| Speechmatics API key | `warsh-finetune\.env` | no (on purpose; you can delete the key in your Speechmatics account) |

Both folders are git repositories (saved history of every change). Pushing
them to GitHub (private) gives you an online backup — see section 8.

## 3. Running it on the laptop

Two terminals:

```bash
cd C:\Users\Admin\Documents\warsh-recite
npm install        # first time only
npm run dev        # then open http://localhost:5173 in Chrome
```

```bash
cd C:\Users\Admin\Documents\warsh-finetune
pip install -r requirements.txt   # first time only
python server.py                  # only needed for the "comparison tools" section
```

The server takes ~20–40 seconds to load the model before it answers.

## 4. What works today

- Hizb → Thumn navigation (480 Thumns, checked against the reference PDF).
- Mushaf-style page: Warsh font (King Fahd Complex), surah headers, Basmala at
  surah starts, ayah markers.
- Live recitation check with the browser's speech recognition (Chrome only):
  red words, tap a red word → popup with the kind of mistake (letter mistake,
  different word, missing word, extra word), expected vs heard.
- Memorization mode (words hidden until recited).
- Results appear **per ayah**: an ayah's words and mistakes are shown once
  its last word is said; the ayah in progress is highlighted.
- **Stopping and restarting is not a mistake** (waqf and ibtida', stutters,
  repeating an ayah several times to memorize it, restarting after a
  stumble): the matcher allows jumping back, and the **last attempt at each
  word counts**.
- The Basmala at a surah start is optional: reciting it or not is never a
  mistake. Starting partway into a Thumn only checks from where you started.
- **Live check limits, handled (29 Sep):** Google's speech engine joins words
  (وبالاخرتهم), splits them (نست عين), spells the opening letters (الف لام ميم)
  or garbles them (الملام), and writes the **Hafs** form of a word even when
  Warsh was recited (مالك for ملك). The matcher accepts joins/splits and the
  letter names, never judges the opening letters, and shows a Hafs form in
  **amber** ("تحقّق: قراءة حفص؟", not a mistake). The list of 329 words where
  the readings differ is `src/data/hafs-variants.json`
  (`scripts/build-hafs-variants.mjs`). Consequence: at the word level the app
  cannot confirm Warsh-vs-Hafs words either way — only the precise check can.
- Matcher tests: `npm test` (20 scenarios — run it after any change to
  `src/lib/arabicMatch.js`).

**What it can't do yet:** vowel (tashkeel) and tajweed mistakes, and madd
lengths. The browser's speech recognition only outputs words without vowels,
so these mistakes are invisible to it. That's what the plan in section 6 is
for.

## 5. What we learned (don't repeat these experiments)

1. **Most "correct words marked red" were our bugs, now fixed.** The Mushaf's
   Uthmani spelling differs from everyday spelling (what speech recognition
   writes) in **10.2% of all words**: العٰلمين/العالمين, ءامنوا/آمنوا,
   الصلوٰة/الصلاة, يٰٓأيها/يا أيها. Plus the Warsh final ya (ے in فِے,
   الذِے) was being deleted — ~3,000 places. Now each word accepts its
   everyday spellings; the remaining 0.5% are mostly real Warsh/Hafs reading
   differences (تدعون/يدعون, نشرا/بشرا), which *should* be flagged.
2. **Word-transcription models can't reach the goal.** Whisper (even
   fine-tuned on 6,236 Warsh ayahs: ~75% word accuracy, and it invents extra
   ayahs at the end) and Speechmatics (paid; dropped words, repeated phrases)
   both turn sound into dictionary words, which throws away the vowels and
   tajweed you need to check. Kept only as comparison tools.
3. **The right approach is verification, not transcription.** Because we
   always know which Thumn is being recited, the question is "does this audio
   match this expected sound sequence, and where not?" — at the level of
   syllables (letter + vowel).
4. **The pieces exist:**
   - [quranic-phonemizer](https://github.com/QUD-Technologies/quranic-phonemizer)
     (free, MIT) turns Warsh text into the expected pronunciation with tajweed
     rules applied (naql, ibdal, silat mim, …). Tested: correct on our ayahs.
   - A syllable-level recognition model
     (`IbrahimSalah/Wav2vecLarge_quran_syllables_recognition`) hears vowels
     well (it heard مِنَ امْرِنَا with the correct kasra), **but** it was
     trained on Hafs: it "hears" hamzas where Warsh has none (يومنون, naql),
     and would wrongly flag correct Warsh. It needs one round of training on
     Warsh audio. Evidence: `warsh-finetune/scripts/explore_syllables.py`.
5. **Warsh has permitted variants.** Madd al-badal can be 2, 4 or 6 counts
   (you recite 4; your teacher and most students 6). The checker must accept
   the user's chosen length (a setting) and check consistency, not force one
   length. Badal length also decides taqlil (e.g. 4 counts → taqlil).
6. **Madd length is the hardest to check** (a "count" depends on the
   reciter's pace), so it comes after letters and vowels work.

## 6. The plan — next steps

| # | Step | Who | Estimate |
|---|---|---|---|
| 1 | Record the test set (below) into `warsh-finetune\data\eval\` | **you** | 1 hour |
| 2 | Converter: phonemizer output → the syllable model's format, for every ayah (maps our verse numbers to the phonemizer's by text) | developer/AI | ½–1 day |
| 3 | Train the syllable model on Warsh audio (3 reciters we already have; labels generated automatically by step 2) on Google Colab | developer/AI + you clicking Run | 1–2 days |
| 4 | Test on your recordings: are your deliberate mistakes caught, and are your correct ayahs left alone? | both | ½ day |
| 5 | If yes: a "check this ayah" server endpoint + show tashkeel/tajweed mistakes in the popup (the popup already supports new mistake kinds) | developer/AI | 2–3 days |
| 6 | Madd length checking, with the user's badal setting | developer/AI | later |

**Step 1 done (28 Sep 2026)** — recordings in `warsh-finetune\data\eval\correct\`
and `…\incorrect\` (plus three 18:10 variants with stops/repetition).
**Baseline, current Hafs syllable model** (`python scripts/transcribe_eval.py`,
compared by eye): **7 of 10 deliberate mistakes caught** (1:7 أنعمتُ, 2:4 naql,
2:5 skipped word, 2:7 قلوبكم, 2:8 dropped بـ, 2:9 يخدعون, 18:10 amrona);
**missed** 1:4 مالك, 2:3 hamza, 2:6 silat mim. On the correct recordings it
wrongly hears hamzas Warsh drops (يومنون, بمومنين, missed naql in 18:10),
doesn't recognize silat mim, and makes a few random slips. Most failures share
one cause — Hafs training — which step 3 targets. Stopping and repeating
(waqf/ibtida') is now handled by the app's matcher; the syllable checker in
step 5 must do the same.

**Step 2 done (28 Sep 2026)** — expected Warsh syllables for all 6,236 ayahs
(`warsh-finetune/data/expected/`), every word tied to its pronunciation and the
tajweed rules behind it (0 mismatches between the two text copies). Scripts:
`cache_phonemes.py` (runs the phonemizer per ayah, ~15 min, cached in
`data/phonemes/`), `warsh_syllables.py` (phonemes → the model's syllable
alphabet). **Automatic scoring** on your recordings: `python scripts/score_eval.py`.
Baseline, Hafs syllable model: **5 of 10 mistakes really caught** (flagged in
the mistake recording but not in the correct one), **27% of words in correct
recordings wrongly flagged** — too many for real users; that's step 3's target.

Things found on the way: the three reciters' files are **numbered
differently** — Ibrahim Al-Dosary by Hafs count; Yassin Al-Jazaery by Hafs count
with the Basmala at the start of each surah; Abdul Basit by **Warsh** count
(his "2:1" is الم … هدى للمتقين). The old `data/manifest_abdul_basit.jsonl`
(Whisper era) pairs his audio with the wrong text — don't use it;
`make_training_labels.py` handles all three correctly.

**Step 3 — ready to run (you):** open `warsh-finetune/warsh_syllables_colab.ipynb`
in Google Colab (File → Upload notebook), set Runtime → T4 GPU, and run the
cells top to bottom. It asks you to connect Google Drive (~2.5 GB free space)
and to upload `warsh-finetune/data/expected/training_labels.jsonl` (18,655
reciter recordings with their Warsh syllables; your 10 test ayahs are held out).
~15 min download, then ~3–4 h training; the model so far is saved to Drive
every ~15 min, so a disconnect loses nothing (just run the cells again). The
training code was tested on the laptop first (`python scripts/syllable_training.py --smoke`).
When it's done, download `warsh-syllable-model.zip` from Drive, unzip it into
`warsh-finetune/models/warsh-syllable-model`, and run
`python scripts/score_eval.py models/warsh-syllable-model` (step 4).

**Steps 3 and 4 done (29 Sep 2026).** You trained the model on Colab; it's in
`warsh-finetune/models/warsh-syllable-model` (not in git — the copy in your
Google Drive folder `warsh-syllables` is the backup). Results on your
recordings (`python scripts/score_eval.py models/warsh-syllable-model`):

| | Mistakes really caught | False alarms on correct recitation |
|---|---|---|
| Hafs model (before) | 5 / 10 | 27% of words |
| Warsh-trained | 6 / 10 | 17% |
| Warsh-trained + lenient checker | **7 / 10** | **13%** |

The training fixed the Hafs habits (no more phantom hamza in يومنون/بمومنين,
naql and silat mim now heard). What's left is mostly vowel length and a few
consonants (e.g. the hidden nun in ءَآنذَرْتَهُمُو). The checker now ignores
where syllables are cut, and treats length-only differences as **uncertain**
(amber "تحقّق من طول الحركة" in the app, not counted as a mistake) — the model
isn't reliable at length yet. Still missed: مالك/ملك (length again), and
naql/hamza mistakes where the model hears the Warsh form either way. Ideas to
improve further: more varied voices in training (women, learners), a second
epoch, and measuring madd length from timing instead of from syllables.

**Step 5 — working prototype (28 Sep 2026).** In the app, open a Thumn →
"أدوات المقارنة" at the bottom → **الفحص الدقيق** → record → the result is
shown on the Mushaf page; tapping a red word says whether it's a **tashkeel**,
**letter**, **tajweed** (with the rule's name, e.g. نقل، إبدال الهمزة، صلة ميم
الجمع), missing-word or extra-sound mistake, with the correct pronunciation vs
what was heard, in syllables. On your recordings it labels all 9 mistakes it
hears with the right kind. Needs `python server.py` running (warsh-finetune;
endpoint `/check`, logic in `checker.py`, shared with `score_eval.py`). It uses
the Warsh-trained model automatically once `models/warsh-syllable-model`
exists; until then the Hafs model (expect its false alarms). ~15–35 s per
check on this laptop's CPU. Still to do for real use: checking each ayah as
you pause (instead of recording then checking), and hosting the checker on a
server so phones can use it.

**Test set (step 1):** 10 ayahs, each recorded twice — once correct, once
with the mistake below. Normal pace, one file per recording, named like
`002-017-correct.m4a` / `002-017-mistake.m4a`, plus a notes file listing
each mistake. Recording on the laptop with Windows **Sound Recorder** is
easiest. Optional extra: 2–3 correct ayahs again at a fast pace
(`002-008-correct-fast.m4a`).

| File | Ayah | Mistake to make | Tests |
|---|---|---|---|
| `001-004` | مَلِكِ يَوْمِ الدِّينِ | say مَالِكِ | Hafs slip |
| `001-007` | صِرَاطَ الذِينَ أَنْعَمْتَ… | say أَنْعَمْتُ | wrong vowel |
| `002-003` | الذِينَ يُومِنُونَ… | say يُؤْمِنُونَ with a hamza | ibdal |
| `002-004` | …وَبِالَاخِرَةِ هُمْ يُوقِنُونَ | say وَبِالْآخِرَةِ with a clear hamza | naql |
| `002-005` | أُولَئِكَ عَلَى هُدًى… | skip the second وَأُولَئِكَ | missing word |
| `002-006` | …عَلَيْهِمُۥٓ ءَآنذَرْتَهُمُۥٓ… | say عَلَيْهِمْ (no silat mim) | silat mim |
| `002-007` | خَتَمَ اللَّهُ عَلَى قُلُوبِهِمْ… | say قُلُوبِكُمْ | wrong letter |
| `002-008` | …وَبِالْيَوْمِ الَاخِرِ… | say وَالْيَوْمِ | missing letter |
| `002-009` | …وَمَا يُخَادِعُونَ… | second one as يَخْدَعُونَ | Hafs word |
| `018-010` | …مِنَ امْرِنَا رَشَدًا | say amrona | your example |

## 7. Getting it on phones

**Now (free):** deploy the app as a website on Vercel (you already use it for
AudioMaktube): vercel.com → Add New → Project → import the `warsh-recite`
GitHub repo → Deploy. Open the link in Chrome on Android → menu → **Install
app**. It then behaves like an installed app. (The microphone needs
`https://`, which is why the phone can't use the laptop's local address.)

**Google Play (later):** the usual way to publish a web app like this is a
"Trusted Web Activity": [pwabuilder.com](https://www.pwabuilder.com) → paste
the Vercel link → Package for stores → Android. It produces the file Google
Play needs. You need a Google Play developer account ($25 one-time), PNG app
icons (512×512), and a privacy policy page (the app uses the microphone).
Speech recognition keeps working because the app runs inside Chrome.

**Cost note for later:** the letter-level checker (steps 3–5) runs an AI
model, which needs a server. Options: Hugging Face Spaces (free tier, slow),
or a small paid server. Decide when step 4 shows it works.

## 8. Things only you can do

- Record the test set (step 1).
- Back up `warsh-finetune\model\` and `warsh-finetune\data\eval\` (e.g. copy to
  Google Drive).
- Create two **private** GitHub repos (`warsh-recite`, `warsh-finetune`) so
  the code has an online backup, then push:
  ```bash
  cd C:\Users\Admin\Documents\warsh-recite
  git remote add origin https://github.com/assiassou/warsh-recite.git
  git push -u origin master
  ```
  (same for `warsh-finetune`).
- Vercel project, Google Play account, and anything involving accounts or
  payment.

## 9. Warnings (learned the hard way)

- **Google Colab deletes everything when the session ends** — always download
  the trained model before closing the tab or stepping away. (We lost a full
  training run this way once.)
- **Never put API keys in code files** — use `.env` (already ignored by git).
- In the Colab notebook, don't use `datasets.map()` for audio processing — it
  crashed repeatedly in Colab; the notebook uses a plain loop instead.
- The notebook is generated by `warsh-finetune/scripts/make_notebook.py` —
  edit that script, not the notebook.
