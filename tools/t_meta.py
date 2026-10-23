import asyncio,json
from playwright.async_api import async_playwright
S='/home/claude/shots3'
EX=json.load(open('/home/claude/pietra/pietra-exame-2026-09-17.json'))
async def run(p,page,tag,exame):
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent','fonts.g']) else r.continue_())
    await pg.goto('http://localhost:8766/'+page);await pg.wait_for_timeout(2500)
    if exame: await pg.evaluate(f"Forja3.aplicarExame({json.dumps(EX)})")
    # pesos passados: 5 semanas
    await pg.evaluate("""(async()=>{const a=await loadBody();const base=%s;for(let i=35;i>=1;i-=4){const d=new Date(Date.now()-i*864e5);a.push({id:'w'+i,date:todayKey(d),time:'08:00',type:'weight',period:'manha',value:String((base+i*0.03).toFixed(1)).replace('.',',')});}await saveBody(a);})()"""%('80.5' if exame else '84'))
    await pg.evaluate("switchTab('inicio')");await pg.wait_for_timeout(700)
    await (await pg.query_selector('.mt-home')).screenshot(path=f'{S}/{tag}-m0-home.png')
    await pg.click('.mt-home');await pg.wait_for_timeout(1200)
    await pg.screenshot(path=f'{S}/{tag}-m1.png',full_page=True)
    if not exame:
        print(tag,'falta dado?',await pg.evaluate("!!document.querySelector('#tab-meta .campos3')"))
        await pg.fill('#tab-meta .campos3 input >> nth=0','178');await pg.press('#tab-meta .campos3 input >> nth=0','Tab');await pg.wait_for_timeout(500)
        await pg.fill('#tab-meta .campos3 input >> nth=1','33');await pg.press('#tab-meta .campos3 input >> nth=1','Tab');await pg.wait_for_timeout(800)
    await pg.click('.mt-seg button:has-text("Até uma data")');await pg.wait_for_timeout(500)
    await pg.click('#tab-meta .chips-min button:has-text("1 mês")');await pg.wait_for_timeout(600)
    await pg.screenshot(path=f'{S}/{tag}-m2-data.png',full_page=True)
    print(tag,'avisos 1 mês:',await pg.evaluate("[...document.querySelectorAll('.mt-aviso')].map(e=>e.textContent.trim().slice(0,90))"))
    await pg.click('.mt-seg button:has-text("No meu ritmo")');await pg.wait_for_timeout(500)
    await pg.click('.mt-ritmos button:has-text("Recomendado")');await pg.wait_for_timeout(600)
    print(tag,'plano:',await pg.evaluate("document.querySelector('.mt-quando')?.innerText.replace(/\\n/g,' | ')"),'||',await pg.evaluate("document.querySelector('.mt-conta')?.innerText.replace(/\\n/g,' ')"))
    await pg.click('#tab-meta .f3-cta:has-text("Salvar meta")');await pg.wait_for_timeout(1200)
    await pg.screenshot(path=f'{S}/{tag}-m3-salvo.png',full_page=True)
    print(tag,'metas:',await pg.evaluate("(async()=>JSON.parse((await storage.get('f3-metas')).value))()"))
    print(tag,'meta do dia:',await pg.evaluate("(async()=>(await computeDietDaySummary(todayKey())).goal)()"))
    await pg.evaluate("switchTab('inicio')");await pg.wait_for_timeout(700)
    await pg.screenshot(path=f'{S}/{tag}-m4-inicio.png',full_page=True)
    await pg.evaluate("document.body.dataset.theme='light'");await pg.evaluate("switchTab('meta')");await pg.wait_for_timeout(800)
    await pg.screenshot(path=f'{S}/{tag}-m5-claro.png',full_page=True)
    print(tag,'erros:',errs);await b.close()
async def main():
    async with async_playwright() as p:
        await run(p,'index-ess.html','ess',True)
        await run(p,'index.html','full',False)
asyncio.run(main())
