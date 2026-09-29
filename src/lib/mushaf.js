import { refWord } from './arabicMatch.js';
import hafsVariants from '../data/hafs-variants.json' with { type: 'json' };

const BASMALA = 'بِسْمِ اِ۬للَّهِ اِ۬لرَّحْمَٰنِ اِ۬لرَّحِيمِ';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => ARABIC_DIGITS[d]);

// Lays a Thumn out the way a printed Mushaf does: a surah header wherever a
// surah starts, the Basmala under it (except Al-Fatiha, where it is ayah 1,
// and At-Tawba, which has none), words, and an end-of-ayah marker.
//
// Returns `blocks` for rendering and `refWords` for alignment. Both are built
// from the same pass over the same tokens, so every displayed word knows its
// index in the alignment (`refIndex`) -- that's what lets a mistake be shown
// on, and tapped at, the exact word in the Mushaf.
export function buildMushaf(thumn) {
  const blocks = [];
  const refWords = [];
  let paragraph = null;

  // Word position within its ayah (an ayah split across two Thumn fragments
  // keeps counting), to look up the Hafs form of the words that differ.
  const positionInAyah = new Map();

  const addTokens = (text, target, { surah, verse, optional = false }) => {
    const key = `${surah}:${verse}`;
    for (const token of text.split(/\s+/).filter(Boolean)) {
      const ref = refWord(token, { surah, verse, optional });
      if (!ref) {
        target.push({ kind: 'mark', text: token });
        continue;
      }
      const position = positionInAyah.get(key) ?? 0;
      positionInAyah.set(key, position + 1);
      const hafs = hafsVariants[key]?.[position];
      if (hafs) ref.hafs = hafs;
      target.push({ kind: 'word', text: token, refIndex: refWords.length });
      refWords.push(ref);
    }
  };

  for (const v of thumn.verses) {
    if (v.verse === 1) {
      blocks.push({ kind: 'surahHeader', surah: v.surah });
      if (v.surah !== 1 && v.surah !== 9) {
        const basmala = { kind: 'basmala', items: [] };
        addTokens(BASMALA, basmala.items, { surah: v.surah, verse: 0, optional: true });
        blocks.push(basmala);
      }
      paragraph = null;
    }
    if (!paragraph) {
      paragraph = { kind: 'paragraph', items: [] };
      blocks.push(paragraph);
    }
    addTokens(v.text, paragraph.items, v);
    if (v.ayahEnds !== false) paragraph.items.push({ kind: 'ayahEnd', verse: v.verse });
  }

  return { blocks, refWords };
}
