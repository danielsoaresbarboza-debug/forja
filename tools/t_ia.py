"""Cartão "O que você comeu?" com um Gemini falso: liga a chave, calcula por texto (com troca de
modelo quando o primeiro dá 404), tira um item, lança no almoço e testa o áudio com microfone falso."""
import asyncio, json
from playwright.async_api import async_playwright
S='/home/claude/shots3'
PEDIDOS=[]
RESP={"transcricao":"","refeicao":"almoco","items":[
  {"name":"Arroz branco","qty":"4 colheres de sopa","grams":100,"kcal":128,"protein_g":2.5,"carbs_g":28,"fat_g":0.2},
  {"name":"Feijão carioca","qty":"1 concha","grams":86,"kcal":66,"protein_g":4.1,"carbs_g":11.6,"fat_g":0.5},
  {"name":"Frango grelhado","qty":"1 filé médio","grams":120,"kcal":190,"protein_g":38,"carbs_g":0,"fat_g":3.7},
  {"name":"Refrigerante","qty":"1 lata","grams":350,"kcal":149,"protein_g":0,"carbs_g":37,"fat_g":0}],"note":"Porções médias."}
async def gemini(route):
  url=route.request.url;body=json.loads(route.request.post_data or '{}')
  PEDIDOS.append((url.split('/models/')[1].split(':')[0],[list(p.keys())[0]+(':'+p['inline_data']['mime_type'] if 'inline_data' in p else '') for p in body['contents'][0]['parts']]))
  if 'gemini-flash-latest' in url: return await route.fulfill(status=404,body='{"error":{"message":"not found"}}')
  r=dict(RESP)
  if any('inline_data' in p and p['inline_data']['mime_type']=='audio/wav' for p in body['contents'][0]['parts']):
    r=dict(RESP,transcricao='comi um pão de queijo e um café',items=[{"name":"Pão de queijo","qty":"2 unidades","grams":50,"kcal":160,"protein_g":3,"carbs_g":20,"fat_g":7}])
  await route.fulfill(status=200,content_type='application/json',body=json.dumps({"candidates":[{"content":{"parts":[{"text":json.dumps(r)}]}}]}))
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,permissions=['microphone'])
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    async def router(route):
      u=route.request.url
      if 'generativelanguage.googleapis.com' in u: return await gemini(route)
      if any(k in u for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent','fonts.g']): return await route.abort()
      return await route.continue_()
    await pg.route('**/*',router)
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(2500)
    await pg.evaluate("switchTab('dieta')");await pg.wait_for_timeout(800)
    await (await pg.query_selector('#ia3')).screenshot(path=f'{S}/ia0-sem-chave.png')
    await pg.fill('#ia-chave-in','AIzaTESTE-1234567890-abcdefghijk');await pg.click('.ia-liga-row button');await pg.wait_for_timeout(500)
    await pg.fill('#ia-texto','almocei arroz, feijão, um filé de frango e uma coca lata')
    await pg.click('#ia-calc');await pg.wait_for_timeout(1200)
    await (await pg.query_selector('#ia3')).screenshot(path=f'{S}/ia1-resultado.png')
    print('modelos tentados:',[x[0] for x in PEDIDOS],'· salvo:',await pg.evaluate("(async()=>(await storage.get('gemini-model-ok'))?.value)()"))
    print('itens:',await pg.evaluate("[...document.querySelectorAll('.ia-it b')].map(e=>e.textContent)"),'· refeição:',await pg.evaluate("document.querySelector('.ia-refs .on')?.textContent"))
    await pg.click('.ia-it:has-text("Refrigerante") button');await pg.wait_for_timeout(300)
    print('botão:',await pg.evaluate("document.querySelector('#ia-res .f3-cta').textContent"))
    await pg.click('#ia-res .f3-cta');await pg.wait_for_timeout(1000)
    print('lançado:',await pg.evaluate("(async()=>{await loadDietCache();return dietCache.filter(e=>e.date===todayKey()).map(e=>[e.mealType,e.kcal,e.protein_g,e.description.slice(0,40)])})()"))
    print('status:',await pg.evaluate("document.getElementById('ia-status').textContent"))
    # áudio
    PEDIDOS.clear()
    await pg.click('#ia-gravar');await pg.wait_for_timeout(2200);await pg.click('#ia-gravar');await pg.wait_for_timeout(2500)
    print('áudio enviado:',PEDIDOS[-1] if PEDIDOS else None)
    print('transcrição no campo:',await pg.evaluate("document.getElementById('ia-texto').value"))
    print('itens áudio:',await pg.evaluate("[...document.querySelectorAll('.ia-it b')].map(e=>e.textContent)"))
    await pg.evaluate("window.scrollTo(0,0)");await pg.screenshot(path=f'{S}/ia2-comida.png',full_page=True)
    await pg.evaluate("document.body.dataset.theme='light'");await pg.wait_for_timeout(200)
    await (await pg.query_selector('#ia3')).screenshot(path=f'{S}/ia3-claro.png')
    print('erros:',errs);await b.close()
asyncio.run(main())
