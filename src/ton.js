// Kleine Klänge per Web Audio, ohne Audiodateien. Die Lautstärke vom Hub greift automatisch (lgh-vorlade.js),
// der eigene Schalter steckt in den Spiel-Einstellungen ("Ton").
export class Ton {
  constructor(an) { this.an = an; this.ctx = null; }
  _ctx() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    return this.ctx;
  }
  // beim ersten Tippen starten (iOS erlaubt Ton erst nach einer Berührung)
  freigeben() {
    const c = this._ctx();
    if (c && c.state === 'suspended') { try { c.resume(); } catch (e) { } }
  }
  _ton(f, dauer, typ, vol, bis, start) {
    if (!this.an()) return;
    const c = this._ctx(); if (!c) return;
    if (c.state === 'suspended') { try { c.resume(); } catch (e) { } }
    const t0 = c.currentTime + (start || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = typ || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (bis) o.frequency.exponentialRampToValueAtTime(bis, t0 + dauer);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dauer + 0.03);
  }
  klick() { this._ton(520, 0.07, 'triangle', 0.12); }
  nimm() { this._ton(330, 0.09, 'triangle', 0.14, 520); }
  setze() { this._ton(180, 0.14, 'sine', 0.3, 90); this._ton(760, 0.05, 'triangle', 0.08, 0, 0.01); }
  zurueck() { this._ton(420, 0.1, 'triangle', 0.12, 260); }
  nein() { this._ton(220, 0.12, 'square', 0.06, 150); this._ton(190, 0.14, 'square', 0.06, 120, 0.13); }
  sieg() { [523, 659, 784, 1047].forEach((f, i) => this._ton(f, 0.26, 'triangle', 0.16, 0, i * 0.11)); }
}
