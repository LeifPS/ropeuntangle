import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
with sync_playwright() as p:
    b, pg, logs = start(p, 390, 844, touch=True)
    cdp = pg.context.new_cdp_session(pg)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT)
    pg.wait_for_function('window.__sa'); pg.wait_for_timeout(2500)
    def touch(t, x, y):
        cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [] if t == 'touchEnd' else [{'x': x, 'y': y}]})
    a = pg.evaluate('window.__sa.screen(8)'); z = pg.evaluate('window.__sa.screen(1)')
    # Finger liegt 0.62 Einheiten UNTER dem Pflock (Versatz nach oben): wir tippen etwas unterhalb des Ziels
    touch('touchStart', a['x'], a['y'])
    for s in range(1, 11):
        touch('touchMove', a['x'] + (z['x'] - a['x']) * s / 10, a['y'] + (z['y'] - a['y']) * s / 10 + 55); pg.wait_for_timeout(120)
    touch('touchEnd', 0, 0); pg.wait_for_timeout(1500)
    print(pg.evaluate('window.__sa.info()'))
    print(pg.evaluate('window.__sa.ends()[0]'))
    print('\n'.join(l for l in logs if 'GPU stall' not in l))
    b.close()
