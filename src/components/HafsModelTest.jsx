import { useRef, useState } from 'react';
import { transcribeHafsSyllables } from '../lib/transcribeHafs.js';

const STATUS = { IDLE: 'idle', RECORDING: 'recording', RECORDED: 'recorded', CHECKING: 'checking', DONE: 'done', ERROR: 'error' };

// Records a clip and sends it to a Hafs-only syllable-recognition model, for
// research comparison only -- not the Warsh app's real detection path.
// Output is raw syllables (e.g. "بِسْ مِلْ لَاْ ھِرْ") shown as-is, since it
// doesn't map cleanly onto word-level reference text for alignment.
export default function HafsModelTest() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [audioUrl, setAudioUrl] = useState(null);
  const [text, setText] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    setErrorMessage('');
    setText(null);
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
    setText(null);
    setErrorMessage('');
    setStatus(STATUS.IDLE);
  }

  async function checkWithModel() {
    setStatus(STATUS.CHECKING);
    setErrorMessage('');
    try {
      const blob = await fetch(audioUrl).then((r) => r.blob());
      setText(await transcribeHafsSyllables(blob));
      setStatus(STATUS.DONE);
    } catch (err) {
      setErrorMessage(err.message || 'حدث خطأ.');
      setStatus(STATUS.ERROR);
    }
  }

  return (
    <div className="model-test">
      <h3 className="model-test-title">🧪 نموذج حفص للمقاطع الصوتية (للمقارنة فقط)</h3>

      {status === STATUS.IDLE || status === STATUS.ERROR ? (
        <button className="btn btn-record" onClick={startRecording}>
          🎙️ سجّل
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
                {status === STATUS.CHECKING ? 'جارٍ التحليل...' : 'تحقق'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      {text !== null ? (
        <div className="result">
          <p className="result-words">{text}</p>
          <p className="result-hint">
            نموذج مدرّب على حفص فقط (ليس ورش) — النتيجة مقاطع صوتية خام لا تُقارن آليًا بالنص المرجعي.
          </p>
        </div>
      ) : null}
    </div>
  );
}
