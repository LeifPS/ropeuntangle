// Prüft die Level-Logik:
// - feste Level sind nach den Spielregeln (Seil nur bewegbar, wenn nichts darauf liegt) lösbar (Tiefensuche)
// - erzeugte Level: nicht schon gelöst, gültiges Layout, Längen/Sperrfelder/Anker stimmen, und die beim Mischen
//   aufgezeichneten Züge lassen sich rückwärts nach denselben Regeln abspielen und führen zur gelösten Lage
import { kreuzungen, reichtBis } from '../src/logic.js';
import { FEST, levelFuer } from '../src/levels.js';

function loesbar(lv, maxTiefe) {
  const { cols, rows } = lv, n = cols * rows, sperr = new Set(lv.sperr || []);
  const start = lv.ropes.map(r => ({ a: r.a, b: r.b, ank: !!r.ank, max: r.max }));
  for (let D = 0; D <= maxTiefe; D++) {
    const gesehen = new Map();
    const dfs = (s, d) => {
      if (kreuzungen(cols, s).length === 0) return true;
      if (d === 0) return false;
      const key = s.map(r => r.a + ',' + r.b).join(';');
      if ((gesehen.get(key) || -1) >= d) return false; gesehen.set(key, d);
      const bel = new Uint8Array(n); s.forEach(r => { bel[r.a] = 1; bel[r.b] = 1; }); sperr.forEach(x => { bel[x] = 1; });
      for (let i = 0; i < s.length; i++) {
        for (const e of (s[i].ank ? ['b'] : ['a', 'b'])) {
          const alt = s[i][e];
          for (let t = 0; t < n; t++) {
            if (bel[t] || !reichtBis(cols, s[i], e, t)) continue;
            s[i][e] = t; const ok = dfs(s, d - 1); s[i][e] = alt;
            if (ok) return true;
          }
        }
      }
      return false;
    };
    if (dfs(start.map(r => ({ ...r })), D)) return D;
  }
  return -1;
}

let fehler = 0;
FEST.forEach((f, i) => {
  const lv = levelFuer(i + 1);
  const bel = new Set(); let doppelt = false;
  lv.ropes.forEach(r => { if (bel.has(r.a) || bel.has(r.b) || r.a === r.b) doppelt = true; bel.add(r.a); bel.add(r.b); });
  const k0 = kreuzungen(lv.cols, lv.ropes).length;
  const d = loesbar(lv, 7);
  console.log(`fest ${i + 1}: ${lv.cols}x${lv.rows}, ${lv.ropes.length} Seile, Kreuzungen ${k0}, min. Züge ${d}${doppelt ? ' DOPPELT BELEGT' : ''}`);
  if (d < 1 || doppelt || k0 < 1) fehler++;
});

for (let n = 6; n <= 120; n++) {
  const t0 = Date.now();
  const lv = levelFuer(n);
  const k = kreuzungen(lv.cols, lv.ropes).length;
  const bel = new Set(); let doppelt = false;
  lv.ropes.forEach(r => { if (bel.has(r.a) || bel.has(r.b)) doppelt = true; bel.add(r.a); bel.add(r.b); });
  const ankerOk = lv.ropes.every((r, i) => !r.ank || r.a === lv.loes[i].a);
  const sperrOk = lv.sperr.every(s => !lv.ropes.some(r => r.a === s || r.b === s) && !lv.loes.some(r => r.a === s || r.b === s));
  const kl = kreuzungen(lv.cols, lv.loes).length;
  // Rückwärts abspielen
  let rueckOk = true;
  const s = lv.ropes.map(r => ({ ...r }));
  for (let i = lv.spur.length - 1; i >= 0; i--) {
    const z = lv.spur[i], r = s[z.k];
    const frei = !s.some((q, j) => j !== z.k && (q.a === z.von || q.b === z.von)) && !(lv.sperr || []).includes(z.von);
    if (!frei || !reichtBis(lv.cols, r, z.ende, z.von)) { rueckOk = false; break; }
    r[z.ende] = z.von;
  }
  const gelöst = kreuzungen(lv.cols, s).length === 0;
  const anker = lv.ropes.filter(r => r.ank).length, kurzN = lv.ropes.filter(r => r.max).length;
  if (k < 1 || kl !== 0 || doppelt || !ankerOk || !sperrOk || !rueckOk || !gelöst || lv.cols * lv.rows < lv.ropes.length * 2 + 2) {
    fehler++; console.log('FEHLER bei Level', n, { k, kl, doppelt, ankerOk, sperrOk, rueckOk, gelöst });
  }
  if (n % 10 === 0 || n < 12) console.log(`level ${n}: ${lv.cols}x${lv.rows}, ${lv.ropes.length} Seile, ${anker} Anker, ${kurzN} kurze, ${lv.sperr.length} Sperrfelder, ${k} Kreuzungen, ${lv.spur.length} Mischzüge, ${Date.now() - t0} ms`);
}
console.log(fehler ? 'FEHLER: ' + fehler : 'alles ok');
process.exit(fehler ? 1 : 0);
