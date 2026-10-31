import asyncio,json,sys
from playwright.async_api import async_playwright
TABS=['inicio','corrida','natacao','crossfit','academia','biblioteca','recompensas','relatorios','progresso','corpo','agua','dieta','cardapio','importar','mais']
async def run(p,page,w,ua=None,tabs=TABS):
  b=await p.chromium.launch()
  kw={'viewport':{'width':w,'height':844}}
  if ua: kw.update(p.devices['iPhone 13']); 
  ctx=await b.new_context(**kw); pg=await ctx.new_page()
  errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
  pg.on('console',lambda m:errs.append('console:'+m.text[:200]) if m.type=='error' and 'Failed to load' not in m.text else None)
  await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent']) else r.continue_())
  await pg.goto('http://localhost:8766/'+page); await pg.wait_for_timeout(3000)
  ok=0
  for t in tabs:
    await pg.evaluate(f"switchTab('{t}')"); await pg.wait_for_timeout(500)
    sw=await pg.evaluate("document.documentElement.scrollWidth"); vw=await pg.evaluate("innerWidth")
    fora=await pg.evaluate("[...document.querySelectorAll('.card')].filter(c=>{const r=c.getBoundingClientRect();return r.height>0&&!c.closest('[id^=tab-]')&&!c.closest('.f3-caixa,dialog,.modal')}).map(c=>c.id||c.className).slice(0,5)")
    if fora: errs.append(f'{t}: blocos fora da aba {fora}'); continue
    if sw>vw+1: errs.append(f'{t}: rolagem lateral {sw}>{vw}')
    else: ok+=1
  await b.close(); return ok,len(tabs),errs
async def main():
  async with async_playwright() as p:
    tot=0;n=0
    for page,tabs in [('index.html',TABS),('index-ess.html',['inicio','dieta','agua','atividade','corpo','dados','mais'])]:
      for w,ua in [(390,None),(800,None),(1440,None),(390,'ios')]:
        ok,k,errs=await run(p,page,w,ua,tabs); tot+=ok;n+=k
        print(page,w,ua or '', f'{ok}/{k}', errs[:6])
    print(f'TOTAL {tot}/{n}')
asyncio.run(main())
