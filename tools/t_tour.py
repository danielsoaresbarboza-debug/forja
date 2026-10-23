import asyncio,json,sys
from playwright.async_api import async_playwright
EX=json.load(open('/home/claude/pietra/pietra-exame-2026-09-17.json'))
async def run(p,page,pfx):
  b=await p.chromium.launch(); ctx=await b.new_context(**p.devices['iPhone 13']); pg=await ctx.new_page()
  errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
  await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent']) else r.continue_())
  await pg.goto('http://localhost:8766/'+page); await pg.wait_for_timeout(3500)
  await pg.screenshot(path=f'/home/claude/shots3/{pfx}-00-bv.png')
  if pfx=='te':
    await pg.evaluate("document.getElementById('tour3-bv')?.remove()")
    await pg.evaluate(f"Forja3.aplicarExame({json.dumps(EX)})"); await pg.wait_for_timeout(300)
    await pg.evaluate("ForjaTour.iniciar()")
  else:
    await pg.click('.bv-sim')
  n=0;info=[]
  while True:
    await pg.wait_for_timeout(700)
    t=await pg.evaluate("(()=>{const b=document.getElementById('tour3-balao');if(!b)return null;const m=document.getElementById('tour3-moldura').getBoundingClientRect();const r=b.getBoundingClientRect();return {pp:b.querySelector('.t3-pp').textContent,h:b.querySelector('h3').textContent,m:[Math.round(m.top),Math.round(m.height)],b:[Math.round(r.top),Math.round(r.bottom)],vh:innerHeight}})()")
    if not t: break
    info.append(t); n+=1
    await pg.screenshot(path=f'/home/claude/shots3/{pfx}-{n:02d}.png')
    await pg.click('#tour3-balao .t3-prox')
    if n>30: break
  for x in info: print(x)
  print(pfx,'passos',n,'erros',errs)
  await b.close()
async def main():
  async with async_playwright() as p:
    await run(p,'index.html','tf'); await run(p,'index-ess.html','te')
asyncio.run(main())
