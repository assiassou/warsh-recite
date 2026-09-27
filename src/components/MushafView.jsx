import { toArabicDigits } from '../lib/mushaf.js';

const REVEALED = new Set(['correct', 'substituted', 'missing']);
const MISTAKE = new Set(['substituted', 'missing']);

function ExtraWords({ items, onTapMistake }) {
  if (!items?.length) return null;
  return items.map((item, i) => (
    <button key={i} type="button" className="w-extra" onClick={() => onTapMistake(item)} aria-label="كلمة زائدة">
      +
    </button>
  ));
}

function Items({ items, statusByIndex, extrasAfter, onTapMistake }) {
  return items.map((item, i) => {
    if (item.kind === 'ayahEnd') {
      return (
        <span key={i} className="ayah-end">
          {toArabicDigits(item.verse)}
        </span>
      );
    }
    if (item.kind === 'mark') {
      return <span key={i} className="w w-mark">{item.text} </span>;
    }
    const status = statusByIndex.get(item.refIndex);
    const type = status?.type;
    const classes = ['w'];
    if (REVEALED.has(type)) classes.push('w-revealed');
    if (MISTAKE.has(type)) classes.push('w-err');
    const word = MISTAKE.has(type) ? (
      <button type="button" className={classes.join(' ')} data-ref={item.refIndex} onClick={() => onTapMistake(status)}>
        {item.text}
      </button>
    ) : (
      <span className={classes.join(' ')} data-ref={item.refIndex}>
        {item.text}
      </span>
    );
    return (
      <span key={i}>
        {item.refIndex === 0 ? <ExtraWords items={extrasAfter.get(-1)} onTapMistake={onTapMistake} /> : null}
        {word}{' '}
        <ExtraWords items={extrasAfter.get(item.refIndex)} onTapMistake={onTapMistake} />
      </span>
    );
  });
}

// Renders a Thumn laid out like a printed Mushaf page. `statusByIndex` maps a
// reference word index to its alignment entry; words without one are shown
// plain (or hidden, in memorization mode).
export default function MushafView({ blocks, surahNames, statusByIndex, extrasAfter, hidden, onTapMistake }) {
  return (
    <div className={`mushaf${hidden ? ' mushaf-hidden' : ''}`}>
      {blocks.map((block, i) => {
        if (block.kind === 'surahHeader') {
          return (
            <div key={i} className="surah-header">
              <span>{surahNames[block.surah - 1]}</span>
            </div>
          );
        }
        const props = { items: block.items, statusByIndex, extrasAfter, onTapMistake };
        return (
          <p key={i} className={block.kind === 'basmala' ? 'basmala' : 'mushaf-text'}>
            <Items {...props} />
          </p>
        );
      })}
    </div>
  );
}
