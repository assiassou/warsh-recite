// Loaded lazily (it's ~1.4MB) so first paint on slow phones stays fast.
let dataPromise = null;

export function loadQuran() {
  if (!dataPromise) {
    dataPromise = import('../data/warsh-quran.json').then((m) => m.default ?? m);
  }
  return dataPromise;
}

export function getSurah(data, number) {
  return data.chapters.find((c) => c.number === number) ?? null;
}
