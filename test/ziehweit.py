import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
out = '/tmp/shots'; os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b, pg, logs = start(p, 390, 844, touch=False)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT)
    pg.wait_for_function('window.__sa', timeout=15000)
    pg.wait_for_timeout(3500)
    print(pg.evaluate('window.__sa.ends()'), pg.evaluate('window.__sa.schicht()'))
    pg.screenshot(path=out + '/w0.png')
    a = pg.evaluate('window.__sa.screen(8)')
    pg.mouse.move(a['x'], a['y']); pg.mouse.down()
    for s in range(1, 13):
        pg.mouse.move(a['x'] + (385 - a['x']) * s / 12, a['y'] + (a['y']*0 ) , ); pg.wait_for_timeout(120)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=out + '/w1.png')
    pg.mouse.up(); pg.wait_for_timeout(1500)
    pg.screenshot(path=out + '/w2.png')
    print(pg.evaluate('window.__sa.info()'))
    b.close()
