import { useEffect, useMemo, useRef, useState } from 'react';
import { createLiveSpeech, isLiveSpeechSupported } from '../lib/liveSpeech.js';
import { alignWords, currentAyahFromAlignment, trimUnrecitedTail } from '../lib/arabicMatch.js';
import { buildMushaf, toArabicDigits } from '../lib/mushaf.js';
import MushafView from './MushafView.jsx';
import MistakeSheet from './MistakeSheet.jsx';
import ModelTest from './ModelTest.jsx';

const STATUS = { IDLE: 'idle', LISTENING: 'listening', DONE: 'done' };
const ARABIC_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];
// While listening, the last few words' alignment still changes as more speech
// arrives -- only mark a mistake once the reciter is this many words past it.
const STABLE_LAG = 3;
const HIDDEN_KEY = 'warsh-recite:hidden';

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
    const settled = item.index < stableBefore || item.type === 'correct';
    statusByIndex.set(item.index, settled ? item : { ...item, type: item.type === 'substituted' ? 'correct' : 'pending' });
  }
  return { statusByIndex, extrasAfter };
}

export default function LiveRecite({ thumn, surahNames, onBack }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [liveAlignment, setLiveAlignment] = useState([]);
  const [result, setResult] = useState(null);
  const [hidden, setHidden] = useState(readHiddenPref);
  const [selected, setSelected] = useState(null);
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
  const { statusByIndex, extrasAfter } = useMemo(() => {
    if (result) return toMaps(result.alignment);
    if (listening) return toMaps(liveAlignment, { stableBefore: frontier - STABLE_LAG + 1 });
    return toMaps([]);
  }, [result, listening, liveAlignment, frontier]);

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
        onTapMistake={setSelected}
      />

      {result ? (
        <div className={`result-banner${result.mistakes === 0 ? ' result-banner-ok' : ''}`}>
          {result.wordCount === 0
            ? 'لم يُسمع شيء من هذا الثمن. حاول مرة أخرى.'
            : result.mistakes === 0
              ? `أحسنت! ${toArabicDigits(result.wordCount)} كلمة بلا أخطاء ظاهرة.`
              : `${mistakeCount(result.mistakes)} في ${toArabicDigits(result.wordCount)} كلمة — اضغط على الكلمة الحمراء لمعرفة الخطأ.`}
        </div>
      ) : null}

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <details className="dev-tools">
        <summary>أدوات المقارنة (للتطوير)</summary>
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
