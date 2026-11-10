import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, HemisphereLight, DirectionalLight, Mesh, Group,
  PlaneGeometry, CircleGeometry, RingGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, BackSide, Vector3, Vector2, Plane, Raycaster,
  CanvasTexture, RepeatWrapping, PCFSoftShadowMap, BufferGeometry, BufferAttribute, SRGBColorSpace,
} from 'three';
import { levelFuer, PALETTE, FEST_ANZAHL } from './levels.js';
import { kreuzungen } from './logic.js';
import { Ton } from './ton.js';

// ---------- Maße (1 Einheit = Abstand zweier Pflöcke) ----------
const R = 0.09;          // Seilradius
const PEG_R = 0.34;      // Pflockradius
const KNOB_TOP = 0.26;   // Oberkante des Knopfs in der Pflockmitte
const END_H = 0.13;      // Höhe, auf der das Seil in den Pflock läuft
const HOLD_H = 0.62;     // Höhe eines gehaltenen Pflocks
const BG = 0xf3e6e0;

// ---------- Speicher ----------
const KEY = 'seilsalat.v1';
let save = { level: 1, best: 1, ton: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }
function speichern() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { } }

const ton = new Ton(() => save.ton);
window.LGH_ZEILEN = function () {
  return [{ text: 'Ton', an: !!save.ton, setze: function (v) { save.ton = !!v; speichern(); if (v) ton.klick(); } }];
};

// ---------- Szene ----------
const canvas = document.getElementById('c');
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
const scene = new Scene();
scene.background = new Color(BG);
const camera = new PerspectiveCamera(32, 1, 0.1, 100);

scene.add(new HemisphereLight(0xffffff, 0xcdb8ad, 1.05));
const sonne = new DirectionalLight(0xffffff, 2.1);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
sonne.shadow.bias = -0.0004;
sonne.shadow.normalBias = 0.02;
scene.add(sonne, sonne.target);

const boden = new Mesh(new PlaneGeometry(80, 80), new MeshStandardMaterial({ color: BG, roughness: 1 }));
boden.rotation.x = -Math.PI / 2;
boden.receiveShadow = true;
scene.add(boden);

// Seiltextur: schräge Streifen, wirken wie gedrehte Litzen. Ganzzahlige Faktoren = nahtlos.
function seilTextur() {
  const w = 128, h = 64, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d'), d = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = i / w, v = j / h;
    const s = Math.sin(Math.PI * 2 * (u * 2 + v * 3));
    const val = 0.58 + 0.42 * (0.5 + 0.5 * Math.sign(s) * Math.pow(Math.abs(s), 0.7));
    const g = Math.round(val * 255), p = (j * w + i) * 4;
    d.data[p] = d.data[p + 1] = d.data[p + 2] = g; d.data[p + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const TEX = seilTextur();
const matSeil = {};
function seilMaterial(farbe) {
  if (!matSeil[farbe]) matSeil[farbe] = new MeshStandardMaterial({ color: farbe, map: TEX, bumpMap: TEX, bumpScale: 2.2, roughness: 0.62, metalness: 0 });
  return matSeil[farbe];
}
// dunkle Kontur: das gleiche Mesh, entlang der Normalen aufgeblasen, nur Rückseiten
const konturMat = new ShaderMaterial({
  side: BackSide, uniforms: {},
  vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * 0.024, 1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.07,0.06,0.08,1.0); }',
});
const konturDick = new ShaderMaterial({
  side: BackSide, uniforms: {},
  vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * 0.045, 1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.07,0.06,0.08,1.0); }',
});

// ---------- Spielzustand ----------
let lv = null, num = 1, ropes = [], order = [], gfx = null, rueck = [], zuege = 0, gewonnen = false;
let drag = null, dirty = true, alle = [];
const slotXZ = [];

const $ = id => document.getElementById(id);
const hudLevel = $('lvl'), hudZuege = $('zuege'), btnZurueck = $('zurueck'), btnNeu = $('neu'), siegBox = $('sieg'), tipp = $('tipp');

function slotPos(i) { return slotXZ[i]; }

function bauePflock(farbe, anker) {
  const g = new Group();
  const col = anker ? 0x2a2a2e : farbe;
  const mBase = new MeshStandardMaterial({ color: col, roughness: anker ? 0.5 : 0.42 });
  const mKnauf = new MeshStandardMaterial({ color: anker ? 0x3b3b41 : farbe, roughness: 0.3 });
  const rand = new Mesh(new CylinderGeometry(PEG_R + 0.05, PEG_R + 0.05, 0.05, 44), new MeshBasicMaterial({ color: 0x141217 }));
  rand.position.y = 0.025; rand.receiveShadow = false;
  const base = new Mesh(new CylinderGeometry(PEG_R, PEG_R, 0.09, 44), mBase);
  base.position.y = 0.06; base.castShadow = true; base.receiveShadow = true;
  const ring = new Mesh(new TorusGeometry(PEG_R - 0.06, 0.03, 10, 40), new MeshStandardMaterial({ color: anker ? 0x55555c : 0xffffff, roughness: 0.4, transparent: true, opacity: anker ? 1 : 0.22 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.108;
  const knauf = new Mesh(new SphereGeometry(0.21, 32, 20), mKnauf);
  knauf.scale.y = 0.82; knauf.position.y = 0.1; knauf.castShadow = true;
  g.add(rand, base, ring, knauf);
  if (anker) {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const s = new Mesh(new SphereGeometry(0.05, 14, 10), new MeshStandardMaterial({ color: 0xb9b9c2, roughness: 0.35 }));
      s.position.set(Math.cos(a) * 0.255, 0.115, Math.sin(a) * 0.255); s.scale.y = 0.6;
      g.add(s);
    }
  }
  return g;
}

function aufraeumen() {
  if (gfx) {
    scene.remove(gfx);
    gfx.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  gfx = new Group();
  scene.add(gfx);
}

function laden(n) {
  num = n;
  lv = levelFuer(n);
  aufraeumen();
  slotXZ.length = 0;
  const { cols, rows } = lv;
  for (let i = 0; i < cols * rows; i++) slotXZ.push({ x: (i % cols) - (cols - 1) / 2, z: ((i / cols) | 0) - (rows - 1) / 2 });
  // leere Mulden
  const muldeMat = new MeshBasicMaterial({ color: 0xe2cfc4 });
  const muldeGeo = new CircleGeometry(0.4, 40);
  for (let i = 0; i < cols * rows; i++) {
    const m = new Mesh(muldeGeo, muldeMat);
    m.rotation.x = -Math.PI / 2; m.position.set(slotXZ[i].x, 0.004, slotXZ[i].z);
    gfx.add(m);
  }
  // Ziel-Ring (zeigt, wohin der gehaltene Pflock fällt)
  const ziel = new Mesh(new RingGeometry(0.41, 0.5, 48), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
  ziel.rotation.x = -Math.PI / 2; ziel.position.y = 0.012; ziel.visible = false;
  gfx.add(ziel);
  gfx.userData.ziel = ziel;

  // Seile und Pflöcke
  const farbOffset = (n * 3) % PALETTE.length;
  ropes = lv.ropes.map((r, k) => {
    const farbe = PALETTE[(k + farbOffset) % PALETTE.length];
    const rope = { k, farbe, ends: [], start: [r.a, r.b] };
    for (let e = 0; e < 2; e++) {
      const fest = e === 0 && r.ank;
      const slot = e === 0 ? r.a : r.b;
      const peg = bauePflock(farbe, fest);
      const p = slotPos(slot);
      const s0 = 0.001;
      peg.position.set(p.x, 0, p.z); peg.scale.setScalar(s0);
      gfx.add(peg);
      rope.ends.push({ slot, px: p.x, pz: p.z, lift: 0, tl: 0, fest, peg, scale: s0, ts: 1, verzoegerung: (k * 0.04 + e * 0.02) });
    }
    const mesh = new Mesh(neuesSeilGeo(), seilMaterial(farbe));
    mesh.castShadow = true; mesh.receiveShadow = true;
    const kontur = new Mesh(mesh.geometry, konturMat);
    mesh.frustumCulled = false; kontur.frustumCulled = false;
    gfx.add(mesh, kontur);
    rope.mesh = mesh; rope.kontur = kontur;
    return rope;
  });
  alle = ropes.flatMap(r => r.ends);
  order = ropes.map((_, k) => k);
  rueck = []; zuege = 0; gewonnen = false; drag = null;
  siegBox.hidden = true;
  fitCamera();
  baueSeile();
  ui();
  dirty = true;
}

function setzeAufStart() {
  ropes.forEach((r, k) => { r.ends.forEach((e, i) => { e.slot = r.start[i]; }); });
  order = ropes.map((_, k) => k);
  rueck = []; zuege = 0; gewonnen = false; drag = null;
  siegBox.hidden = true;
  ui(); dirty = true;
}

// ---------- Kamera ----------
function fitCamera() {
  if (!lv) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh;
  const quer = vw > vh * 1.15;
  const top = quer ? Math.max(46, vh * 0.13) : Math.min(78, vh * 0.12), bot = quer ? Math.max(58, vh * 0.15) : Math.min(104, vh * 0.16);
  const availH = Math.max(120, vh - top - bot);
  const Wb = (lv.cols - 1) + 1.3, Hb = (lv.rows - 1) + 1.3;
  const tan = Math.tan(camera.fov * Math.PI / 360);
  const dH = (Hb * vh / availH) / (2 * tan);
  const dW = Wb / (2 * tan * camera.aspect);
  const D = Math.max(dH, dW, 4);
  const tilt = 9 * Math.PI / 180;
  camera.position.set(0, D * Math.cos(tilt), D * Math.sin(tilt));
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  const shift = (top - bot) / 2;
  camera.setViewOffset(vw, vh, 0, -shift, vw, vh);
  camera.updateProjectionMatrix();
  // Licht und Schattenbereich
  const ext = Math.max(lv.cols, lv.rows) / 2 + 2.5;
  sonne.position.set(-ext * 0.5, ext * 2.1, ext * 0.9);
  sonne.target.position.set(0, 0, 0);
  const sc = sonne.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5; sc.far = ext * 6;
  sc.updateProjectionMatrix();
  dirty = true;
}
window.addEventListener('resize', fitCamera);
window.addEventListener('orientationchange', () => setTimeout(fitCamera, 120));

// ---------- Seilgeometrie ----------
// Eigenes Rohr mit stabilen Rahmen (keine Frenet-Drehungen): RING Abschnitte, RAD Ecken, wird jedes Bild neu gefüllt.
const N = 100, RAD = 12;
function neuesSeilGeo() {
  const g = new BufferGeometry(), nv = (N + 1) * (RAD + 1);
  g.setAttribute('position', new BufferAttribute(new Float32Array(nv * 3), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nv * 3), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(nv * 2), 2));
  const idx = new Uint16Array(N * RAD * 6);
  let q = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < RAD; j++) {
    const a = i * (RAD + 1) + j, b = (i + 1) * (RAD + 1) + j;
    idx[q++] = a; idx[q++] = b; idx[q++] = a + 1; idx[q++] = b; idx[q++] = b + 1; idx[q++] = a + 1;
  }
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}
const COS = [], SIN = [];
for (let j = 0; j <= RAD; j++) { COS.push(Math.cos(j / RAD * Math.PI * 2)); SIN.push(Math.sin(j / RAD * Math.PI * 2)); }
function fuelleSeil(g, ax, az, dx, dz, h, rep) {
  const pos = g.attributes.position.array, nor = g.attributes.normal.array, uv = g.attributes.uv.array;
  let o = 0, ou = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N, i0 = Math.max(0, i - 1), i1 = Math.min(N, i + 1);
    let tx = dx * (i1 - i0) / N, ty = h[i1] - h[i0], tz = dz * (i1 - i0) / N;
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let sx = -tz, sz = tx; const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
    const ux = -sz * ty, uy = sz * tx - sx * tz, uz = sx * ty;
    const px = ax + dx * t, py = h[i], pz = az + dz * t;
    for (let j = 0; j <= RAD; j++) {
      const c = COS[j], s = SIN[j];
      const nx = c * sx + s * ux, ny = s * uy, nz = c * sz + s * uz;
      pos[o] = px + nx * R; pos[o + 1] = py + ny * R; pos[o + 2] = pz + nz * R;
      nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz; o += 3;
      uv[ou++] = t * rep; uv[ou++] = j / RAD;
    }
  }
  g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
}
function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

function schnitt(A, B, C, D) {
  const d1x = B.px - A.px, d1z = B.pz - A.pz, d2x = D.px - C.px, d2z = D.pz - C.pz;
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const ex = C.px - A.px, ez = C.pz - A.pz;
  const t = (ex * d2z - ez * d2x) / den, u = (ex * d1z - ez * d1x) / den;
  if (t > 0 && t < 1 && u > 0 && u < 1) return { t, u };
  return null;
}

function baueSeile() {
  const H = new Array(ropes.length), L = new Array(ropes.length);
  const reihenfolge = order;
  for (let oi = 0; oi < reihenfolge.length; oi++) {
    const k = reihenfolge[oi], rope = ropes[k], A = rope.ends[0], B = rope.ends[1];
    const dx = B.px - A.px, dz = B.pz - A.pz, len = Math.max(Math.hypot(dx, dz), 1e-4);
    L[k] = len;
    const h = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = A.px + dx * t, z = A.pz + dz * t;
      const dEnd = Math.min(t, 1 - t) * len;
      const endH = END_H + (HOLD_H - END_H) * (t < 0.5 ? A.lift : B.lift);
      const ramp = smooth(0, 0.5, dEnd);
      let y = R + (endH - R) * (1 - ramp);
      // über fremde Pflöcke hinweg
      for (let q = 0; q < alle.length; q++) {
        const e = alle[q];
        if (e === A || e === B || e.lift > 0.3) continue;
        const d = Math.hypot(x - e.px, z - e.pz);
        if (d < 0.66) y = Math.max(y, R + (KNOB_TOP + R + 0.02 - R) * (1 - smooth(0.3, 0.66, d)));
      }
      h[i] = y;
    }
    // über tiefer liegende Seile hinweg
    for (let oj = 0; oj < oi; oj++) {
      const j = reihenfolge[oj], o = ropes[j];
      const hit = schnitt(A, B, o.ends[0], o.ends[1]);
      if (!hit) continue;
      const hj = H[j], fi = hit.u * N, i0 = Math.floor(fi), i1 = Math.min(N, i0 + 1), fr = fi - i0;
      const hOben = hj[i0] * (1 - fr) + hj[i1] * fr;
      const peak = hOben + 2 * R + 0.03;
      for (let i = 0; i <= N; i++) {
        const s = Math.abs(i / N - hit.t) * len;
        const w = Math.exp(-(s * s) / (0.38 * 0.38));
        h[i] = Math.max(h[i], R + (peak - R) * w);
      }
    }
    H[k] = h;
    fuelleSeil(rope.mesh.geometry, A.px, A.pz, dx, dz, h, Math.max(1, len / 0.34));
  }
}

// ---------- Eingabe ----------
const ray = new Raycaster(), ndc = new Vector2(), ebene = new Plane(new Vector3(0, 1, 0), -0.1), treffer = new Vector3();
function bodenPunkt(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -(((ev.clientY - r.top) / r.height) * 2 - 1));
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(ebene, treffer) ? { x: treffer.x, z: treffer.z } : null;
}
function belegt(slot, ausser) { return alle.some(e => e !== ausser && e.slot === slot); }

canvas.addEventListener('pointerdown', ev => {
  if (gewonnen || drag) return;
  ton.freigeben();
  const p = bodenPunkt(ev);
  if (!p) return;
  let best = null, bd = 0.78;
  for (const rope of ropes) for (const e of rope.ends) {
    if (e.fest) continue;
    const d = Math.hypot(p.x - e.px, p.z - e.pz);
    if (d < bd) { bd = d; best = { rope, e }; }
  }
  if (!best) return;
  ev.preventDefault();
  try { canvas.setPointerCapture(ev.pointerId); } catch (err) { }
  const touch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
  drag = { rope: best.rope, e: best.e, id: ev.pointerId, von: best.e.slot, ziel: best.e.slot, off: touch ? -0.62 : 0, grab: { x: best.e.px - p.x, z: best.e.pz - p.z } };
  best.e.tl = 1;
  // Seil kommt nach oben
  order = order.filter(k => k !== best.rope.k); order.push(best.rope.k);
  ton.nimm();
  dirty = true;
});
canvas.addEventListener('pointermove', ev => {
  if (!drag || ev.pointerId !== drag.id) return;
  const p = bodenPunkt(ev);
  if (!p) return;
  drag.x = p.x; drag.z = p.z + drag.off;
  // nächster freier Pflock
  let best = drag.von, bd = 0.85;
  for (let i = 0; i < slotXZ.length; i++) {
    if (belegt(i, drag.e)) continue;
    const d = Math.hypot(drag.x - slotXZ[i].x, drag.z - slotXZ[i].z);
    if (d < bd) { bd = d; best = i; }
  }
  drag.ziel = best;
  dirty = true;
});
function loslassen(ev) {
  if (!drag || (ev && ev.pointerId !== drag.id)) return;
  const d = drag; drag = null;
  d.e.tl = 0;
  const ziel = d.ziel;
  if (ziel !== d.von && !belegt(ziel, d.e)) {
    d.e.slot = ziel; zuege++;
    rueck.push({ k: d.rope.k, ende: d.rope.ends.indexOf(d.e), von: d.von });
    ton.setze();
    pruefeSieg();
  } else {
    ton.zurueck();
  }
  ui(); dirty = true;
}
canvas.addEventListener('pointerup', loslassen);
canvas.addEventListener('pointercancel', loslassen);
canvas.addEventListener('contextmenu', e => e.preventDefault());

function pruefeSieg() {
  const k = kreuzungen(lv.cols, ropes.map(r => ({ a: r.ends[0].slot, b: r.ends[1].slot })));
  if (k.length === 0) {
    gewonnen = true;
    if (num >= save.level) save.level = num + 1;
    if (num + 1 > save.best) save.best = num + 1;
    speichern();
    for (const e of alle) e.scale = 1.32;
    setTimeout(() => {
      ton.sieg();
      $('siegtext').textContent = zuege === 1 ? 'Gelöst in 1 Zug.' : 'Gelöst in ' + zuege + ' Zügen.';
      siegBox.hidden = false;
    }, 420);
  }
}

// ---------- Oberfläche ----------
function ui() {
  hudLevel.textContent = 'Level ' + num;
  hudZuege.textContent = zuege === 1 ? '1 Zug' : zuege + ' Züge';
  btnZurueck.disabled = rueck.length === 0 || gewonnen;
  btnNeu.disabled = gewonnen;
  tipp.hidden = !(num <= 2 && zuege === 0 && !gewonnen);
  tipp.textContent = num === 1
    ? 'Zieh ein Seilende auf einen freien Punkt, bis sich keine Seile mehr kreuzen.'
    : 'Verschiebe die Seilenden, bis nichts mehr übereinanderliegt.';
  $('hinweisAnker').hidden = !(num === 3 && zuege === 0 && !gewonnen);
}
btnZurueck.addEventListener('click', () => {
  if (gewonnen || drag || !rueck.length) return;
  const z = rueck.pop();
  ropes[z.k].ends[z.ende].slot = z.von; zuege = Math.max(0, zuege - 1);
  ton.zurueck(); ui(); dirty = true;
});
btnNeu.addEventListener('click', () => { if (!gewonnen) { ton.klick(); setzeAufStart(); } });
$('weiter').addEventListener('click', () => { ton.klick(); laden(num + 1); });
$('lvl').addEventListener('click', () => { /* Platz für die Levelauswahl */ });

// ---------- Schleife ----------
let letzte = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - letzte) / 1000); letzte = now;
  if (!lv) return;
  let bewegt = false;
  const gz = gfx && gfx.userData.ziel;
  for (const rope of ropes) for (const e of rope.ends) {
    let tx, tz;
    const gehalten = drag && drag.e === e;
    if (gehalten && drag.x !== undefined) { tx = drag.x; tz = drag.z; }
    else { const p = slotPos(e.slot); tx = p.x; tz = p.z; }
    const kp = 1 - Math.exp(-dt * (gehalten ? 38 : 20));
    const dx = tx - e.px, dz = tz - e.pz;
    if (Math.abs(dx) > 0.0008 || Math.abs(dz) > 0.0008) { e.px += dx * kp; e.pz += dz * kp; bewegt = true; }
    else { e.px = tx; e.pz = tz; }
    const dl = e.tl - e.lift;
    if (Math.abs(dl) > 0.002) { e.lift += dl * (1 - Math.exp(-dt * 16)); bewegt = true; } else e.lift = e.tl;
    // Auftauchen und Federn
    if (e.verzoegerung > 0) { e.verzoegerung -= dt; bewegt = true; }
    else {
      const ds = e.ts - e.scale;
      if (Math.abs(ds) > 0.002) { e.scale += ds * (1 - Math.exp(-dt * 12)); bewegt = true; } else e.scale = e.ts;
    }
    e.peg.position.set(e.px, e.lift * (HOLD_H - END_H), e.pz);
    e.peg.scale.setScalar(Math.max(0.001, e.scale));
  }
  if (gz) {
    if (drag && drag.ziel !== drag.von) { const p = slotPos(drag.ziel); gz.visible = true; gz.position.x = p.x; gz.position.z = p.z; }
    else gz.visible = false;
  }
  if (bewegt || dirty) { baueSeile(); renderer.render(scene, camera); dirty = bewegt; }
}

// kleine Prüfschnittstelle (für automatische Tests)
window.__sa = {
  info: () => ({ level: num, cols: lv.cols, rows: lv.rows, zuege, gewonnen, kreuzungen: kreuzungen(lv.cols, ropes.map(r => ({ a: r.ends[0].slot, b: r.ends[1].slot }))).length, save: JSON.parse(JSON.stringify(save)) }),
  ends: () => ropes.map(r => r.ends.map(e => ({ slot: e.slot, fest: e.fest, scale: e.scale }))),
  screen: slot => { const p = slotPos(slot); const v = new Vector3(p.x, 0.1, p.z).project(camera); return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight }; },
  laden: n => laden(n),
  slots: () => slotXZ.length,
};

laden(Math.max(1, Math.min(save.level || 1, 9999)));
requestAnimationFrame(frame);
