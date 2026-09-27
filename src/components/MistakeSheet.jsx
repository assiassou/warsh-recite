import { classifyMistake } from '../lib/arabicMatch.js';
import { toArabicDigits } from '../lib/mushaf.js';

// Bottom sheet explaining a tapped mistake: what kind it is, what was expected
// and what was heard.
export default function MistakeSheet({ mistake, expectedText, surahNames, onClose }) {
  const info = classifyMistake(mistake);
  if (!info) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className={`sheet-title mistake-${info.kind}`}>{info.title}</h2>
        {mistake.verse ? (
          <p className="sheet-where">
            {surahNames[mistake.surah - 1]} · الآية {toArabicDigits(mistake.verse)}
          </p>
        ) : null}
        <p className="sheet-detail">{info.detail}</p>

        <dl className="sheet-compare">
          {mistake.type !== 'extra' ? (
            <>
              <dt>الصحيح</dt>
              <dd className="sheet-word">{expectedText}</dd>
            </>
          ) : null}
          {mistake.type !== 'missing' ? (
            <>
              <dt>ما سُمع</dt>
              <dd className="sheet-word sheet-heard">{mistake.spoken ?? mistake.word}</dd>
            </>
          ) : null}
        </dl>

        <p className="sheet-note">
          التعرف الحالي يعمل على مستوى الكلمات فقط، وقد يخطئ في السماع أحيانًا. تمييز أخطاء التشكيل والتجويد
          (كالمد والإمالة والنقل) سيأتي مع نموذج التحقق من النطق.
        </p>
        <button type="button" className="btn sheet-close" onClick={onClose}>
          حسنًا
        </button>
      </div>
    </div>
  );
}
