import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
out = '/tmp/shots'
with sync_playwright() as p:
    for (w, h, name, lvl) in [(844, 390, 'quer', 12)]:
        b, pg, logs = start(p, w, h, touch=True)
        pg.goto('http://127.0.0.1:%d/index.html' % PORT)
        pg.wait_for_function('window.__sa', timeout=15000)
        pg.evaluate('n => window.__sa.laden(n)', lvl)
        pg.wait_for_timeout(14000)
        print(name, 'kleinste Pflockgröße', min(e['scale'] for r in pg.evaluate('window.__sa.ends()') for e in r))
        pg.screenshot(path=out + '/f_%s.png' % name)
        # Seitenscroll / Überlauf prüfen
        print(name, pg.evaluate('({sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight})'))
        b.close()
