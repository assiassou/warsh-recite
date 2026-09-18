import { useEffect, useState } from 'react';
import { loadThumns, groupByJuz } from './lib/quran.js';
import LiveRecite from './components/LiveRecite.jsx';
import './App.css';

const ARABIC_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];

export default function App() {
  const [thumns, setThumns] = useState(null);
  const [juzNumber, setJuzNumber] = useState(null);
  const [activeThumn, setActiveThumn] = useState(null);

  useEffect(() => {
    loadThumns().then(setThumns);
  }, []);

  if (!thumns) {
    return (
      <div className="app-loading">
        <p>جارٍ التحميل...</p>
      </div>
    );
  }

  if (activeThumn) {
    return (
      <div className="app" dir="rtl">
        <main className="app-main">
          <LiveRecite thumn={activeThumn} onBack={() => setActiveThumn(null)} />
        </main>
      </div>
    );
  }

  const juzGroups = groupByJuz(thumns);
  const currentJuz = juzNumber ? juzGroups.find((g) => g.juz === juzNumber) : null;

  return (
    <div className="app" dir="rtl">
      <header className="app-header">
        {currentJuz ? (
          <button className="back-btn" onClick={() => setJuzNumber(null)}>
            → الرجوع
          </button>
        ) : null}
        <h1>{currentJuz ? `الجزء ${currentJuz.juz}` : 'ترتيل ورش'}</h1>
      </header>

      <main className="app-main">
        {!currentJuz ? (
          <ul className="surah-list">
            {juzGroups.map((g) => {
              const first = g.thumns[0].verses[0];
              return (
                <li key={g.juz}>
                  <button className="surah-item" onClick={() => setJuzNumber(g.juz)}>
                    <span className="surah-number">{g.juz}</span>
                    <span className="surah-name">الجزء {g.juz}</span>
                    <span className="surah-count">يبدأ من {first.surahName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="surah-list">
            {currentJuz.thumns.map((t, i) => {
              const first = t.verses[0];
              return (
                <li key={t.number}>
                  <button className="surah-item" onClick={() => setActiveThumn(t)}>
                    <span className="surah-number">{i + 1}</span>
                    <span className="surah-name">الثمن {ARABIC_ORDINALS[i + 1]}</span>
                    <span className="surah-count">
                      {first.surahName} ﴿{first.verse}﴾
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
