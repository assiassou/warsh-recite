import { useRef, useState } from 'react';
import { checkRecitation, toAlignment } from '../lib/checkPrecise.js';

const STATUS = { IDLE: 'idle', RECORDING: 'recording', CHECKING: 'checking', ERROR: 'error' };

// Records the recitation and checks it letter by letter with the syllable
// model; the result is shown on the Mushaf page above (via onResult).
export default function PreciseCheck({ verses, refWords, onResult }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [errorMessage, setErrorMessage] = useState('');
  const [modelName, setModelName] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function start() {
    setErrorMessage('');
    onResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setStatus(STATUS.CHECKING);
        try {
          const data = await checkRecitation(new Blob(chunksRef.current, { type: 'audio/webm' }), verses);
          setModelName(data.model);
          onResult(toAlignment(data.words, verses, refWords));
          setStatus(STATUS.IDLE);
        } catch (err) {
          setErrorMessage(
            err.message?.includes('fetch')
              ? 'تعذر الاتصال بخادم النموذج المحلي. تأكد من تشغيل server.py على المنفذ 8788.'
              : err.message || 'حدث خطأ.',
          );
          setStatus(STATUS.ERROR);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus(STATUS.RECORDING);
    } catch {
      setErrorMessage('تعذر الوصول إلى الميكروفون.');
      setStatus(STATUS.ERROR);
    }
  }

  return (
    <div className="model-test">
      <h3 className="model-test-title">🔎 الفحص الدقيق: الحروف والتشكيل والتجويد (تجريبي)</h3>
      {status === STATUS.RECORDING ? (
        <button className="btn btn-stop" onClick={() => recorderRef.current?.stop()}>
          ⏹️ إيقاف والفحص
        </button>
      ) : (
        <button className="btn btn-record" onClick={start} disabled={status === STATUS.CHECKING}>
          {status === STATUS.CHECKING ? 'جارٍ الفحص...' : '🎙️ سجّل ثم افحص'}
        </button>
      )}
      {modelName ? (
        <p className="result-hint">
          {modelName === 'warsh' ? 'النموذج: المدرّب على ورش.' : 'النموذج: نموذج حفص الأصلي (قبل التدريب على ورش) — توقّع أخطاء زائفة في مواضع الخلاف.'}
        </p>
      ) : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </div>
  );
}
