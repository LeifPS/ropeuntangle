import sys, json, time
from playwright.sync_api import sync_playwright
import http.server, threading, socketserver, os, functools

PORT = 8765
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(os.path.dirname(__file__), '..', 'public'))
class Q(Handler.func):
    def log_message(self, *a): pass
Handler = functools.partial(Q, directory=os.path.join(os.path.dirname(__file__), '..', 'public'))
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

def start(p, w, h, touch=False):
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page()
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
    return b, pg, logs
