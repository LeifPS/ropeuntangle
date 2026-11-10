// Prüft: feste Level sind lösbar (Breitensuche), erzeugte Level sind nicht schon gelöst und haben ein gültiges Layout.
import { kreuzungen, reichtBis } from '../src/logic.js';
import { FEST, levelFuer } from '../src/levels.js';

function loesbar(lv, grenze = 400000) {
  const { cols, rows } = lv, n = cols * rows;
  const enden = []; // bewegliche Enden: [seil, 'a'|'b']
  lv.ropes.forEach((r, i) => { if (!r.ank) enden.push([i, 'a']); enden.push([i, 'b']); });
  const start = lv.ropes.map(r => ({ a: r.a, b: r.b }));
  const key = s => s.map(r => r.a + ',' + r.b).join(';');
  const seen = new Set([key(start)]);
  let front = [[start, 0]], qi = 0;
  while (qi < front.length && seen.size < grenze) {
    const [s, d] = front[qi++];
    if (kreuzungen(cols, s).length === 0) return d;
    const bel = new Uint8Array(n); s.forEach(r => { bel[r.a] = 1; bel[r.b] = 1; });
    for (const [i, e] of enden) for (let t = 0; t < n; t++) {
      if (bel[t]) continue;
      const nxt = s.map(r => ({ a: r.a, b: r.b })); nxt[i][e] = t;
      const k = key(nxt); if (seen.has(k)) continue; seen.add(k); front.push([nxt, d + 1]);
    }
  }
  return -1;
}

let fehler = 0;
FEST.forEach((f, i) => {
  const lv = levelFuer(i + 1);
  const bel = new Set(); let doppelt = false;
  lv.ropes.forEach(r => { if (bel.has(r.a) || bel.has(r.b) || r.a === r.b) doppelt = true; bel.add(r.a); bel.add(r.b); });
  const k0 = kreuzungen(lv.cols, lv.ropes).length;
  let d;
  if (f.loes) { const ok = kreuzungen(lv.cols, f.loes).length === 0 && f.loes.every((r, k) => !lv.ropes[k].ank || r.a === lv.ropes[k].a); d = ok ? 'bekannte Lösung' : -1; } else d = loesbar(lv);
  console.log(`fest ${i + 1}: ${lv.cols}x${lv.rows}, ${lv.ropes.length} Seile, Kreuzungen ${k0}, min. Züge ${d}${doppelt ? ' DOPPELT BELEGT' : ''}`);
  if (d < 1 || doppelt || k0 < 1) fehler++;
});

for (let n = 6; n <= 80; n++) {
  const t0 = Date.now();
  const lv = levelFuer(n);
  const k = kreuzungen(lv.cols, lv.ropes).length;
  const kl = kreuzungen(lv.cols, lv.loes).length;
  const bel = new Set(); let doppelt = false;
  lv.ropes.forEach(r => { if (bel.has(r.a) || bel.has(r.b)) doppelt = true; bel.add(r.a); bel.add(r.b); });
  const anker = lv.ropes.filter(r => r.ank).length, kurzN = lv.ropes.filter(r => r.max).length;
  const ankerOk = lv.ropes.every((r, i) => !r.ank || r.a === lv.loes[i].a);
  // Längen und Sperrfelder: Start und Lösung müssen gültig sein, Lösung darf keine Sperrfelder belegen
  const laengenOk = lv.ropes.every((r, i) => reichtBis(lv.cols, r, 'a', r.a) && reichtBis(lv.cols, { ...r, a: lv.loes[i].a, b: lv.loes[i].b }, 'a', lv.loes[i].a));
  const sperrOk = lv.sperr.every(s => !lv.ropes.some(r => r.a === s || r.b === s));
  if (k < 1 || kl !== 0 || doppelt || !ankerOk || !laengenOk || !sperrOk || lv.cols * lv.rows < lv.ropes.length * 2 + 2) { fehler++; console.log('FEHLER bei Level', n, { k, kl, doppelt, ankerOk }); }
  if (n % 6 === 0 || n < 12) console.log(`level ${n}: ${lv.cols}x${lv.rows}, ${lv.ropes.length} Seile, ${anker} Anker, ${kurzN} kurze Seile, ${lv.sperr.length} Sperrfelder, ${k} Kreuzungen, ${Date.now() - t0} ms`);
}
console.log(fehler ? 'FEHLER: ' + fehler : 'alles ok');
process.exit(fehler ? 1 : 0);
