// Loaded lazily (it's ~1.4MB) so first paint on slow phones stays fast.
let thumnsPromise = null;

export function loadThumns() {
  if (!thumnsPromise) {
    thumnsPromise = import('../data/thumns.json').then((m) => (m.default ?? m).thumns);
  }
  return thumnsPromise;
}

let surahNamesPromise = null;

export function loadSurahNames() {
  if (!surahNamesPromise) {
    surahNamesPromise = import('../data/surah-names.json').then((m) => m.default ?? m);
  }
  return surahNamesPromise;
}

export function groupByHizb(thumns) {
  const hizbMap = new Map();
  for (const t of thumns) {
    if (!hizbMap.has(t.hizb)) hizbMap.set(t.hizb, []);
    hizbMap.get(t.hizb).push(t);
  }
  return [...hizbMap.entries()].map(([hizb, items]) => ({ hizb, thumns: items }));
}
