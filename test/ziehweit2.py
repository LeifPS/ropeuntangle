import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
out = '/tmp/shots'; os.makedirs(out, exist_ok=True)
LV = int(sys.argv[1]) if len(sys.argv) > 1 else 8
with sync_playwright() as p:
    b, pg, logs = start(p, 390, 844, touch=False)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT)
    pg.wait_for_function('window.__sa', timeout=15000)
    pg.evaluate('window.__sa.laden(%d)' % LV)
    pg.wait_for_timeout(4000)
    inf = pg.evaluate('window.__sa.info()'); cols = inf['cols']
    en = pg.evaluate('window.__sa.ends()'); sch = pg.evaluate('window.__sa.schicht()')
    print(inf['cols'], inf['rows'], sch)
    def pt(s): return (s % cols, s // cols)
    def ccw(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def kreuzt(i,j):
        a,b_=pt(en[i][0]['slot']),pt(en[i][1]['slot']); c,d=pt(en[j][0]['slot']),pt(en[j][1]['slot'])
        return ccw(a,b_,c)*ccw(a,b_,d)<0 and ccw(c,d,a)*ccw(c,d,b_)<0
    cand=[(i,j) for i in range(len(en)) for j in range(len(en)) if i!=j and sch[i]<sch[j] and kreuzt(i,j) and not en[i][1]['fest']]
    print(cand[:6])
    i,j=cand[0]
    pg.screenshot(path=out + '/v0.png')
    e = en[i][1]['slot'] if not en[i][1]['fest'] else en[i][0]['slot']
    a = pg.evaluate('window.__sa.screen(%d)' % e)
    print('rope',i,'under',j,'grab slot',e,a)
    pg.mouse.move(a['x'], a['y']); pg.mouse.down()
    for s in range(1, 11):
        pg.mouse.move(a['x'] + (385 - a['x']) * s / 10, a['y']); pg.wait_for_timeout(150)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=out + '/v1.png')
    pg.mouse.up(); pg.wait_for_timeout(1500)
    pg.screenshot(path=out + '/v2.png')
    print(pg.evaluate('window.__sa.info()'))
    b.close()
