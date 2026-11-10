import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from browser import *
with sync_playwright() as p:
    b, pg, logs = start(p, 600, 800)
    pg.route('**/__host.html', lambda r: r.fulfill(content_type='text/html', body='<script>window.msgs=[];addEventListener("message",e=>msgs.push(JSON.stringify(e.data)))</script><iframe id=f src="/index.html" style="width:500px;height:700px"></iframe>'))
    pg.goto('http://127.0.0.1:%d/__host.html' % PORT)
    pg.wait_for_timeout(5000)
    print('Nachrichten an den Hub:', pg.evaluate('window.msgs'))
    fr = pg.frame_locator('#f')
    print('Spiel im iframe geladen:', fr.locator('#c').count() == 1)
    pg.evaluate("document.getElementById('f').contentWindow.postMessage({lgh:'ton', v:0.3, stumm:false}, '*')")
    pg.wait_for_timeout(500)
    print('\n'.join(l for l in logs if 'GPU stall' not in l))
    b.close()
