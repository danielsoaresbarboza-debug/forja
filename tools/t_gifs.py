"""GIFs do ExerciseDB com a API simulada: baixa a lista (2 páginas), guarda, e mostra o GIF no detalhe do exercício."""
import asyncio, json, base64
from playwright.async_api import async_playwright
S='/home/claude/shots3'
P1={"success":True,"meta":{"total":4,"hasNextPage":True,"nextCursor":"b"},"data":[
 {"exerciseId":"a","name":"barbell bench press","targetMuscles":["pectorals"],"bodyParts":["chest"],"equipments":["barbell"]},
 {"exerciseId":"b","name":"dumbbell fly","targetMuscles":["pectorals"],"bodyParts":["chest"],"equipments":["dumbbell"]}]}
P2={"success":True,"meta":{"total":4,"hasNextPage":False},"data":[
 {"exerciseId":"c","name":"cable seated row","targetMuscles":["upper back"],"bodyParts":["back"],"equipments":["cable"]},
 {"exerciseId":"d","name":"lever leg extension","targetMuscles":["quads"],"bodyParts":["upper legs"],"equipments":["leverage machine"]}]+
 [{"exerciseId":f"x{i}","name":f"filler move {i}","targetMuscles":[],"bodyParts":[],"equipments":["body weight"]} for i in range(120)]}
GIF=base64.b64decode('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==')
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pedidos=[]
    async def router(route):
      u=route.request.url
      if 'oss.exercisedb.dev' in u:
        pedidos.append(u.split('?')[1] if '?' in u else '')
        body=P2 if 'after=' in u else P1
        return await route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
      if 'static.exercisedb.dev' in u: return await route.fulfill(status=200,content_type='image/gif',body=GIF)
      if any(k in u for k in ['googleapis','gstatic','accounts.google','wger.de','fonts.g']): return await route.abort()
      return await route.continue_()
    await pg.route('**/*',router)
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(2500)
    await pg.evaluate("ForjaGifs.atualizar()");await pg.wait_for_timeout(1500)
    print('pedidos:',pedidos)
    print('mais:',await pg.evaluate("document.getElementById('gifs3')?.innerText.replace(/\\n/g,' | ')"))
    await pg.evaluate("switchTab('biblioteca')");await pg.wait_for_timeout(500)
    await pg.evaluate("ForjaExerciseLibraryTab.showDetail('Barbell Bench Press - Medium Grip','free','Peito')");await pg.wait_for_timeout(800)
    print('gif no detalhe:',await pg.evaluate("document.querySelector('#lib-detail-card .edb img')?.src"),'| foto antiga junto?',await pg.evaluate("!!document.querySelector('#lib-detail-card .mov')"))
    await (await pg.query_selector('#lib-detail-card')).screenshot(path=f'{S}/gif1-detalhe.png')
    await pg.evaluate("ForjaExerciseLibraryTab.showDetail('Goblet Squat','free','Quadríceps')");await pg.wait_for_timeout(600)
    print('sem gif cai na foto:',await pg.evaluate("!document.querySelector('#lib-detail-card .edb')"))
    await pg.reload();await pg.wait_for_timeout(3000)
    print('lista guardada após recarregar:',await pg.evaluate("ForjaGifs.gif('Dumbbell Flyes')"))
    print('erros:',errs);await b.close()
asyncio.run(main())
