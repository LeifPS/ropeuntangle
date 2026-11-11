import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
out = '/tmp/shots'; os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b, pg, logs = start(p, 390, 844, touch=False)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT)
    pg.wait_for_function('window.__sa', timeout=15000)
    for LV in (8, 9, 10, 11, 12):
        pg.evaluate('window.__sa.laden(%d)' % LV); pg.wait_for_timeout(2500)
        inf = pg.evaluate('window.__sa.info()'); cols = inf['cols']
        en = pg.evaluate('window.__sa.ends()'); sch = pg.evaluate('window.__sa.schicht()')
        n = len(pg.evaluate('window.__sa.slots()')) if isinstance(pg.evaluate('window.__sa.slots()'), list) else pg.evaluate('window.__sa.slots()')
        occ = {e['slot'] for r in en for e in r}
        sperr = set(pg.evaluate('window.__sa.sperr()') or [])
        P = lambda s: (s % cols, s // cols)
        def on_seg(a, b, c):
            return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]) == 0 and min(a[0],b[0]) <= c[0] <= max(a[0],b[0]) and min(a[1],b[1]) <= c[1] <= max(a[1],b[1])
        hits = []
        for i, r in enumerate(en):
            for ei, e in enumerate(r):
                if e['fest']: continue
                other = r[1-ei]['slot']
                for t in range(n):
                    if t in occ or t in sperr: continue
                    for j, rj in enumerate(en):
                        if j == i or sch[j] < sch[i]: continue
                        for ej in rj:
                            if on_seg(P(other), P(t), P(ej['slot'])) and ej['slot'] not in (other, t):
                                hits.append((i, ei, e['slot'], t, j, ej['slot']))
        print('Level', LV, 'cols', cols, 'Treffer', len(hits), hits[:4])
        if hits:
            i, ei, von, t, j, sj = hits[0]
            a = pg.evaluate('window.__sa.screen(%d)' % von); z = pg.evaluate('window.__sa.screen(%d)' % t)
            pg.mouse.move(a['x'], a['y']); pg.mouse.down()
            for s in range(1, 9):
                pg.mouse.move(a['x'] + (z['x'] - a['x']) * s / 8, a['y'] + (z['y'] - a['y']) * s / 8); pg.wait_for_timeout(60)
            pg.mouse.up(); pg.wait_for_timeout(2500)
            pg.screenshot(path=out + '/dp%d.png' % LV)
            print('   gezogen', i, von, '->', t, 'über Pflock', sj, 'von Seil', j, pg.evaluate('window.__sa.info().zuege'))
            break
    b.close()
