// Thin wrapper around the browser's built-in live speech recognition
// (Chrome/Android: SpeechRecognition, prefixed as webkitSpeechRecognition).
// Free, runs continuously, and keeps emitting text while the user recites —
// no per-minute API cost, unlike Whisper.
//
// The browser auto-stops recognition after a pause in speech even in
// "continuous" mode, so we transparently restart it until the caller
// explicitly calls stop(), making it feel like one continuous session.

export function isLiveSpeechSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createLiveSpeech({ onUpdate, onError }) {
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let finalText = '';
  let interimText = '';
  let stoppedByUser = false;

  function makeRecognition() {
    const r = new SpeechRecognitionImpl();
    r.lang = 'ar-SA';
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (event) => {
      interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript + ' ';
        } else {
          interimText += transcript;
        }
      }
      onUpdate({ finalText, interimText });
    };

    r.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      onError?.(event.error);
    };

    r.onend = () => {
      if (!stoppedByUser) {
        // browser auto-stopped after a pause; keep the session going
        recognition = makeRecognition();
        recognition.start();
      }
    };

    return r;
  }

  return {
    start() {
      finalText = '';
      interimText = '';
      stoppedByUser = false;
      recognition = makeRecognition();
      recognition.start();
    },
    stop() {
      stoppedByUser = true;
      recognition?.stop();
      return finalText.trim();
    },
  };
}
