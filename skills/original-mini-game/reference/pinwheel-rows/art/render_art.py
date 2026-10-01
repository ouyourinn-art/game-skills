"""Render the store header (1920x1080) and icon (512x512) from the art pages."""
import os, pathlib, sys
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else here.parent / "www" / "taptap")
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("TAPTAP_CHROME_PATH") or None)
    for page_name, size, target in (("header.html", (1920, 1080), "header-1920x1080.png"), ("icon.html", (512, 512), "icon-512.png")):
        ctx = b.new_context(viewport={"width": size[0], "height": size[1]}, device_scale_factor=1)
        pg = ctx.new_page(); errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto((here / page_name).as_uri()); pg.wait_for_timeout(400)
        if errors: raise SystemExit(f"{page_name}: {errors}")
        pg.screenshot(path=str(out / target), type="png")
        ctx.close()
    b.close()
print("written to", out)
