"""Montar treino por músculo, treinos de sempre (A/B) e a semana."""
import asyncio
from playwright.async_api import async_playwright
S='/home/claude/shots3'
SEED=r"""
(async()=>{const t=ForjaGymTraining;const c=await t.loadMuscleCache();
const M={'Barbell Bench Press - Medium Grip':'Peito','Dumbbell Flyes':'Peito','Triceps Pushdown':'Tríceps','Seated Cable Rows':'Costas','Wide-Grip Lat Pulldown':'Costas','Barbell Curl':'Bíceps'};
for(const [n,m] of Object.entries(M))c[t.slug(n)]=m;await t.persistMuscleCache();
const arr=await t.loadWorkouts();const d=k=>{const x=new Date();x.setDate(x.getDate()-k);return t.todayKey?`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`:'';};
const add=(k,n,w,r)=>arr.push({id:t.cid(),date:d(k),time:'07:00',name:n,weight:w,reps:r,warmup:'',rir:''});
for(const k of [2,6,9]){add(k,'Barbell Bench Press - Medium Grip','60|60|60','10,9,8');add(k,'Dumbbell Flyes','14|14|14','12,12,10');add(k,'Triceps Pushdown','25|25|25','12,12,12');}
for(const k of [3,7]){add(k,'Seated Cable Rows','50|50|50','10,10,10');add(k,'Wide-Grip Lat Pulldown','55|55|55','10,10,9');add(k,'Barbell Curl','25|25','10,10');}
await t.saveWorkouts(arr);})()
"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','fonts.g','githubusercontent','exercisedb']) else r.continue_())
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(3000)
    await pg.evaluate(SEED);await pg.wait_for_timeout(500)
    await pg.evaluate("switchTab('academia')");await pg.wait_for_timeout(500)
    await pg.evaluate("ForjaGymUI.renderHoje()");await pg.wait_for_timeout(900)
    print('rotinas:',await pg.evaluate("[...document.querySelectorAll('.mt-rot button')].map(b=>b.innerText.replace(/\\n/g,' '))"))
    await pg.evaluate("window.scrollTo(0,0)");await (await pg.query_selector('#ac-hoje')).screenshot(path=f'{S}/mt0-hero.png')
    await pg.click('#ac-hoje .hj-go');await pg.wait_for_timeout(700)
    for m in ['Peito','Costas','Tríceps','Bíceps']:
      await pg.click(f'#mt-musc button:has-text("{m}")');await pg.wait_for_timeout(200)
    print('marcados:',await pg.evaluate("[...document.querySelectorAll('.mt-ex.on b')].map(b=>b.textContent)"))
    print('botão:',await pg.evaluate("document.getElementById('mt-go').textContent"))
    await pg.screenshot(path=f'{S}/mt1-folha.png')
    await (await pg.query_selector('#folha3 .f3-caixa, #folha3')).screenshot(path=f'{S}/mt1b-folha.png')
    await pg.click('#mt-go');await pg.wait_for_timeout(2500)
    print('no treino:',await pg.evaluate("[...document.querySelectorAll('#session-stack .ex-row .row-name')].map(e=>e.textContent)"),await pg.evaluate("document.getElementById('tr-nome')?.textContent"))
    await pg.evaluate("ForjaMontar.semana(0)");await pg.wait_for_timeout(600)
    print('semana:',await pg.evaluate("[...document.querySelectorAll('.sm-dia.f .sm-cab')].map(e=>e.innerText.replace(/\\n/g,' '))"))
    await pg.screenshot(path=f'{S}/mt2-semana.png')
    print('erros:',errs);await b.close()
asyncio.run(main())
