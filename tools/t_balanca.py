"""Balança: Bluetooth (plugin simulado) + prints com Gemini simulado."""
import asyncio,json,base64
from playwright.async_api import async_playwright
S='/home/claude/shots3'
MOCK=r"""window.__semTour=true;
window.Capacitor={isNativePlatform:()=>true,Plugins:{ForjaSaude:{
 _l:null,addListener(n,f){this._l=f;return Promise.resolve({remove(){}});},
 balanca(){return new Promise(r=>{let k=0;const v=[60.2,78.1,81.3,81.4];const it=setInterval(()=>{this._l&&this._l({kg:v[k],final:false});if(++k>=v.length){clearInterval(it);r({kg:81.4,final:true,impedancia:512.3,modelo:'OKOK V20'});}},150);});},
 pararBalanca(){return Promise.resolve();},
 status(){return Promise.resolve({disponivel:true,autorizado:false});},guardado(){return Promise.resolve({dias:[]});}
}}};"""
GEM={"candidates":[{"content":{"parts":[{"text":json.dumps({"date":None,"weightKg":81.4,"bmi":25.1,"bodyFatPct":21.3,"fatMassKg":17.3,"skeletalMusclePct":None,"skeletalMuscleKg":34.2,"muscleMassKg":60.6,"waterPct":56.8,"waterKg":None,"visceralFat":8,"boneKg":3.2,"bmr":1745,"proteinPct":17.9,"obesityPct":None,"metabolicAge":31,"lbmKg":64.1})}]}}]}
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    await ctx.add_init_script(MOCK)
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    async def rota(r):
      u=r.request.url
      if 'generativelanguage' in u: return await r.fulfill(status=200,content_type='application/json',body=json.dumps(GEM))
      if any(k in u for k in ['googleapis','gstatic','accounts.google','wger.de','fonts.g','githubusercontent','exercisedb']): return await r.abort()
      await r.continue_()
    await pg.route('**/*',rota)
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(3000)
    await pg.evaluate("ForjaStorage.set('gemini-api-key','TESTE')")
    await pg.evaluate("switchTab('corpo')");await pg.wait_for_timeout(800)
    print('botão:',await pg.evaluate("document.getElementById('bal3')?.textContent"))
    await pg.click('#bal3');await pg.wait_for_timeout(400)
    await pg.click('#bal-bt-btn');await pg.wait_for_timeout(1500)
    print('ao vivo:',await pg.evaluate("document.getElementById('bal-kg').textContent+' | '+document.getElementById('bal-msg').textContent"))
    await pg.screenshot(path=f'{S}/bal1.png')
    print('peso no Corpo:',await pg.evaluate("loadBody().then(a=>a.filter(e=>e.type==='weight').map(e=>e.value+' '+e.fonte))"))
    await pg.set_input_files('#bal-file',files=[{'name':'a.png','mimeType':'image/png','buffer':PNG},{'name':'b.png','mimeType':'image/png','buffer':PNG}])
    await pg.wait_for_timeout(1500)
    print('status:',await pg.evaluate("document.getElementById('bal-status').textContent"))
    print('gordura lida:',await pg.evaluate("document.getElementById('scale-ocr-bodyFatPct')?.textContent"))
    await pg.screenshot(path=f'{S}/bal2.png')
    await pg.click('#bal-review button.primary');await pg.wait_for_timeout(600)
    print('balança:',await pg.evaluate("ForjaGymTraining.loadScaleCache().then(a=>a.map(e=>[e.fonte,e.weightKg,e.impedancia,e.bodyFatPct,e.visceralFat]))"))
    print('pesos:',await pg.evaluate("loadBody().then(a=>a.filter(e=>e.type==='weight').length)"))
    print('erros:',errs);await b.close()
asyncio.run(main())
