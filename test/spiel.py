import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
out = '/tmp/shots'; os.makedirs(out, exist_ok=True)
fehler = []
def check(c, t):
    print(('OK   ' if c else 'FAIL ') + t)
    if not c: fehler.append(t)

with sync_playwright() as p:
    b, pg, logs = start(p, 390, 844, touch=False)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT)
    pg.wait_for_function('window.__sa', timeout=15000)
    pg.wait_for_timeout(3000)
    i = pg.evaluate('window.__sa.info()')
    check(i['level'] == 1 and i['kreuzungen'] == 1, 'Level 1 startet mit 1 Kreuzung: %s' % i)
    # Das rote Seil liegt unter dem blauen: es lässt sich trotzdem greifen und bleibt beim Ziehen darunter
    sch0 = pg.evaluate('window.__sa.schicht()')
    a = pg.evaluate('window.__sa.screen(8)'); z = pg.evaluate('window.__sa.screen(1)')
    pg.mouse.move(a['x'], a['y']); pg.mouse.down()
    for s in range(1, 9):
        pg.mouse.move(a['x'] + (z['x'] - a['x']) * s / 8, a['y'] + (z['y'] - a['y']) * s / 8); pg.wait_for_timeout(60)
    pg.screenshot(path=out + '/unten-ziehen.png')
    check(pg.evaluate('window.__sa.schicht()') == sch0, 'Lage der Seile bleibt beim Ziehen unverändert')
    pg.mouse.up(); pg.wait_for_timeout(500)
    print('   zuege', pg.evaluate('window.__sa.info()'))
    check(pg.evaluate('window.__sa.info().zuege') == 1, 'Unteres Seil lässt sich bewegen')
    check(pg.evaluate('window.__sa.schicht()') == sch0, 'Lage nach dem Loslassen unverändert')
    pg.wait_for_timeout(400)
    i = pg.evaluate('window.__sa.info()')
    check(i['gewonnen'] and i['zuege'] == 1 and i['kreuzungen'] == 0, 'Level 1 nach einem Zug (am unten liegenden Seil) gewonnen: %s' % i)
    pg.wait_for_timeout(900)
    pg.screenshot(path=out + '/sieg.png')
    check(pg.is_visible('#sieg'), 'Sieg-Fenster sichtbar')
    pg.click('#weiter'); pg.wait_for_timeout(600)
    i = pg.evaluate('window.__sa.info()')
    check(i['level'] == 2 and i['save']['level'] == 2, 'Weiter führt zu Level 2, Fortschritt gespeichert: %s' % i)
    # Neu laden: Level 2 bleibt
    pg.reload(); pg.wait_for_function('window.__sa'); pg.wait_for_timeout(800)
    check(pg.evaluate('window.__sa.info().level') == 2, 'Nach dem Neuladen weiter bei Level 2')
    # Zurück-Knopf
    ends0 = pg.evaluate('window.__sa.ends()')
    free = [s for s in range(pg.evaluate('window.__sa.slots()')) if all(e['slot'] != s for r in ends0 for e in r)]
    fr_i = [i for i, r in enumerate(ends0) if not r[0]['fest']][0]
    mov = ends0[fr_i][0]['slot']
    a = pg.evaluate('window.__sa.screen(%d)' % mov); z = pg.evaluate('window.__sa.screen(%d)' % free[0])
    pg.mouse.move(a['x'], a['y']); pg.mouse.down()
    for s in range(1, 9):
        pg.mouse.move(a['x'] + (z['x'] - a['x']) * s / 8, a['y'] + (z['y'] - a['y']) * s / 8); pg.wait_for_timeout(40)
    pg.mouse.up(); pg.wait_for_timeout(500)
    check(pg.evaluate('window.__sa.info().zuege') == 1, 'Zug gezählt')
    check(pg.evaluate('window.__sa.ends()[%d][0].slot' % fr_i) == free[0], 'Ende liegt auf dem Zielpflock')
    pg.click('#zurueck'); pg.wait_for_timeout(300)
    check(pg.evaluate('window.__sa.ends()[%d][0].slot' % fr_i) == mov and pg.evaluate('window.__sa.info().zuege') == 0, 'Zurück stellt den Zug zurück')
    # Anker nicht greifbar (Level 3)
    pg.evaluate('window.__sa.laden(3)'); pg.wait_for_timeout(800)
    e3 = pg.evaluate('window.__sa.ends()'); ank = [r[0]['slot'] for r in e3 if r[0]['fest']][0]
    fr = [s for s in range(12) if all(e['slot'] != s for r in e3 for e in r)][0]
    a = pg.evaluate('window.__sa.screen(%d)' % ank); z = pg.evaluate('window.__sa.screen(%d)' % fr)
    pg.mouse.move(a['x'], a['y']); pg.mouse.down(); pg.mouse.move(z['x'], z['y'], steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
    check(pg.evaluate('window.__sa.info().zuege') == 0, 'Anker lässt sich nicht verschieben')
    pg.screenshot(path=out + '/l3.png')
    print('\n'.join(l for l in logs if 'GPU stall' not in l))
    b.close()
print('FEHLER: %d' % len(fehler) if fehler else 'alles ok')
