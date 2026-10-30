"""Segurar o dedo num exercício (Biblioteca e treino em andamento) abre o popup com o GIF."""
import asyncio
from playwright.async_api import async_playwright
S='/home/claude/shots3'
async def segurar(pg,sel):
  el=await pg.query_selector(sel);await el.scroll_into_view_if_needed();bb=await el.bounding_box()
  await pg.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2);await pg.mouse.down();await pg.wait_for_timeout(650);await pg.mouse.up();await pg.wait_for_timeout(500)
  return await pg.evaluate("(()=>{const o=document.getElementById('ex-longpress-overlay');return o&&o.classList.contains('show')?[!!o.querySelector('.edb img'),o.querySelector('h3')?.textContent]:null})()")
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=False)
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    import base64
    GIF=base64.b64decode('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==')
    async def rota(r):
      u=r.request.url
      if 'static.exercisedb.dev' in u: return await r.fulfill(status=200,content_type='image/gif',body=GIF)
      if any(k in u for k in ['googleapis','gstatic','accounts.google','wger.de','fonts.g']): return await r.abort()
      return await r.continue_()
    await pg.route('**/*',rota)
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(3500);await pg.evaluate('ForjaGifs.carregar()')
    await pg.evaluate("switchTab('biblioteca')");await pg.wait_for_timeout(500)
    await pg.click('#tab-biblioteca .filter-chip[data-lib-filter="Peito"]');await pg.wait_for_timeout(800)
    print('biblioteca:',await segurar(pg,'#lib-catalog-list .ex-chip'))
    print('detalhe não abriu junto:',await pg.evaluate("document.getElementById('lib-detail-card').style.display!=='block'"))
    await pg.screenshot(path=f'{S}/hold1.png')
    await pg.evaluate("ForjaExerciseLongPress.close()");await pg.wait_for_timeout(300)
    await pg.evaluate("switchTab('academia')");await pg.wait_for_timeout(500)
    await pg.evaluate("ForjaGymUI.useReadyWorkout((window.ForjaReadyWorkouts||[])[0].id)");await pg.wait_for_timeout(600)
    await pg.click('.hj-go');await pg.wait_for_timeout(1500)
    print('treino:',await segurar(pg,'#session-stack .ex-row'))
    print('janela do exercício não abriu junto:',await pg.evaluate("!document.querySelector('.sheet.v3')||getComputedStyle(document.querySelector('.sheet.v3')).display==='none'"))
    print('erros:',errs);await b.close()
asyncio.run(main())
