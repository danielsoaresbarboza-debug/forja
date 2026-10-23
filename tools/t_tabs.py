import asyncio,sys,json
from playwright.async_api import async_playwright
S='/home/claude/shots3'
PAGE=sys.argv[1] if len(sys.argv)>1 else 'index.html'
PFX=sys.argv[2] if len(sys.argv)>2 else 'f'
TABS=sys.argv[3].split(',') if len(sys.argv)>3 else ['inicio','agua','dieta','corpo','mais']
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append('console:'+m.text[:300]) if m.type in('error','warning') and 'Failed to load' not in m.text else None)
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent']) else r.continue_())
    await pg.goto('http://localhost:8766/'+PAGE); await pg.wait_for_timeout(3000)
    for t in TABS:
      await pg.evaluate(f"switchTab('{t}')"); await pg.wait_for_timeout(1000)
      await pg.screenshot(path=f'{S}/{PFX}-{t}.png',full_page=True)
      w=await pg.evaluate("document.documentElement.scrollWidth"); 
      if w>390: errs.append(f'overflow {t} {w}')
    print('ERROS',json.dumps(errs,ensure_ascii=False,indent=1))
    await b.close()
asyncio.run(main())
