import json, subprocess, sys, time, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
PORT=8765
handler=functools.partial(http.server.SimpleHTTPRequestHandler, directory="www")
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=socketserver.TCPServer(("127.0.0.1",PORT), functools.partial(Q, directory="www"))
threading.Thread(target=srv.serve_forever,daemon=True).start()
errors=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for vw,vh,tag in [(440,1020,"large"),(360,640,"small")]:
        ctx=b.new_context(viewport={"width":vw,"height":vh}, device_scale_factor=2)
        pg=ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(f"{tag} pageerror {e}"))
        pg.on("console", lambda m: errors.append(f"{tag} console {m.type}: {m.text}") if m.type in ("error","warning") else None)
        pg.goto(f"http://127.0.0.1:{PORT}/index.html")
        pg.screenshot(path=f"shot-{tag}-menu.png")
        pg.click("#play-btn")
        for lvl in (1,2,3):
            title=pg.inner_text("#level-title"); assert title==f"Pool {lvl}", title
            path=pg.evaluate("solve(state.pools)")
            for f,t in path:
                pg.click(f'[data-pool="{f}"]'); pg.click(f'[data-pool="{t}"]')
            assert pg.is_visible("#result"), "result not shown"
            txt=pg.inner_text("#result-text"); stars=pg.inner_text("#result-stars")
            print(tag,"level",lvl,"moves",len(path),stars,txt)
            if lvl==1: pg.screenshot(path=f"shot-{tag}-win.png")
            pg.click("#next")
        # undo / hint / restart on level 4
        pools0=pg.evaluate("JSON.stringify(state.pools)")
        path=pg.evaluate("solve(state.pools)")
        f,t=path[0]; pg.click(f'[data-pool="{f}"]'); pg.click(f'[data-pool="{t}"]')
        assert pg.evaluate("state.moves")==1
        pg.click("#undo"); assert pg.evaluate("JSON.stringify(state.pools)")==pools0, "undo failed"
        assert pg.inner_text("#undo")=="Undo (2)"
        pg.click("#hint"); assert pg.evaluate("state.hint!==null"), "no hint"
        assert pg.locator(".pool.hint").count()==2
        pg.click("#restart"); assert pg.evaluate("state.moves")==0
        # jump to a big level to check layout fits
        pg.evaluate("startLevel(29)")
        box=pg.locator(".pool").last.bounding_box(); tools=pg.locator(".tools").bounding_box()
        print(tag,"L29 pools",pg.locator(".pool").count(),"last pool bottom",round(box["y"]+box["height"]),"tools top",round(tools["y"]),"viewport",vh)
        assert box["y"]+box["height"] <= tools["y"]+1, "pools overlap toolbar"
        pg.screenshot(path=f"shot-{tag}-l29.png")
        # persistence
        pg.reload(); pg.click("#levels-btn")
        unlocked=pg.locator(".level:not([disabled])").count()
        print(tag,"unlocked after reload",unlocked, "stars L1", pg.locator(".level").first.inner_text().replace("\n"," "))
        assert unlocked==4
        pg.screenshot(path=f"shot-{tag}-levels.png")
        ctx.close()
    b.close()
srv.shutdown()
print("ERRORS:",errors or "none")
