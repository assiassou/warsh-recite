import { useEffect, useMemo, useRef, useState } from 'react';
import { createLiveSpeech, isLiveSpeechSupported } from '../lib/liveSpeech.js';
import { alignWords, currentAyahFromAlignment, trimUnrecitedTail } from '../lib/arabicMatch.js';
import { buildMushaf, toArabicDigits } from '../lib/mushaf.js';
import MushafView from './MushafView.jsx';
import MistakeSheet from './MistakeSheet.jsx';
import ModelTest from './ModelTest.jsx';
import PreciseCheck from './PreciseCheck.jsx';

const STATUS = { IDLE: 'idle', LISTENING: 'listening', DONE: 'done' };
const ARABIC_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];
const HIDDEN_KEY = 'warsh-recite:hidden';

// For each reference word, the index range of the ayah it belongs to.
function ayahRanges(refWords) {
  const ranges = new Array(refWords.length);
  let start = 0;
  for (let i = 1; i <= refWords.length; i++) {
    const a = refWords[i - 1];
    const b = refWords[i];
    if (!b || b.surah !== a.surah || b.verse !== a.verse) {
      for (let k = start; k < i; k++) ranges[k] = [start, i - 1];
      start = i;
    }
  }
  return ranges;
}

function mistakeCount(n) {
  if (n === 1) return 'خطأ واحد';
  if (n === 2) return 'خطآن';
  return `${toArabicDigits(n)} ${n <= 10 ? 'أخطاء' : 'خطأً'}`;
}

function readHiddenPref() {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function lastSaidIndex(alignment) {
  for (let k = alignment.length - 1; k >= 0; k--) {
    const t = alignment[k].type;
    if (t === 'correct' || t === 'substituted') return alignment[k].index;
  }
  return -1;
}

function toMaps(alignment, { stableBefore = Infinity } = {}) {
  const statusByIndex = new Map();
  const extrasAfter = new Map();
  for (const item of alignment) {
    if (item.type === 'extra') {
      if (item.afterIndex < stableBefore) {
        if (!extrasAfter.has(item.afterIndex)) extrasAfter.set(item.afterIndex, []);
        extrasAfter.get(item.afterIndex).push(item);
      }
      continue;
    }
    if (item.index < stableBefore) statusByIndex.set(item.index, item);
  }
  return { statusByIndex, extrasAfter };
}

export default function LiveRecite({ thumn, surahNames, onBack }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [liveAlignment, setLiveAlignment] = useState([]);
  const [result, setResult] = useState(null);
  const [hidden, setHidden] = useState(readHiddenPref);
  const [selected, setSelected] = useState(null);
  // Result of the letter-level check (PreciseCheck); shown instead of the word-level one while set.
  const [precise, setPrecise] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const speechRef = useRef(null);
  const supported = isLiveSpeechSupported();

  const { blocks, refWords } = useMemo(() => buildMushaf(thumn), [thumn]);
  const displayTextByIndex = useMemo(() => {
    const map = new Map();
    for (const block of blocks) for (const item of block.items ?? []) if (item.kind === 'word') map.set(item.refIndex, item.text);
    return map;
  }, [blocks]);
  const referenceText = thumn.verses.map((v) => v.text).join(' ');

  useEffect(() => () => speechRef.current?.stop(), []);

  function toggleHidden() {
    setHidden((h) => {
      try {
        localStorage.setItem(HIDDEN_KEY, h ? '0' : '1');
      } catch {
        // private mode / storage blocked: the toggle still works for this session
      }
      return !h;
    });
  }

  function start() {
    setResult(null);
    setPrecise(null);
    setSelected(null);
    setErrorMessage('');
    setLiveAlignment([]);
    speechRef.current = createLiveSpeech({
      onUpdate: ({ finalText, interimText }) => {
        const text = `${finalText} ${interimText}`.trim();
        if (text) setLiveAlignment(alignWords(refWords, text).alignment);
      },
      onError: (err) => setErrorMessage(`خطأ في التعرف على الصوت: ${err}`),
    });
    speechRef.current.start();
    setStatus(STATUS.LISTENING);
  }

  function stop() {
    const finalText = speechRef.current?.stop() ?? '';
    setResult(trimUnrecitedTail(alignWords(refWords, finalText)));
    setStatus(STATUS.DONE);
  }

  const listening = status === STATUS.LISTENING;
  const frontier = listening ? lastSaidIndex(liveAlignment) : -1;
  const ranges = useMemo(() => ayahRanges(refWords), [refWords]);
  // While listening, an ayah's result is shown only once its last word has
  // been said; the ayah in progress is just highlighted.
  const activeRange = frontier >= 0 && ranges[frontier][1] !== frontier ? ranges[frontier] : null;
  const settledBefore = frontier < 0 ? 0 : activeRange ? activeRange[0] : frontier + 1;
  const shown = useMemo(
    () =>
      precise
        ? { alignment: precise, mistakes: precise.filter((a) => a.type !== 'correct').length, wordCount: precise.length }
        : result,
    [precise, result],
  );
  const { statusByIndex, extrasAfter } = useMemo(() => {
    if (shown) return toMaps(shown.alignment);
    if (listening) return toMaps(liveAlignment, { stableBefore: settledBefore });
    return toMaps([]);
  }, [shown, listening, liveAlignment, settledBefore]);

  useEffect(() => {
    if (frontier < 0) return;
    const el = document.querySelector(`[data-ref="${frontier}"]`);
    if (!el) return;
    const { top, bottom } = el.getBoundingClientRect();
    if (top < 80 || bottom > window.innerHeight - 140) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [frontier]);

  const currentAyah = listening ? currentAyahFromAlignment(liveAlignment) : null;
  const first = thumn.verses[0];

  return (
    <div className="recite-screen">
      <header className="recite-bar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="الرجوع">
          →
        </button>
        <div className="recite-bar-title">
          <strong>{surahNames[(currentAyah?.surah ?? first.surah) - 1]}</strong>
          <span>
            الحزب {toArabicDigits(thumn.hizb)} · الثمن {ARABIC_ORDINALS[thumn.quarterInHizb]}
            {currentAyah?.verse ? ` · الآية ${toArabicDigits(currentAyah.verse)}` : ''}
          </span>
        </div>
        <button
          type="button"
          className={`icon-btn${hidden ? ' icon-btn-on' : ''}`}
          onClick={toggleHidden}
          aria-pressed={hidden}
          title={hidden ? 'إظهار النص' : 'إخفاء النص (للحفظ)'}
        >
          {hidden ? '◌' : '👁'}
        </button>
      </header>

      <MushafView
        blocks={blocks}
        surahNames={surahNames}
        statusByIndex={statusByIndex}
        extrasAfter={extrasAfter}
        hidden={hidden}
        activeRange={activeRange}
        onTapMistake={setSelected}
      />

      {shown ? (
        <div className={`result-banner${shown.mistakes === 0 ? ' result-banner-ok' : ''}`}>
          {precise ? 'الفحص الدقيق: ' : ''}
          {shown.wordCount === 0
            ? 'لم يُسمع شيء من هذا الثمن. حاول مرة أخرى.'
            : shown.mistakes === 0
              ? `أحسنت! ${toArabicDigits(shown.wordCount)} كلمة بلا أخطاء ظاهرة.`
              : `${mistakeCount(shown.mistakes)} في ${toArabicDigits(shown.wordCount)} كلمة — اضغط على الكلمة الحمراء لمعرفة الخطأ.`}
        </div>
      ) : null}

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <details className="dev-tools">
        <summary>أدوات المقارنة (للتطوير)</summary>
        <PreciseCheck
          verses={thumn.verses}
          refWords={refWords}
          onResult={(alignment) => {
            setSelected(null);
            setPrecise(alignment);
          }}
        />
        <ModelTest refWords={refWords} referenceText={referenceText} />
      </details>

      <div className="recite-dock">
        {!supported ? (
          <p className="dock-note">التعرف الفوري على الصوت يعمل في متصفح Chrome على أندرويد.</p>
        ) : (
          <button
            type="button"
            className={`mic-btn${listening ? ' mic-btn-on' : ''}`}
            onClick={listening ? stop : start}
            aria-label={listening ? 'إنهاء التلاوة' : 'ابدأ التلاوة'}
          >
            {listening ? '■' : '🎙'}
          </button>
        )}
      </div>

      {selected ? (
        <MistakeSheet
          mistake={selected}
          expectedText={displayTextByIndex.get(selected.index)}
          surahNames={surahNames}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
