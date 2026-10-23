import asyncio,json
from playwright.async_api import async_playwright
S='/home/claude/shots3'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append('console:'+m.text[:300]) if m.type in('error','warning') and 'Failed to load' not in m.text else None)
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent']) else r.continue_())
    await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_timeout(3000)
    await pg.click('.supl-c3 button:has-text("Whey")'); await pg.wait_for_timeout(900)
    await pg.click('.supl-c3 button:has-text("Creatina")'); await pg.wait_for_timeout(700)
    await pg.click('.bento4 .az'); await pg.wait_for_timeout(700)
    await pg.click('#toast button'); await pg.wait_for_timeout(700)
    w=await pg.evaluate("(async()=>{const a=await loadBody();return a.filter(e=>e.type==='water').length})()")
    d=await pg.evaluate("(async()=>{await loadDietCache();return dietCache.map(e=>[e.description,e.kcal,e.mealType])})()")
    c=await pg.evaluate("(async()=>{const r=await storage.get('creatine-days-v1');return r&&r.value})()")
    print('agua entradas',w,'dieta',d,'creatina',c)
    await pg.screenshot(path=f'{S}/g1-inicio.png',full_page=True)
    # mais / metas
    await pg.evaluate("switchTab('mais')"); await pg.wait_for_timeout(800)
    await pg.screenshot(path=f'{S}/g2-mais.png')
    # trocar
    await pg.evaluate("switchTab('dieta')"); await pg.wait_for_timeout(500)
    await pg.click('#sb-trocar'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=f'{S}/g3-trocar.png')
    # desktop
    await pg.set_viewport_size({'width':1440,'height':900}); await pg.evaluate("switchTab('inicio')"); await pg.wait_for_timeout(800)
    await pg.screenshot(path=f'{S}/g4-desk.png')
    await pg.evaluate("switchTab('academia')"); await pg.wait_for_timeout(800)
    await pg.screenshot(path=f'{S}/g5-desk-ac.png')
    print('ERROS',json.dumps(errs,ensure_ascii=False,indent=1))
    await b.close()
asyncio.run(main())
