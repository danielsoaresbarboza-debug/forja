"""Whey marcado no Início lança o shake (225 kcal) na comida do dia; desmarcar tira. Whey antigo (120 kcal) é atualizado."""
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844})
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent','fonts.g','exercisedb']) else r.continue_())
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(2500)
    await pg.evaluate("storage.set('f3-supl',JSON.stringify([{id:'creatina',nome:'Creatina',dose:'5 g',tipo:'creatina'},{id:'whey',nome:'Whey',dose:'1 scoop',kcal:120,protein_g:24,carbs_g:3,fat_g:1}]))")
    dia="(async()=>{await loadDietCache();return dietCache.filter(e=>e.date===todayKey()).map(e=>[e.description,e.kcal,e.protein_g,e.mealType])})()"
    await pg.evaluate("Forja3.toggleSupl('whey')");await pg.wait_for_timeout(800)
    print('marcado:',await pg.evaluate(dia))
    print('meta-resumo:',await pg.evaluate("(async()=>(await computeDietDaySummary(todayKey())).comido)()"))
    await pg.evaluate("Forja3.toggleSupl('whey')");await pg.wait_for_timeout(800)
    print('desmarcado:',await pg.evaluate(dia))
    print('erros:',errs);await b.close()
asyncio.run(main())
