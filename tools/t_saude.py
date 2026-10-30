"""Simula o app Android (Capacitor + plugin ForjaSaude) e confere se os dados do Samsung Health entram no Forja:
treino vira atividade (e soma na meta), peso vai pro Corpo, % de gordura pra Meus dados, passos/sono no Início.
Também confere que no navegador comum aparece o botão de baixar o app."""
import asyncio, json
from playwright.async_api import async_playwright
S='/home/claude/shots3'
MOCK=r"""
(()=>{const hoje=new Date();const tk=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const H=tk(hoje);const ini=new Date(hoje);ini.setHours(7,10,0,0);const fim=new Date(ini.getTime()+52*60000);
const dia={date:H,steps:8432,activeKcal:520,totalKcal:2480,sleepMin:440,
  exercises:[{id:'abc1',tipo:'musculacao',exerciseType:70,title:'Musculação',start:ini.toISOString(),end:fim.toISOString(),min:52,kcal:310,app:'com.sec.android.app.shealth'}],
  weight:{id:'w1',kg:82.4,time:new Date(hoje.setHours(7,0,0,0)).toISOString()},bodyFat:{id:'f1',pct:21.3,time:new Date().toISOString()},bmr:{kcal:1790,time:new Date().toISOString()}};
window.__chamadas=[];
window.Capacitor={isNativePlatform:()=>true,Plugins:{App:{addListener(){}},ForjaSaude:{
  status:async()=>({nativo:true,disponivel:true,autorizado:true,tudo:true,segundoPlano:true,horas:[8,12,15,21],ultima:new Date().toISOString(),proxima:new Date(Date.now()+3*3600e3).toISOString()}),
  guardado:async()=>({dias:[dia]}),
  ler:async(o)=>{window.__chamadas.push('ler');return {dias:[dia]};},
  autorizar:async()=>({autorizado:true}),abrirHealthConnect:async()=>{},
  googleToken:async(o)=>{window.__chamadas.push('google:'+o.interativo);return {token:'tok-nativo'};},
  ouvir:async()=>({texto:'dois ovos e um pão'}),parar:async()=>{},addListener:async(n,f)=>({remove(){}})}}};
window.__semTour=true;})();
"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for nativo in (True,False):
      ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
      await ctx.add_init_script(MOCK if nativo else "window.__semTour=true;")
      pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
      await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent','fonts.g']) else r.continue_())
      await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(4500)
      if nativo:
        print('chamadas:',await pg.evaluate("window.__chamadas"))
        print('atividades:',await pg.evaluate("(async()=>JSON.parse((await storage.get('f3-activities')).value).map(a=>[a.id,a.tipo,a.min,a.kcal]))()"))
        print('kcal de atividade hoje:',await pg.evaluate("Forja3.activityKcal(todayKey())"))
        print('peso:',await pg.evaluate("(async()=>(await loadBody()).filter(e=>e.type==='weight').map(e=>[e.id,e.value,e.period]))()"))
        print('gordura:',await pg.evaluate("(async()=>{const d=JSON.parse((await storage.get('f3-dados')).value);return [d.gorduraPct,d.tmbRelogio]})()"))
        await pg.evaluate("ForjaSaude.importar({silencioso:true})");await pg.wait_for_timeout(800)
        print('sem duplicar:',await pg.evaluate("(async()=>JSON.parse((await storage.get('f3-activities')).value).length)()"),await pg.evaluate("(async()=>(await loadBody()).filter(e=>e.type==='weight').length)()"))
        await pg.evaluate("switchTab('inicio')");await pg.wait_for_timeout(700)
        print('linha do início:',await pg.evaluate("document.querySelector('.saude-linha')?.textContent"))
        await (await pg.query_selector('.hoje3-p')).screenshot(path=f'{S}/sh1-inicio.png')
        tok=await pg.evaluate("ForjaGoogleDirect.getToken(true)")
        print('token google nativo:',tok,await pg.evaluate("window.__chamadas.filter(c=>c.startsWith('google'))"))
        await pg.evaluate("switchTab('dieta')");await pg.wait_for_timeout(500)
        await pg.click('#ia-ditar');await pg.wait_for_timeout(500)
        print('ditado nativo:',await pg.evaluate("document.getElementById('ia-texto').value"))
      await pg.evaluate("switchTab('mais')");await pg.wait_for_timeout(700)
      card=await pg.query_selector('#saude3')
      print('cartão Mais (nativo=%s):'%nativo,(await card.inner_text())[:160].replace('\n',' | '))
      await card.screenshot(path=f'{S}/sh2-mais-{"app" if nativo else "web"}.png')
      print('erros:',errs);await ctx.close()
    await b.close()
asyncio.run(main())
