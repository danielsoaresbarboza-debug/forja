"""Registra 4 séries e apaga a 2ª (toque no ✓ arma, 2º toque apaga), depois desfaz."""
import asyncio
from playwright.async_api import async_playwright
S='/home/claude/shots3'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent','fonts.g']) else r.continue_())
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(2500)
    await pg.evaluate("switchTab('academia')");await pg.wait_for_timeout(800)
    await pg.evaluate("ForjaGymUI.useReadyWorkout((window.ForjaReadyWorkouts||[])[0].id)");await pg.wait_for_timeout(800)
    await pg.click('.hj-go');await pg.wait_for_timeout(1500)
    await pg.click('#ex-card-0');await pg.wait_for_timeout(800)
    for k in range(4):
      if k==3: await pg.evaluate("ForjaGymUI.addPlannedSet(0)")
      await pg.wait_for_timeout(200)
      await pg.evaluate("ForjaGymUI.logSetForCard(0,%d)"%(8+k));await pg.wait_for_timeout(400)
      await pg.evaluate("ForjaGymUI.pularRest&&ForjaGymUI.pularRest(true)");await pg.wait_for_timeout(200)
    reps=lambda: pg.evaluate("(async()=>{const a=await ForjaGymTraining.loadWorkouts();return a.filter(e=>e.date===ForjaGymTraining.todayKey()).map(e=>e.reps)})()")
    print('antes:',await reps())
    await pg.click('#del-0-1');await pg.wait_for_timeout(300)
    await (await pg.query_selector('.sheet.v3')).screenshot(path=f'{S}/d1-armado.png')
    await pg.click('#del-0-1');await pg.wait_for_timeout(800)
    print('depois de apagar a 2ª:',await reps())
    await (await pg.query_selector('.sheet.v3')).screenshot(path=f'{S}/d2-apagado.png')
    await pg.click('button:visible:has-text("Desfazer")');await pg.wait_for_timeout(800)
    print('desfeito:',await reps())
    print('erros:',errs);await b.close()
asyncio.run(main())

async def ex():
  async with async_playwright() as p:
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844})
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent','fonts.g']) else r.continue_())
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(2500)
    await pg.evaluate("switchTab('academia')");await pg.wait_for_timeout(800)
    await pg.evaluate("ForjaGymUI.useReadyWorkout((window.ForjaReadyWorkouts||[])[0].id)");await pg.wait_for_timeout(800)
    await pg.click('.hj-go');await pg.wait_for_timeout(1500)
    n0=await pg.evaluate("document.querySelectorAll('#session-stack .ex-row').length")
    await pg.click('#ex-card-0');await pg.wait_for_timeout(800)
    await pg.evaluate("ForjaGymUI.logSetForCard(0,8)");await pg.wait_for_timeout(500);await pg.evaluate("ForjaGymUI.pularRest&&ForjaGymUI.pularRest(true)")
    await pg.click('#rmex-0');await pg.wait_for_timeout(200);await pg.click('#rmex-0');await pg.wait_for_timeout(900)
    n1=await pg.evaluate("document.querySelectorAll('#session-stack .ex-row').length")
    w=await pg.evaluate("(async()=>(await ForjaGymTraining.loadWorkouts()).filter(e=>e.date===ForjaGymTraining.todayKey()).length)()")
    print('exercícios',n0,'->',n1,'· registros hoje:',w)
    await pg.click('button:visible:has-text("Desfazer")');await pg.wait_for_timeout(800)
    print('desfeito:',await pg.evaluate("document.querySelectorAll('#session-stack .ex-row').length"),await pg.evaluate("(async()=>(await ForjaGymTraining.loadWorkouts()).filter(e=>e.date===ForjaGymTraining.todayKey()).length)()"))
    print('erros:',errs);await b.close()
asyncio.run(ex())
