import { classifyMistake } from '../lib/arabicMatch.js';
import { toArabicDigits } from '../lib/mushaf.js';

// Mistake kinds from the letter-level check (warsh-finetune/checker.py).
const PRECISE_KINDS = {
  tashkeel: { title: 'خطأ في التشكيل', detail: 'الحروف صحيحة لكن الحركة أو طولها مختلف.' },
  letter: { title: 'خطأ في الحروف', detail: 'حرف أو أكثر مختلف أو ساقط.' },
  tajweed: { title: 'خطأ في التجويد', detail: 'لم يُطبَّق حكم تجويدي كما في رواية ورش.' },
  missing: { title: 'كلمة ناقصة', detail: 'لم تُقرأ هذه الكلمة.' },
  extra: { title: 'زيادة في النطق', detail: 'نُطق صوت ليس في هذه الكلمة.' },
};

function describe(mistake) {
  if (!mistake.precise) return classifyMistake(mistake);
  const info = PRECISE_KINDS[mistake.kind] ?? PRECISE_KINDS.letter;
  return { kind: mistake.kind, ...info };
}

// Bottom sheet explaining a tapped mistake: what kind it is, what was expected
// and what was heard.
export default function MistakeSheet({ mistake, expectedText, surahNames, onClose }) {
  const info = describe(mistake);
  if (!info) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className={`sheet-title mistake-${info.kind}`}>{info.title}</h2>
        {mistake.rules?.length ? <p className="sheet-rules">{mistake.rules.join('، ')}</p> : null}
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
          {mistake.precise ? (
            <>
              <dt>النطق الصحيح</dt>
              <dd className="sheet-syllables">{mistake.expectedSyllables}</dd>
              <dt>ما سُمع</dt>
              <dd className="sheet-syllables sheet-heard">{mistake.heardSyllables || '—'}</dd>
            </>
          ) : mistake.type !== 'missing' ? (
            <>
              <dt>ما سُمع</dt>
              <dd className="sheet-word sheet-heard">{mistake.spoken ?? mistake.word}</dd>
            </>
          ) : null}
        </dl>

        <p className="sheet-note">
          {mistake.precise
            ? 'فحص تجريبي على مستوى المقاطع الصوتية، وقد يخطئ في السماع أحيانًا.'
            : 'التعرف الحالي يعمل على مستوى الكلمات فقط، وقد يخطئ في السماع أحيانًا. تمييز أخطاء التشكيل والتجويد (كالمد والإمالة والنقل) متاح في «الفحص الدقيق» أسفل الصفحة.'}
        </p>
        <button type="button" className="btn sheet-close" onClick={onClose}>
          حسنًا
        </button>
      </div>
    </div>
  );
}
