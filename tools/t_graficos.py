"""Aba Gráficos com dados simulados de 60 dias."""
import asyncio
from playwright.async_api import async_playwright
S='/home/claude/shots3'
SEED=r"""
(async()=>{const d=k=>{const x=new Date();x.setDate(x.getDate()-k);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
const body=await loadBody();
for(let k=60;k>=0;k-=2)body.push({id:'w'+k,date:d(k),time:'07:00',type:'weight',period:'manha',value:String((84-(60-k)*0.04+Math.sin(k)*0.4).toFixed(1)).replace('.',',')});
for(let k=30;k>=1;k--)body.push({id:'a'+k,date:d(k),time:'10:00',type:'water',ml:1500+(k%4)*300});
await saveBody(body);await storage.set(K_BODY,JSON.stringify(body));
await loadDietCache();for(let k=30;k>=1;k--){dietCache.push({id:'d'+k,date:d(k),time:'12:00',mealType:'almoco',description:'teste',kcal:1800+(k%5)*120,protein_g:110+(k%3)*20});}await persistDietCache();
const t=ForjaGymTraining;const arr=await t.loadWorkouts();for(const k of [2,4,6,9,11,13,16,18,20,23,25,27]){arr.push({id:t.cid(),date:d(k),time:'07:00',name:'Barbell Bench Press - Medium Grip',weight:'60|60|60',reps:'10,9,8',warmup:'',rir:''});}await t.saveWorkouts(arr);
const sc=await t.loadScaleCache();for(const k of [55,40,25,10]){sc.push({id:t.cid(),date:d(k),time:'07:00',weightKg:84-(60-k)*0.04,bodyFatPct:22-(60-k)*0.03,skeletalMuscleKg:36+(60-k)*0.01,visceralFat:9});}await t.persistScaleCache();
const s={};for(let k=20;k>=0;k--)s[d(k)]={steps:6000+(k%5)*1500,activeKcal:350+(k%4)*90,sleepMin:380+(k%3)*40};await storage.set('f3-saude-dias',JSON.stringify(s));
})()
"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','fonts.g','githubusercontent','exercisedb']) else r.continue_())
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(3000)
    await pg.evaluate(SEED);await pg.wait_for_timeout(800)
    print('botão na navegação:',await pg.evaluate("!!document.querySelector('.tabs [data-tab=graficos]')"))
    await pg.evaluate("switchTab('graficos')");await pg.wait_for_timeout(2500)
    print('cartões:',await pg.evaluate("[...document.querySelectorAll('#graf3 .gr-top')].map(e=>e.innerText.replace(/\\n/g,' — '))"))
    await pg.screenshot(path=f'{S}/gr1.png',full_page=True)
    await pg.click('.gr-per button:has-text("3 meses")');await pg.wait_for_timeout(2500)
    print('90 dias, peso:',await pg.evaluate("document.querySelector('#graf3 .gr-sub')?.textContent"))
    print('erros:',errs);await b.close()
asyncio.run(main())
