import { useRef, useState } from 'react';
import { transcribeAudio } from '../lib/transcribe.js';
import { alignWords } from '../lib/arabicMatch.js';

const STATUS = {
  IDLE: 'idle',
  RECORDING: 'recording',
  RECORDED: 'recorded',
  CHECKING: 'checking',
  DONE: 'done',
  ERROR: 'error',
};

export default function Recorder({ verseText }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [audioUrl, setAudioUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        setStatus(STATUS.RECORDED);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus(STATUS.RECORDING);
    } catch {
      setErrorMessage('تعذر الوصول إلى الميكروفون. تأكد من إعطاء الإذن.');
      setStatus(STATUS.ERROR);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function recordAgain() {
    setAudioUrl(null);
    setResult(null);
    setErrorMessage('');
    setStatus(STATUS.IDLE);
  }

  async function checkRecitation() {
    setStatus(STATUS.CHECKING);
    setErrorMessage('');
    try {
      const blob = await fetch(audioUrl).then((r) => r.blob());
      const spokenText = await transcribeAudio(blob);
      const alignment = alignWords(verseText, spokenText);
      setResult({ spokenText, ...alignment });
      setStatus(STATUS.DONE);
    } catch (err) {
      setErrorMessage(err.message || 'حدث خطأ أثناء التحقق.');
      setStatus(STATUS.ERROR);
    }
  }

  return (
    <div className="recorder">
      {status === STATUS.IDLE || status === STATUS.ERROR ? (
        <button className="btn btn-record" onClick={startRecording}>
          🎙️ سجّل التلاوة
        </button>
      ) : null}

      {status === STATUS.RECORDING ? (
        <button className="btn btn-stop" onClick={stopRecording}>
          ⏹️ إيقاف
        </button>
      ) : null}

      {(status === STATUS.RECORDED || status === STATUS.CHECKING || status === STATUS.DONE) && audioUrl ? (
        <div className="recorder-playback">
          <audio src={audioUrl} controls />
          <div className="recorder-actions">
            <button className="btn" onClick={recordAgain}>
              إعادة التسجيل
            </button>
            {status !== STATUS.DONE ? (
              <button className="btn btn-primary" onClick={checkRecitation} disabled={status === STATUS.CHECKING}>
                {status === STATUS.CHECKING ? 'جارٍ التحقق...' : 'تحقق من التلاوة'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

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
                {item.type === 'extra' ? item.word : item.word}
                {' '}
              </span>
            ))}
          </p>
          <p className="result-hint">
            الكلمات باللون الأحمر تحتاج مراجعة. هذا تدقيق أولي بالذكاء الاصطناعي وقد لا يكون دقيقًا دائمًا.
          </p>
        </div>
      ) : null}
    </div>
  );
}
