import functools, http.server, os, socketserver, threading
from playwright.sync_api import sync_playwright
PORT = 8767
os.makedirs("shots", exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Q, directory="www"))
threading.Thread(target=srv.serve_forever, daemon=True).start()
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("TAPTAP_CHROME_PATH") or None)
    for vw, vh, tag in [(440, 1020, "large"), (360, 640, "small")]:
        ctx = b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(f"{tag} pageerror {e}"))
        pg.on("console", lambda m: errors.append(f"{tag} console {m.type}: {m.text}") if m.type in ("error", "warning") else None)
        pg.goto(f"http://127.0.0.1:{PORT}/index.html")
        pg.wait_for_timeout(300)
        pg.screenshot(path=f"shots/{tag}-menu.png")
        pg.click("#play-btn")
        for lvl in (1, 2, 3):
            assert pg.inner_text("#level-title") == f"Garden {lvl}"
            path = pg.evaluate("solve(state.tiles, state.rows, state.cols)")
            if lvl == 3:
                pg.click(f'[data-wheel="{path[0]}"]'); pg.wait_for_timeout(300)
                pg.screenshot(path=f"shots/{tag}-playing.png")
                path = path[1:]
            for w in path:
                pg.click(f'[data-wheel="{w}"]')
            pg.wait_for_timeout(500)
            assert pg.is_visible("#result"), "result not shown"
            print(tag, "garden", lvl, "moves", pg.evaluate("state.moves"), pg.inner_text("#result-stars"), pg.inner_text("#result-text"))
            if lvl == 1: pg.screenshot(path=f"shots/{tag}-win.png")
            pg.click("#next")
        # undo / hint / restart on garden 4
        t0 = pg.evaluate("state.tiles.join('')")
        pg.click('[data-wheel="0"]')
        assert pg.evaluate("state.moves") == 1 and pg.evaluate("state.tiles.join('')") != t0
        pg.click("#undo"); assert pg.evaluate("state.tiles.join('')") == t0, "undo failed"
        pg.click("#hint"); assert pg.locator(".pinwheel.hint").count() == 1, "no hint"
        pg.click("#restart"); assert pg.evaluate("state.moves") == 0
        # hint far from solution still works on the biggest garden
        pg.evaluate("startLevel(30)")
        pg.wait_for_timeout(200)
        board = pg.locator("#board").bounding_box(); tools = pg.locator(".tools").bounding_box()
        print(tag, "G30 board", round(board["x"]), round(board["x"] + board["width"]), "bottom", round(board["y"] + board["height"]), "tools top", round(tools["y"]), "viewport", vw, vh)
        assert board["x"] >= 0 and board["x"] + board["width"] <= vw, "board overflows horizontally"
        assert board["y"] + board["height"] <= tools["y"] + 1, "board overlaps toolbar"
        assert pg.evaluate("document.documentElement.scrollWidth") <= vw
        pg.screenshot(path=f"shots/{tag}-g30.png")
        for w in (0, 4, 8, 2, 6):
            pg.click(f'[data-wheel="{w}"]')
        pg.click("#hint"); print(tag, "hint after wandering:", pg.inner_text("#toast"))
        # finish garden 30 with the solver to see the final result card
        path = pg.evaluate("solve(state.tiles, state.rows, state.cols, 5, 4)")
        for w in path: pg.click(f'[data-wheel="{w}"]')
        pg.wait_for_timeout(500)
        assert pg.is_visible("#result") and not pg.is_visible("#next"), "last garden should end without Next"
        # persistence
        pg.reload(); pg.click("#levels-btn")
        starred = [n for n in range(1, 31) if "★" in pg.inner_text(f'[data-level="{n}"] .st')]
        print(tag, "gardens with stars after reload", starred)
        assert starred == [1, 2, 3, 30], starred  # every garden is open; stars record progress
        pg.screenshot(path=f"shots/{tag}-levels.png")
        ctx.close()
    # wide screens (tablet sideways, the 1920x1080 store video): bar | bed | tools, nothing overlaps
    for vw, vh in ((960, 540), (1920, 1080), (1280, 800)):
        ctx = b.new_context(viewport={"width": vw, "height": vh})
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(f"wide pageerror {e}"))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.click("#levels-btn"); pg.click('[data-level="30"]')
        pg.wait_for_timeout(200)
        bed = pg.locator(".planter").bounding_box(); bar = pg.locator("#screen-play .bar").bounding_box()
        tools = pg.locator(".tools").bounding_box()
        assert bar["x"] + bar["width"] <= bed["x"] and bed["x"] + bed["width"] <= tools["x"], (bar, bed, tools)
        assert bed["y"] >= 0 and bed["y"] + bed["height"] <= vh, bed
        path = pg.evaluate("solve(state.tiles, state.rows, state.cols)")
        for w in path: pg.click(f'[data-wheel="{w}"]')
        pg.wait_for_timeout(600)
        card = pg.locator("#result .card").bounding_box()
        assert card["x"] >= bed["x"] + bed["width"] - 1, ("result card covers the bed", card, bed)
        print("wide", vw, vh, "bed", round(bed["width"]), "x", round(bed["height"]), "ok")
        pg.screenshot(path=f"shots/wide-{vw}.png")
        ctx.close()
    # storage unavailable
    ctx = b.new_context(viewport={"width": 360, "height": 640})
    ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(f"nostorage pageerror {e}"))
    pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.click("#play-btn")
    path = pg.evaluate("solve(state.tiles, state.rows, state.cols)")
    for w in path: pg.click(f'[data-wheel="{w}"]')
    pg.wait_for_timeout(500); assert pg.is_visible("#result"); print("no storage: garden 1 finished")
    ctx.close()
    b.close()
srv.shutdown()
print("ERRORS:", errors or "none")
