// Loaded lazily (it's ~1.4MB) so first paint on slow phones stays fast.
let thumnsPromise = null;

export function loadThumns() {
  if (!thumnsPromise) {
    thumnsPromise = import('../data/thumns.json').then((m) => (m.default ?? m).thumns);
  }
  return thumnsPromise;
}

export function thumnText(thumn) {
  return thumn.verses.map((v) => v.text).join(' ');
}

export function groupByJuz(thumns) {
  const juzMap = new Map();
  for (const t of thumns) {
    if (!juzMap.has(t.juz)) juzMap.set(t.juz, []);
    juzMap.get(t.juz).push(t);
  }
  return [...juzMap.entries()].map(([juz, items]) => ({ juz, thumns: items }));
}
