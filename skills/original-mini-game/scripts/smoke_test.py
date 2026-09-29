"""Generic smoke test for an offline HTML5 mini game.

Usage:  python smoke_test.py path/to/www [--out shots]

Checks that every game must pass before it is packaged:
  * index.html, style.css and game.js exist
  * no network references (the game must run fully offline inside the APK)
  * the page loads with no page errors or console errors/warnings
  * nothing overflows horizontally at a small (360x640) and a large (440x1020) phone size
It also saves a screenshot of each size for a human look.

Game-specific play-throughs (actually clearing levels) live in each game's own
playtest.py; see reference/tidepool-sort/playtest.py.
"""
import argparse
import functools
import http.server
import pathlib
import re
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

REQUIRED = ("index.html", "style.css", "game.js")
NETWORK = re.compile(r"https?://|//[a-z0-9.-]+\.[a-z]{2,}/", re.I)
SIZES = ((360, 640, "small"), (440, 1020, "large"))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("www")
    parser.add_argument("--out", default="shots")
    args = parser.parse_args()
    www = pathlib.Path(args.www).resolve()
    out = pathlib.Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    problems: list[str] = []

    for name in REQUIRED:
        if not (www / name).is_file():
            problems.append(f"missing {name}")
    for path in www.rglob("*"):
        if path.suffix.lower() in {".html", ".css", ".js", ".json", ".svg"}:
            text = path.read_text(encoding="utf-8", errors="replace")
            for match in NETWORK.finditer(text):
                # Namespace URIs inside SVG are not network requests.
                if "www.w3.org" in text[match.start():match.start() + 40]:
                    continue
                problems.append(f"network reference in {path.name}: {text[match.start():match.start() + 60]!r}")
                break
    if problems:
        print("\n".join(problems))
        return 1

    server = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(www)))
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for width, height, tag in SIZES:
                context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2)
                page = context.new_page()
                page.on("pageerror", lambda e, tag=tag: problems.append(f"{tag}: page error {e}"))
                page.on("console", lambda m, tag=tag: problems.append(f"{tag}: console {m.type}: {m.text}")
                        if m.type in ("error", "warning") else None)
                page.on("requestfailed", lambda r, tag=tag: problems.append(f"{tag}: request failed {r.url}"))
                page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="load")
                page.wait_for_timeout(500)
                overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                if overflow > 1:
                    problems.append(f"{tag}: page is {overflow}px wider than the screen")
                page.screenshot(path=str(out / f"{tag}.png"))
                context.close()
            browser.close()
    finally:
        server.shutdown()

    if problems:
        print("\n".join(problems))
        return 1
    print(f"OK: loads cleanly at {', '.join(f'{w}x{h}' for w, h, _ in SIZES)}; screenshots in {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
