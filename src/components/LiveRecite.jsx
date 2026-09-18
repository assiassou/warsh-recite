import { useEffect, useRef, useState } from 'react';
import { createLiveSpeech, isLiveSpeechSupported } from '../lib/liveSpeech.js';
import { alignWords } from '../lib/arabicMatch.js';
import { thumnText } from '../lib/quran.js';

const STATUS = { IDLE: 'idle', LISTENING: 'listening', DONE: 'done' };

export default function LiveRecite({ thumn, onBack }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [liveText, setLiveText] = useState({ finalText: '', interimText: '' });
  const [result, setResult] = useState(null);
  const [showReference, setShowReference] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const speechRef = useRef(null);
  const supported = isLiveSpeechSupported();
  const reference = thumnText(thumn);

  useEffect(() => {
    return () => speechRef.current?.stop();
  }, []);

  function start() {
    setResult(null);
    setErrorMessage('');
    setLiveText({ finalText: '', interimText: '' });
    speechRef.current = createLiveSpeech({
      onUpdate: setLiveText,
      onError: (err) => setErrorMessage(`خطأ في التعرف على الصوت: ${err}`),
    });
    speechRef.current.start();
    setStatus(STATUS.LISTENING);
  }

  function stop() {
    const finalText = speechRef.current?.stop() ?? '';
    setResult(alignWords(reference, finalText));
    setStatus(STATUS.DONE);
  }

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

      {showReference ? <p className="reference-text">{reference}</p> : null}

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
            <div className="live-transcript" aria-live="polite">
              <span>{liveText.finalText}</span>
              <span className="interim">{liveText.interimText}</span>
            </div>
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
                {item.word}{' '}
              </span>
            ))}
          </p>
          <p className="result-hint">
            الكلمات الملوّنة تحتاج مراجعة. هذا تدقيق أولي بالذكاء الاصطناعي وقد لا يكون دقيقًا دائمًا.
          </p>
        </div>
      ) : null}
    </div>
  );
}
