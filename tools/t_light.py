import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent']) else r.continue_())
    await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_timeout(3000)
    await pg.evaluate("document.body.dataset.theme='light'")
    for t in ['inicio','agua','dieta']:
      await pg.evaluate(f"switchTab('{t}')"); await pg.wait_for_timeout(600)
      await pg.screenshot(path=f'/home/claude/shots3/l-{t}.png')
    await b.close()
asyncio.run(main())
