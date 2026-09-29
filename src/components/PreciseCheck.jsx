import { useRef, useState } from 'react';
import { checkRecitation, toAlignment } from '../lib/checkPrecise.js';

const STATUS = { IDLE: 'idle', RECORDING: 'recording', CHECKING: 'checking', ERROR: 'error' };

// Records the recitation and checks it letter by letter with the syllable
// model; the result is shown on the Mushaf page (via onResult). Sits in the
// bottom dock next to the live mic.
export default function PreciseCheck({ verses, refWords, disabled, onResult }) {
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
              ? 'تعذر الاتصال بخادم الفحص. تأكد من تشغيل server.py على الحاسوب.'
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

  const recording = status === STATUS.RECORDING;
  const checking = status === STATUS.CHECKING;
  const label = recording ? 'إيقاف والفحص' : checking ? 'جارٍ الفحص…' : 'فحص دقيق';

  return (
    <div className="dock-main dock-precise">
      <button
        type="button"
        className={`mic-btn mic-btn-precise${recording ? ' mic-btn-on' : ''}`}
        onClick={recording ? () => recorderRef.current?.stop() : start}
        disabled={disabled || checking}
        aria-label={label}
        title="تسجيل ثم فحص الحروف والتشكيل والتجويد بالنموذج المدرّب"
      >
        {recording ? '■' : checking ? '…' : '🔎'}
      </button>
      <span className="dock-label">{label}</span>
      {modelName === 'hafs-baseline' ? <span className="dock-warn">نموذج حفص (غير مدرّب على ورش)</span> : null}
      {errorMessage ? <span className="dock-warn">{errorMessage}</span> : null}
    </div>
  );
}
