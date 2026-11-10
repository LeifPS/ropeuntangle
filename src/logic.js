// Reine Spiellogik (ohne Grafik): Raster, Kreuzungen, Level-Erzeugung.
// Ein Level: { cols, rows, ropes: [{ a, b, ank }] }  (a, b = Pflock-Nummern im Raster, zeilenweise; ank = Ende "a" ist fest auf einem schwarzen Anker)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function orient(ax, ay, bx, by, cx, cy) {
  const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}
function onSeg(ax, ay, bx, by, cx, cy) {
  return Math.min(ax, bx) <= cx && cx <= Math.max(ax, bx) && Math.min(ay, by) <= cy && cy <= Math.max(ay, by);
}
// Exakter Test auf ganzzahligen Koordinaten; Berühren und Überlappen zählt als Kreuzung.
export function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(ax, ay, bx, by, cx, cy)) return true;
  if (o2 === 0 && onSeg(ax, ay, bx, by, dx, dy)) return true;
  if (o3 === 0 && onSeg(cx, cy, dx, dy, ax, ay)) return true;
  if (o4 === 0 && onSeg(cx, cy, dx, dy, bx, by)) return true;
  return false;
}

// Liste aller sich kreuzenden Seilpaare [i, j]
export function kreuzungen(cols, ropes) {
  const out = [];
  for (let i = 0; i < ropes.length; i++) {
    const p = ropes[i], ax = p.a % cols, ay = (p.a / cols) | 0, bx = p.b % cols, by = (p.b / cols) | 0;
    for (let j = i + 1; j < ropes.length; j++) {
      const q = ropes[j];
      if (segHit(ax, ay, bx, by, q.a % cols, (q.a / cols) | 0, q.b % cols, (q.b / cols) | 0)) out.push([i, j]);
    }
  }
  return out;
}
function zaehle(cols, ropes) { return kreuzungen(cols, ropes).length; }

// ---------- Erzeugung ----------
function geloestesLayout(R, cfg) {
  const { cols, rows } = cfg, n = cols * rows, benutzt = new Uint8Array(n), segs = [];
  for (let k = 0; k < cfg.ropes; k++) {
    let ok = false;
    for (let versuch = 0; versuch < 500 && !ok; versuch++) {
      const a = (R() * n) | 0, b = (R() * n) | 0;
      if (a === b || benutzt[a] || benutzt[b]) continue;
      const ax = a % cols, ay = (a / cols) | 0, bx = b % cols, by = (b / cols) | 0;
      const len = Math.hypot(ax - bx, ay - by);
      if (len < 1 || len > cfg.maxLen) continue;
      let frei = true;
      for (const s of segs) if (segHit(ax, ay, bx, by, s.ax, s.ay, s.bx, s.by)) { frei = false; break; }
      if (!frei) continue;
      benutzt[a] = benutzt[b] = 1; segs.push({ a, b, ax, ay, bx, by }); ok = true;
    }
    if (!ok) return null;
  }
  return segs.map(s => ({ a: s.a, b: s.b }));
}

export function erzeuge(cfg, seed) {
  const { cols, rows } = cfg, n = cols * rows;
  for (let runde = 0; runde < 60; runde++) {
    const R = mulberry32(seed * 1009 + runde * 7919 + 17);
    const lay = geloestesLayout(R, cfg);
    if (!lay) continue;
    // Anker: bei einigen Seilen ist Ende a fest
    const idx = lay.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const ropes = lay.map(r => ({ a: r.a, b: r.b, ank: false }));
    for (let i = 0; i < Math.min(cfg.anchors || 0, ropes.length); i++) ropes[idx[i]].ank = true;
    const loes = ropes.map(r => ({ a: r.a, b: r.b }));
    // durcheinanderbringen: zufällige Züge, die Kreuzungen eher mehr werden lassen
    const belegt = new Uint8Array(n);
    for (const r of ropes) { belegt[r.a] = 1; belegt[r.b] = 1; }
    const ziel = Math.max(2, Math.round(ropes.length * (cfg.wirr || 1.2)));
    let jetzt = 0, bewegt = 0;
    for (let it = 0; it < 6000; it++) {
      if (jetzt >= ziel && bewegt >= ropes.length * 2) break;
      const k = (R() * ropes.length) | 0, r = ropes[k];
      const ende = r.ank ? 'b' : (R() < 0.5 ? 'a' : 'b');
      const neu = (R() * n) | 0;
      if (belegt[neu]) continue;
      const alt = r[ende];
      r[ende] = neu;
      const z = zaehle(cols, ropes);
      if (z >= jetzt || R() < 0.08) { belegt[alt] = 0; belegt[neu] = 1; jetzt = z; bewegt++; }
      else r[ende] = alt;
    }
    if (jetzt < 1) continue;
    return { cols, rows, ropes, loes, kreuzungen: jetzt };
  }
  throw new Error('Level konnte nicht erzeugt werden');
}

// Schwierigkeit eines erzeugten Levels (i = 0, 1, 2, ...)
export function konfig(i) {
  const ropes = Math.min(4 + Math.floor(i * 0.5), 16);
  const leer = Math.max(3, Math.ceil(ropes * 0.55));
  const bedarf = ropes * 2 + leer;
  let cols = Math.min(6, Math.max(4, Math.ceil(Math.sqrt(bedarf * 0.72))));
  let rows = Math.ceil(bedarf / cols);
  while (rows > 9 && cols < 7) { cols++; rows = Math.ceil(bedarf / cols); }
  const anchors = i < 4 ? 0 : Math.min(1 + Math.floor((i - 4) / 7), Math.floor(ropes / 3));
  return { cols, rows, ropes, anchors, maxLen: Math.max(2.3, Math.min(cols, rows) * 0.95 + (i > 10 ? 0.8 : 0)), wirr: 1.1 + Math.min(i, 30) * 0.02 };
}
