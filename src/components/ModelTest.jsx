import { useRef, useState } from 'react';
import { transcribeAudio } from '../lib/transcribe.js';
import { alignWords, ayahEndIndices, trimUnrecitedTail } from '../lib/arabicMatch.js';

const STATUS = { IDLE: 'idle', RECORDING: 'recording', RECORDED: 'recorded', CHECKING: 'checking', DONE: 'done', ERROR: 'error' };

// Records a full clip and sends it to the local fine-tuned Whisper model
// server for a one-shot transcription -- separate from the live Web Speech
// path above, so the two can be compared directly on the same Thumn.
export default function ModelTest({ refWords }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [audioUrl, setAudioUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    setErrorMessage('');
    setResult(null);
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
      setErrorMessage('تعذر الوصول إلى الميكروفون.');
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

  async function checkWithModel() {
    setStatus(STATUS.CHECKING);
    setErrorMessage('');
    try {
      const blob = await fetch(audioUrl).then((r) => r.blob());
      const spokenText = await transcribeAudio(blob);
      setResult({ spokenText, ...trimUnrecitedTail(alignWords(refWords, spokenText)) });
      setStatus(STATUS.DONE);
    } catch (err) {
      setErrorMessage(
        err.message?.includes('fetch')
          ? 'تعذر الاتصال بخادم النموذج المحلي. تأكد من تشغيل server.py على المنفذ 8788.'
          : err.message || 'حدث خطأ.',
      );
      setStatus(STATUS.ERROR);
    }
  }

  const ayahEnds = result ? ayahEndIndices(result.alignment) : null;

  return (
    <div className="model-test">
      <h3 className="model-test-title">🔬 اختبار النموذج المُدرّب</h3>

      {status === STATUS.IDLE || status === STATUS.ERROR ? (
        <button className="btn btn-record" onClick={startRecording}>
          🎙️ سجّل الثمن كاملاً
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
              <button className="btn btn-primary" onClick={checkWithModel} disabled={status === STATUS.CHECKING}>
                {status === STATUS.CHECKING ? 'جارٍ التحليل...' : 'تحقق بالنموذج'}
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
                {item.word}
                {ayahEnds.has(i) ? <span className="verse-marker"> ﴿{item.verse}﴾</span> : null}{' '}
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </div>
  );
}
