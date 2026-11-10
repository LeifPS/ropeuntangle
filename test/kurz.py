import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
out = '/tmp/shots'
fehler = []
def check(c, t):
    print(('OK   ' if c else 'FAIL ') + t)
    if not c: fehler.append(t)
with sync_playwright() as p:
    b, pg, logs = start(p, 390, 844, touch=False)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT)
    pg.wait_for_function('window.__sa')
    lim = []
    for lvl in range(18, 40):
        pg.evaluate('n=>window.__sa.laden(n)', lvl)
        en = pg.evaluate('window.__sa.ends()')
        lim = [r for r in pg.evaluate('window.__sa.limited()') if not r['fest']]
        frei_seile = [i for i, rr in enumerate(en) if not rr[0]['fest'] and not any(l['i'] == i for l in pg.evaluate('window.__sa.limited()'))]
        if lim and frei_seile and pg.evaluate('window.__sa.sperr()'): break
    print('Level', lvl)
    pg.wait_for_timeout(9000)
    info = pg.evaluate('window.__sa.info()'); cols = info['cols']
    ends = pg.evaluate('window.__sa.ends()'); sperr = pg.evaluate('window.__sa.sperr()')
    used = {e['slot'] for rr in ends for e in rr}
    frei = [s for s in range(pg.evaluate('window.__sa.slots()')) if s not in used and s not in sperr]
    def d(s, t): return math.hypot(s % cols - t % cols, s // cols - t // cols)
    r = None
    for cand in lim:
        weit = [s for s in frei if d(s, cand['b']) > cand['max'] + 0.3]
        nah = [s for s in frei if d(s, cand['b']) < cand['max'] - 0.05 and s != cand['a']]
        if weit and nah: r = cand; break
    assert r, 'kein passendes Seil'
    print('Seil', r, 'weit', weit[:3], 'nah', nah[:3])
    def zieh(von, nach, halten=False):
        a = pg.evaluate('window.__sa.screen(%d)' % von); z = pg.evaluate('window.__sa.screen(%d)' % nach)
        pg.mouse.move(a['x'], a['y']); pg.mouse.down()
        for s in range(1, 9):
            pg.mouse.move(a['x'] + (z['x'] - a['x']) * s / 8, a['y'] + (z['y'] - a['y']) * s / 8); pg.wait_for_timeout(120)
        if halten:
            pg.wait_for_timeout(1500); pg.screenshot(path=out + '/kurz_halten.png')
        pg.mouse.up(); pg.wait_for_timeout(600)
    zieh(r['a'], weit[0], halten=True)
    print('   nach weit:', pg.evaluate('window.__sa.info()'), pg.evaluate('window.__sa.ends()[%d]' % r['i']))
    sl = pg.evaluate('window.__sa.ends()[%d][0].slot' % r['i'])
    check(d(sl, r['b']) <= r['max'] + 1e-6, 'Zu weites Ziel: Pflock landet nie außerhalb der Reichweite (landet auf %d)' % sl)
    if pg.evaluate('window.__sa.info().zuege') == 1: pg.click('#zurueck'); pg.wait_for_timeout(400)
    zieh(r['a'], nah[0])
    check(pg.evaluate('window.__sa.info().zuege') == 1 and pg.evaluate('window.__sa.ends()[%d][0].slot' % r['i']) == nah[0], 'Erreichbares Ziel wird angenommen')
    # Stein: Ziel auf gesperrtes Feld
    st = sperr[0]
    ends = pg.evaluate('window.__sa.ends()')
    free_end = [(i, e) for i, rr in enumerate(ends) for k, e in enumerate(rr) if k == 0 and not e['fest'] and not any(l['i'] == i for l in pg.evaluate('window.__sa.limited()'))][0]
    zieh(free_end[1]['slot'], st)
    check(pg.evaluate('window.__sa.info().zuege') == 1, 'Gesperrtes Feld nimmt keinen Pflock an')
    # Levelauswahl
    pg.evaluate("localStorage.setItem('seilsalat.v1', JSON.stringify({level: 7, best: 7, ton: true, gesehen: {}}))")
    pg.reload(); pg.wait_for_function('window.__sa'); pg.wait_for_timeout(800)
    pg.click('#lvlpille'); pg.wait_for_timeout(300)
    check(pg.is_visible('#wahl') and pg.locator('#wahlraster .nr').count() == 7, 'Levelauswahl zeigt 7 Level')
    pg.screenshot(path=out + '/wahl.png')
    pg.click('#wahlraster .nr >> nth=2'); pg.wait_for_timeout(500)
    check(pg.evaluate('window.__sa.info().level') == 3, 'Auswahl lädt Level 3')
    print('\n'.join(l for l in logs if 'GPU stall' not in l))
    b.close()
print('FEHLER: %d' % len(fehler) if fehler else 'alles ok')
