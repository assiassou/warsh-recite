import { useEffect, useRef, useState } from 'react';
import { createLiveSpeech, isLiveSpeechSupported } from '../lib/liveSpeech.js';
import { alignWords, wordsWithAyah, currentAyahFromAlignment, ayahEndIndices } from '../lib/arabicMatch.js';
import ModelTest from './ModelTest.jsx';
import HafsModelTest from './HafsModelTest.jsx';

const STATUS = { IDLE: 'idle', LISTENING: 'listening', DONE: 'done' };

export default function LiveRecite({ thumn, onBack }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [liveMatched, setLiveMatched] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [currentAyah, setCurrentAyah] = useState(null);
  const [result, setResult] = useState(null);
  const [showReference, setShowReference] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const speechRef = useRef(null);
  const supported = isLiveSpeechSupported();
  const refWords = wordsWithAyah(thumn);

  useEffect(() => {
    return () => speechRef.current?.stop();
  }, []);

  function start() {
    setResult(null);
    setErrorMessage('');
    setCurrentAyah(null);
    setLiveMatched([]);
    setInterimText('');
    speechRef.current = createLiveSpeech({
      onUpdate: (update) => {
        setInterimText(update.interimText);
        if (update.finalText.trim()) {
          const { alignment } = alignWords(refWords, update.finalText);
          let lastMatched = -1;
          alignment.forEach((item, i) => {
            if (item.type === 'correct' || item.type === 'substituted') lastMatched = i;
          });
          const matched = alignment.slice(0, lastMatched + 1);
          setLiveMatched(matched);
          setCurrentAyah(currentAyahFromAlignment(alignment));
        }
      },
      onError: (err) => setErrorMessage(`خطأ في التعرف على الصوت: ${err}`),
    });
    speechRef.current.start();
    setStatus(STATUS.LISTENING);
  }

  function stop() {
    const finalText = speechRef.current?.stop() ?? '';
    setResult(alignWords(refWords, finalText));
    setStatus(STATUS.DONE);
  }

  const liveAyahEnds = ayahEndIndices(liveMatched);
  const resultAyahEnds = result ? ayahEndIndices(result.alignment) : null;

  return (
    <div className="live-recite">
      <div className="live-recite-toolbar">
        <button className="back-btn-inline" onClick={onBack}>
          → الرجوع
        </button>
        <label className="toggle-reference">
          <input
            type="checkbox"
            checked={showReference}
            onChange={(e) => setShowReference(e.target.checked)}
          />
          إظهار النص
        </label>
      </div>

      {showReference ? (
        <p className="reference-text">
          {thumn.verses.map((v, i) => (
            <span key={`${v.surah}:${v.verse}:${i}`}>
              {v.text}
              {v.ayahEnds !== false ? <span className="verse-marker"> ﴿{v.verse}﴾</span> : null}{' '}
            </span>
          ))}
        </p>
      ) : null}

      {!supported ? (
        <p className="error-text">
          متصفحك لا يدعم التعرف الفوري على الصوت. جرّب متصفح Chrome على أندرويد.
        </p>
      ) : (
        <>
          {status !== STATUS.LISTENING ? (
            <button className="btn btn-record btn-big" onClick={start}>
              🎙️ ابدأ التلاوة
            </button>
          ) : (
            <button className="btn btn-stop btn-big" onClick={stop}>
              ⏹️ إنهاء
            </button>
          )}

          {status === STATUS.LISTENING ? (
            <>
              {currentAyah ? (
                <p className="current-ayah">الآية الحالية: ﴿{currentAyah.verse}﴾</p>
              ) : null}
              <div className="live-transcript" aria-live="polite">
                {liveMatched.map((item, i) => (
                  <span key={i}>
                    {item.word}
                    {liveAyahEnds.has(i) ? <span className="verse-marker"> ﴿{item.verse}﴾</span> : null}{' '}
                  </span>
                ))}
                <span className="interim">{interimText}</span>
              </div>
            </>
          ) : null}
        </>
      )}

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      {result ? (
        <div className="result">
          <p className="result-summary">
            {result.mistakes === 0
              ? '✅ أحسنت! لا أخطاء ظاهرة.'
              : `تم رصد ${result.mistakes} اختلاف عن ${result.wordCount} كلمة`}
          </p>
          <p className="result-words">
            {result.alignment.map((item, i) => (
              <span key={i} className={`word word-${item.type}`}>
                {item.word}
                {resultAyahEnds.has(i) ? <span className="verse-marker"> ﴿{item.verse}﴾</span> : null}
                {' '}
              </span>
            ))}
          </p>
          <p className="result-hint">
            الكلمات الملوّنة تحتاج مراجعة. هذا تدقيق أولي بالذكاء الاصطناعي وقد لا يكون دقيقًا دائمًا.
          </p>
        </div>
      ) : null}

      <ModelTest refWords={refWords} />
      <HafsModelTest />
    </div>
  );
}
