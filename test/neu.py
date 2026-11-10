import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
out = '/tmp/shots'
with sync_playwright() as p:
    b, pg, logs = start(p, 390, 844, touch=False)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT)
    pg.wait_for_function('window.__sa'); 
    pg.evaluate('n=>window.__sa.laden(n)', 18); pg.wait_for_timeout(12000)
    pg.screenshot(path=out + '/n18.png')
    # begrenztes Seil halten
    info = pg.evaluate('window.__sa.limited()')
    print(info)
    b.close()
