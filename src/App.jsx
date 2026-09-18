import { useEffect, useState } from 'react';
import { loadQuran } from './lib/quran.js';
import Recorder from './components/Recorder.jsx';
import './App.css';

export default function App() {
  const [quran, setQuran] = useState(null);
  const [surahNumber, setSurahNumber] = useState(null);
  const [openVerse, setOpenVerse] = useState(null);

  useEffect(() => {
    loadQuran().then(setQuran);
  }, []);

  if (!quran) {
    return (
      <div className="app-loading">
        <p>جارٍ التحميل...</p>
      </div>
    );
  }

  const surah = surahNumber ? quran.chapters.find((c) => c.number === surahNumber) : null;

  return (
    <div className="app" dir="rtl">
      <header className="app-header">
        {surah ? (
          <button className="back-btn" onClick={() => { setSurahNumber(null); setOpenVerse(null); }}>
            → الرجوع
          </button>
        ) : null}
        <h1>{surah ? surah.arabicName : 'ترتيل ورش'}</h1>
      </header>

      <main className="app-main">
        {!surah ? (
          <ul className="surah-list">
            {quran.chapters.map((c) => (
              <li key={c.number}>
                <button className="surah-item" onClick={() => setSurahNumber(c.number)}>
                  <span className="surah-number">{c.number}</span>
                  <span className="surah-name">{c.arabicName}</span>
                  <span className="surah-count">{c.verses.length} آية</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="verse-list">
            {surah.verses.map((text, idx) => {
              const verseNumber = idx + 1;
              const isOpen = openVerse === verseNumber;
              return (
                <li key={verseNumber} className="verse-item">
                  <button
                    className="verse-text"
                    onClick={() => setOpenVerse(isOpen ? null : verseNumber)}
                  >
                    {text} <span className="verse-marker">﴿{verseNumber}﴾</span>
                  </button>
                  {isOpen ? <Recorder key={verseNumber} verseText={text} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
