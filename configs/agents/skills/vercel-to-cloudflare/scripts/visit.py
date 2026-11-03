import json
import shutil
import sys

from playwright.sync_api import sync_playwright

if len(sys.argv) < 2:
    print("usage: python3 visit.py <url> [url ...]", file=sys.stderr)
    sys.exit(1)

statuses = []
origin = "/".join(sys.argv[1].split("/")[:3])

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which("brave"))
    page = browser.new_page()
    # Brave sends Global Privacy Control, which makes spoar drop every event.
    page.add_init_script("Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => false })")
    page.on("response", lambda response: statuses.append(response.status) if response.url.startswith(origin) and "/_ra" in response.url else None)
    for url in sys.argv[1:]:
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(3000)
    page.goto("about:blank")
    page.wait_for_timeout(1000)
    browser.close()

print(json.dumps({"raStatuses": statuses}))
sys.exit(0 if statuses and all(status < 300 for status in statuses) else 2)
