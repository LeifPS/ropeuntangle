import { erzeuge, konfig } from './logic.js';

export const PALETTE = ['#f5b11c', '#2f9cf2', '#55d03c', '#e8322e', '#e046f2', '#6b45ea', '#f58a1f', '#2233d6'];

// Feste Einsteiger-Level von Hand (Pflöcke zeilenweise nummeriert, links oben = 0).
// ank: true = Ende "a" sitzt fest auf einem schwarzen Anker.
export const FEST = [
  // 1: ein Zug genügt
  { cols: 3, rows: 3, ropes: [{ a: 0, b: 8 }, { a: 2, b: 6 }] },
  // 2: drei Seile, alle kreuzen sich
  { cols: 4, rows: 3, ropes: [{ a: 0, b: 7 }, { a: 3, b: 4 }, { a: 1, b: 10 }] },
  // 3: der erste Anker
  { cols: 4, rows: 3, ropes: [{ a: 0, b: 11, ank: true }, { a: 3, b: 8 }, { a: 1, b: 4 }] },
  // 4: vier Seile
  { cols: 4, rows: 4, ropes: [{ a: 0, b: 15 }, { a: 3, b: 12 }, { a: 5, b: 10, ank: true }, { a: 1, b: 14 }] },
  // 5: fünf Seile, zwei Anker (Lösung ist bekannt: vier Züge, siehe loes)
  { cols: 5, rows: 4, ropes: [{ a: 5, b: 8, ank: true }, { a: 0, b: 16 }, { a: 10, b: 9, ank: true }, { a: 15, b: 2 }, { a: 4, b: 11 }],
    loes: [{ a: 5, b: 8 }, { a: 0, b: 3 }, { a: 10, b: 13 }, { a: 15, b: 18 }, { a: 4, b: 14 }] },
];

export const FEST_ANZAHL = FEST.length;
const cache = new Map();

// n = Levelnummer ab 1
export function levelFuer(n) {
  if (cache.has(n)) return cache.get(n);
  let lv;
  if (n <= FEST.length) {
    const f = FEST[n - 1];
    lv = { cols: f.cols, rows: f.rows, ropes: f.ropes.map(r => ({ a: r.a, b: r.b, ank: !!r.ank })), sperr: [], loes: f.loes || null };
  } else {
    lv = erzeuge(konfig(n - FEST.length - 1), n);
  }
  if (cache.size > 40) cache.clear();
  cache.set(n, lv);
  return lv;
}
