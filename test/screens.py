import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
out = '/tmp/shots'; os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b, pg, logs = start(p, 390, 844, touch=True)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT)
    pg.wait_for_function('window.__sa', timeout=15000)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=out + '/l1.png')
    for n in (4, 5, 12, 30):
        pg.evaluate('n => window.__sa.laden(n)', n)
        pg.wait_for_timeout(1500)
        pg.screenshot(path=out + '/l%d.png' % n)
    print('\n'.join(logs[:20]))
    b.close()
