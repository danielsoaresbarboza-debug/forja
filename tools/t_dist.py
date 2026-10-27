import asyncio,re,os
VER=re.search(r"CURRENT_VERSION='([^']+)'",open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'changelog.js')).read()).group(1)
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for site,tab in [(f'forja-treino-{VER}','academia'),(f'forja-essencial-{VER}','atividade')]:
      ctx=await b.new_context(**p.devices['iPhone 13']); pg=await ctx.new_page(); errs=[]
      pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
      await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent']) else r.continue_())
      await pg.goto(f'http://localhost:8770/{site}/index.html'); await pg.wait_for_timeout(3500)
      info=await pg.evaluate("({v:document.body.dataset.forjaVariant,t:document.title,ver:ForjaChangelog.CURRENT_VERSION,sw:!!navigator.serviceWorker.controller||'registrando'})")
      await pg.evaluate(f"switchTab('{tab}')"); await pg.wait_for_timeout(800)
      await pg.screenshot(path=f'/home/claude/shots3/d-{site}.png')
      print(site,info,errs)
      await ctx.close()
    await b.close()
asyncio.run(main())
