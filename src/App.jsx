import { useEffect, useState } from 'react';
import { loadThumns, loadSurahNames, groupByHizb } from './lib/quran.js';
import LiveRecite from './components/LiveRecite.jsx';
import './App.css';

const ARABIC_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];

export default function App() {
  const [thumns, setThumns] = useState(null);
  const [surahNames, setSurahNames] = useState(null);
  const [hizbNumber, setHizbNumber] = useState(null);
  const [activeThumn, setActiveThumn] = useState(null);

  useEffect(() => {
    loadThumns().then(setThumns);
    loadSurahNames().then(setSurahNames);
  }, []);

  if (!thumns || !surahNames) {
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

  const hizbGroups = groupByHizb(thumns);
  const currentHizb = hizbNumber ? hizbGroups.find((g) => g.hizb === hizbNumber) : null;

  return (
    <div className="app" dir="rtl">
      <header className="app-header">
        {currentHizb ? (
          <button className="back-btn" onClick={() => setHizbNumber(null)}>
            → الرجوع
          </button>
        ) : null}
        <h1>{currentHizb ? `الحزب ${currentHizb.hizb}` : 'ترتيل ورش'}</h1>
      </header>

      <main className="app-main">
        {!currentHizb ? (
          <ul className="surah-list">
            {hizbGroups.map((g) => {
              const first = g.thumns[0].verses[0];
              return (
                <li key={g.hizb}>
                  <button className="surah-item" onClick={() => setHizbNumber(g.hizb)}>
                    <span className="surah-number">{g.hizb}</span>
                    <span className="surah-name">الحزب {g.hizb}</span>
                    <span className="surah-count">يبدأ من {surahNames[first.surah - 1]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="surah-list">
            {currentHizb.thumns.map((t) => {
              const first = t.verses[0];
              return (
                <li key={t.number}>
                  <button className="surah-item" onClick={() => setActiveThumn(t)}>
                    <span className="surah-number">{t.quarterInHizb}</span>
                    <span className="surah-name">الثمن {ARABIC_ORDINALS[t.quarterInHizb]}</span>
                    <span className="surah-count">
                      {surahNames[first.surah - 1]} ﴿{first.verse}﴾
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
