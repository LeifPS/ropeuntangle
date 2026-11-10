import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, HemisphereLight, DirectionalLight, Mesh, Group,
  PlaneGeometry, CircleGeometry, RingGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, BackSide, Vector3, Vector2, Plane, Raycaster,
  CanvasTexture, RepeatWrapping, PCFSoftShadowMap, BufferGeometry, BufferAttribute, SRGBColorSpace,
} from 'three';
import { levelFuer, PALETTE, FEST_ANZAHL } from './levels.js';
import { kreuzungen, reichtBis } from './logic.js';
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
let save = { level: 1, best: 1, ton: true, gesehen: {} };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }
if (!save.gesehen || typeof save.gesehen !== 'object') save.gesehen = {};
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
let drag = null, dirty = true, alle = [], sperr = new Set(), UP = new Vector3(0, 1, 0);
const slotXZ = [];

const $ = id => document.getElementById(id);
const hudLevel = $('lvl'), hudZuege = $('zuege'), btnZurueck = $('zurueck'), btnNeu = $('neu'), siegBox = $('sieg'), tipp = $('tipp'), tipp2 = $('tipp2');

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
  g.userData.mats = anker ? null : [[mBase.color, new Color(farbe)], [mKnauf.color, new Color(farbe)]];
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

function baueStein() {
  const g = new Group();
  const rand = new Mesh(new CylinderGeometry(0.36, 0.4, 0.05, 6), new MeshBasicMaterial({ color: 0x141217 }));
  rand.position.y = 0.025;
  const stein = new Mesh(new CylinderGeometry(0.29, 0.34, 0.2, 6), new MeshStandardMaterial({ color: 0x9d928d, roughness: 0.9, flatShading: true }));
  stein.position.y = 0.1; stein.castShadow = true; stein.receiveShadow = true;
  const kappe = new Mesh(new CylinderGeometry(0.2, 0.27, 0.06, 6), new MeshStandardMaterial({ color: 0xb4a9a4, roughness: 0.85, flatShading: true }));
  kappe.position.y = 0.22; kappe.castShadow = true;
  g.add(rand, stein, kappe);
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

function statischeReihenfolge() { return ropes.map((_, k) => k).sort((x, y) => lv.schicht[x] - lv.schicht[y]); }
function logik() { return ropes.map(r => ({ a: r.ends[0].slot, b: r.ends[1].slot })); }

function laden(n) {
  num = n;
  lv = levelFuer(n);
  aufraeumen();
  slotXZ.length = 0;
  sperr = new Set(lv.sperr || []);
  const { cols, rows } = lv;
  for (let i = 0; i < cols * rows; i++) slotXZ.push({ x: (i % cols) - (cols - 1) / 2, z: ((i / cols) | 0) - (rows - 1) / 2 });
  // leere Mulden
  const muldeMat = new MeshBasicMaterial({ color: 0xe2cfc4 });
  const muldeGeo = new CircleGeometry(0.4, 40);
  for (let i = 0; i < cols * rows; i++) {
    if (sperr.has(i)) { const st = baueStein(); st.position.set(slotXZ[i].x, 0, slotXZ[i].z); gfx.add(st); continue; }
    const m = new Mesh(muldeGeo, muldeMat);
    m.rotation.x = -Math.PI / 2; m.position.set(slotXZ[i].x, 0.004, slotXZ[i].z);
    gfx.add(m);
  }
  // Ziel-Ring (zeigt, wohin der gehaltene Pflock fällt)
  const ziel = new Mesh(new RingGeometry(0.41, 0.5, 48), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
  ziel.rotation.x = -Math.PI / 2; ziel.position.y = 0.012; ziel.visible = false;
  gfx.add(ziel);
  gfx.userData.ziel = ziel;
  const reich = new Mesh(new RingGeometry(0.97, 1, 96), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  reich.rotation.x = -Math.PI / 2; reich.position.y = 0.014; reich.visible = false;
  gfx.add(reich);
  gfx.userData.reich = reich;

  // Seile und Pflöcke
  const farbOffset = (n * 3) % PALETTE.length;
  ropes = lv.ropes.map((r, k) => {
    const farbe = PALETTE[(k + farbOffset) % PALETTE.length];
    const rope = { k, farbe, ends: [], start: [r.a, r.b], max: r.max || null, klemme: null };
    for (let e = 0; e < 2; e++) {
      const fest = e === 0 && r.ank;
      const slot = e === 0 ? r.a : r.b;
      const peg = bauePflock(farbe, fest);
      const p = slotPos(slot);
      const s0 = 0.001;
      peg.position.set(p.x, 0, p.z); peg.scale.setScalar(s0);
      gfx.add(peg);
      rope.ends.push({ slot, px: p.x, pz: p.z, lift: 0, tl: 0, fest, peg, scale: s0, ts: 1, shake: 0, verzoegerung: (k * 0.04 + e * 0.02) });
    }
    const mesh = new Mesh(neuesSeilGeo(), seilMaterial(farbe));
    mesh.castShadow = true; mesh.receiveShadow = true;
    const kontur = new Mesh(mesh.geometry, konturMat);
    mesh.frustumCulled = false; kontur.frustumCulled = false;
    gfx.add(mesh, kontur);
    rope.mesh = mesh; rope.kontur = kontur;
    if (rope.max) {
      const kl = new Mesh(new CylinderGeometry(R + 0.03, R + 0.03, 0.15, 20), new MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.75, roughness: 0.28 }));
      kl.castShadow = true; gfx.add(kl); rope.klemme = kl;
    }
    return rope;
  });
  alle = ropes.flatMap(r => r.ends);
  order = statischeReihenfolge();
  rueck = []; zuege = 0; gewonnen = false; drag = null;
  siegBox.hidden = true;
  fitCamera();
  baueSeile();
  ui();
  dirty = true;
}

function setzeAufStart() {
  ropes.forEach((r, k) => { r.ends.forEach((e, i) => { e.slot = r.start[i]; }); });
  order = statischeReihenfolge();
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
// iOS kann den WebGL-Kontext im Hintergrund verwerfen: beim Zurückkommen neu zeichnen
canvas.addEventListener('webglcontextlost', e => e.preventDefault());
canvas.addEventListener('webglcontextrestored', () => { dirty = true; });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { dirty = true; letzte = performance.now(); } });
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
    // Knicke glätten (sonst stören kleine Kerben an der Kontur)
    for (let pass = 0; pass < 4; pass++) {
      let vor = h[0];
      for (let i = 1; i < N; i++) { const jetzt = h[i]; h[i] = (vor + 2 * jetzt + h[i + 1]) * 0.25; vor = jetzt; }
    }
    H[k] = h;
    fuelleSeil(rope.mesh.geometry, A.px, A.pz, dx, dz, h, Math.max(1, len / 0.34));
    if (rope.klemme) {
      const m = N >> 1, tx = dx / N * 2, ty = h[m + 1] - h[m - 1], tz = dz / N * 2, tl = Math.hypot(tx, ty, tz) || 1;
      rope.klemme.position.set(A.px + dx * 0.5, h[m], A.pz + dz * 0.5);
      rope.klemme.quaternion.setFromUnitVectors(UP, new Vector3(tx / tl, ty / tl, tz / tl));
      rope.klemme.visible = len > 0.55;
    }
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
function belegt(slot, ausser) { return sperr.has(slot) || alle.some(e => e !== ausser && e.slot === slot); }
function erreichbar(rope, e, slot) {
  if (!rope.max) return true;
  return reichtBis(lv.cols, { a: rope.ends[0].slot, b: rope.ends[1].slot, max: rope.max }, rope.ends.indexOf(e) === 0 ? 'a' : 'b', slot);
}

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
  tipp.hidden = true; tipp2.hidden = true;
  const rg = gfx.userData.reich;
  if (best.rope.max) {
    const anderes = best.rope.ends[best.rope.ends[0] === best.e ? 1 : 0], q = slotPos(anderes.slot);
    rg.position.x = q.x; rg.position.z = q.z; rg.scale.setScalar(best.rope.max); rg.visible = true;
    drag.mitte = { x: q.x, z: q.z };
  }
  // Das Seil behält seine Lage: Liegt es unter anderen, bleibt es beim Ziehen darunter (nur das Ende hebt sich)
  ton.nimm();
  dirty = true;
});
canvas.addEventListener('pointermove', ev => {
  if (!drag || ev.pointerId !== drag.id) return;
  const p = bodenPunkt(ev);
  if (!p) return;
  drag.x = p.x; drag.z = p.z + drag.off;
  if (drag.mitte) {   // begrenztes Seil: der Pflock kommt nicht weiter als das Seil reicht
    const vx = drag.x - drag.mitte.x, vz = drag.z - drag.mitte.z, l = Math.hypot(vx, vz), m = drag.rope.max;
    if (l > m) { drag.x = drag.mitte.x + vx / l * m; drag.z = drag.mitte.z + vz / l * m; }
  }
  // nächster freier Pflock
  let best = drag.von, bd = 0.85;
  for (let i = 0; i < slotXZ.length; i++) {
    if (belegt(i, drag.e) || !erreichbar(drag.rope, drag.e, i)) continue;
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
  gfx.userData.reich.visible = false;
  order = statischeReihenfolge();
  const ziel = d.ziel;
  if (ziel !== d.von && !belegt(ziel, d.e)) {
    d.e.slot = ziel; zuege++; merkmaleGesehen();
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
const HINWEIS = {
  anker: 'Schwarze Anker sitzen fest: Nur das farbige Ende lässt sich verschieben.',
  kurz: 'Seile mit Metallklemme sind kurz: Beim Halten zeigt ein Ring, wie weit sie reichen.',
  sperr: 'Graue Steine sperren ein Feld: Dort kann kein Pflock hin.',
};
function merkmale() {
  const m = [];
  if (lv.ropes.some(r => r.ank)) m.push('anker');
  if (lv.ropes.some(r => r.max)) m.push('kurz');
  if (lv.sperr && lv.sperr.length) m.push('sperr');
  return m;
}
function ui() {
  hudLevel.textContent = 'Level ' + num;
  hudZuege.textContent = zuege === 1 ? '1 Zug' : zuege + ' Züge';
  btnZurueck.disabled = rueck.length === 0 || gewonnen;
  btnNeu.disabled = gewonnen;
  const still = zuege === 0 && !gewonnen;
  tipp.hidden = !(num <= 2 && still);
  tipp.textContent = num === 1
    ? 'Zieh ein Seilende auf einen freien Punkt, bis sich keine Seile mehr kreuzen. Ein Seil bleibt immer in seiner Lage: Was unten liegt, bleibt unten.'
    : 'Verschiebe die Seilenden, bis nichts mehr übereinanderliegt. Seile bleiben beim Ziehen unter den anderen, an denen sie hängen.';
  const neu = still ? merkmale().filter(m => !save.gesehen[m]) : [];
  tipp2.hidden = neu.length === 0;
  tipp2.textContent = neu.map(m => HINWEIS[m]).join(' ');
}
function merkmaleGesehen() {
  let neu = false;
  for (const m of merkmale()) if (!save.gesehen[m]) { save.gesehen[m] = true; neu = true; }
  if (neu) speichern();
}
btnZurueck.addEventListener('click', () => {
  if (gewonnen || drag || !rueck.length) return;
  const z = rueck.pop();
  ropes[z.k].ends[z.ende].slot = z.von; zuege = Math.max(0, zuege - 1);
  order = statischeReihenfolge();
  ton.zurueck(); ui(); dirty = true;
});
btnNeu.addEventListener('click', () => { if (!gewonnen) { ton.klick(); setzeAufStart(); } });
$('weiter').addEventListener('click', () => { ton.klick(); laden(num + 1); });
const wahl = $('wahl'), raster = $('wahlraster');
function wahlOeffnen() {
  if (drag) return;
  ton.klick();
  raster.textContent = '';
  const max = Math.min(Math.max(save.level, num), 999);
  for (let n = 1; n <= max; n++) {
    const b = document.createElement('button');
    b.className = 'nr' + (n === num ? ' jetzt' : n < save.level ? ' fertig' : '');
    b.textContent = n;
    b.addEventListener('click', () => { wahl.hidden = true; if (n !== num) { ton.klick(); laden(n); } });
    raster.appendChild(b);
  }
  wahl.hidden = false;
  const j = raster.querySelector('.jetzt'); if (j && j.scrollIntoView) j.scrollIntoView({ block: 'center' });
}
$('lvlpille').addEventListener('click', wahlOeffnen);
$('wahlzu').addEventListener('click', () => { wahl.hidden = true; });
wahl.addEventListener('click', e => { if (e.target === wahl) wahl.hidden = true; });

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
    if (e.shake > 0) { e.shake = Math.max(0, e.shake - dt); tx += Math.sin(e.shake * 55) * 0.07 * (e.shake / 0.4); bewegt = true; }
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
  schicht: () => lv.schicht.slice(),
  screen: slot => { const p = slotPos(slot); const v = new Vector3(p.x, 0.1, p.z).project(camera); return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight }; },
  laden: n => laden(n),
  slots: () => slotXZ.length,
  limited: () => ropes.map((r, i) => ({ i, max: r.max, a: r.ends[0].slot, b: r.ends[1].slot, fest: r.ends[0].fest })).filter(r => r.max),
  sperr: () => Array.from(sperr),
};

laden(Math.max(1, Math.min(save.level || 1, 9999)));
requestAnimationFrame(frame);
