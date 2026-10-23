import asyncio,json
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent']) else r.continue_())
    await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_timeout(2500)
    await pg.evaluate("""(async()=>{
      const t=ForjaGymTraining;
      const groups=[{id:'gA',name:'Treino A',exercises:['Barbell Bench Press - Medium Grip','Pushups','Plank']},{id:'gB',name:'Treino B',exercises:['Seated Cable Rows','Barbell Curl']}];
      await t.storage().set('workout-groups-v1',JSON.stringify(groups));
      const d=new Date();d.setDate(d.getDate()-2);const k=todayKey(d);
      const w=[{id:'w1',date:k,time:'07:00',name:'Barbell Bench Press - Medium Grip',weight:'40|40|40',reps:'10,10,10',warmup:'0|0|0',rir:'||'},
               {id:'w2',date:k,time:'07:20',name:'Pushups',weight:'0|0|0',reps:'12,12,12',warmup:'0|0|0',rir:'||'},
               {id:'w3',date:k,time:'07:30',name:'Plank',weight:'0|0',reps:'45,45',warmup:'0|0',rir:'|'}];
      await t.storage().set('workouts',JSON.stringify(w));
      await t.storage().set('exercise-weight-mode',JSON.stringify({}));
    })()""")
    keys=await pg.evaluate("ForjaGymTraining.K_WORKOUTS")
    print('K_WORKOUTS',keys)
    await pg.reload(); await pg.wait_for_timeout(2500)
    await pg.evaluate("switchTab('academia')"); await pg.wait_for_timeout(1200)
    await pg.screenshot(path='/home/claude/shots3/h1.png')
    await pg.evaluate("ForjaGymUI.loadWorkoutGroupToSession('gB')"); await pg.wait_for_timeout(1200)
    await pg.evaluate("ForjaGymUI.endWorkoutSession()"); await pg.wait_for_timeout(1000)
    await pg.evaluate("document.getElementById('summary-overlay')?.remove()")
    await pg.evaluate("ForjaGymUI.loadWorkoutGroupToSession('gA')"); await pg.wait_for_timeout(1200)
    await pg.click('#ex-card-0'); await pg.wait_for_timeout(800)
    await pg.screenshot(path='/home/claude/shots3/h2.png')
    await pg.evaluate("ForjaGymUI.closeExSheet()"); await pg.wait_for_timeout(300)
    await pg.click('#session-stack .ex-row:has-text("Flexão")'); await pg.wait_for_timeout(800)
    await pg.screenshot(path='/home/claude/shots3/h3.png')
    print(errs)
    await b.close()
asyncio.run(main())
