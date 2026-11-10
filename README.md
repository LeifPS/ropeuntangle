# Seilsalat

3D-Entwirrspiel für den Leif Game Hub: Seilenden auf freie Punkte ziehen, bis sich keine Seile mehr kreuzen. Schwarze Anker sitzen fest. Fünf feste Einsteiger-Level, danach erzeugt ein Generator endlos neue Level (immer lösbar).

- `src/` Quellcode (Three.js), `public/` fertiges Spiel (`game.js` ist das gebündelte Ergebnis von `npm run bauen`)
- Deploy: Cloudflare Worker mit statischen Dateien aus `public/` (`wrangler.jsonc`), kein Build-Schritt nötig
- Hub-Teile: `public/lgh-vorlade.js`, `public/lgh-modul.js` (per `tools/lgh-einbauen.py` aus dem Hub-Repo)
- Tests: `node test/pruefen.mjs` (Level-Logik); Browser-Tests mit Playwright in `test/*.py`
