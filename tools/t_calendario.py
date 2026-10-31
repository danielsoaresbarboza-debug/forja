"""3.14: natação/corrida do Galaxy Watch nas abas Natação e Corrida + calendário de treinos estilo ofensiva.
Simula o app Android (plugin ForjaSaude) com natação de ontem, corrida sem distância e musculação de hoje."""
import asyncio
from playwright.async_api import async_playwright
S='/home/claude/shots3'
MOCK=r"""
(()=>{const tk=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dd=n=>{const d=new Date();d.setDate(d.getDate()-n);d.setHours(7,0,0,0);return d;};
const ex=(id,tipo,n,min,kcal,extra)=>{const i=dd(n);const f=new Date(i.getTime()+min*60000);return Object.assign({id,tipo,title:tipo,start:i.toISOString(),end:f.toISOString(),min,kcal,app:'com.sec.android.app.shealth'},extra||{});};
const dias=[
 {date:tk(dd(0)),steps:5000,exercises:[ex('m0','musculacao',0,50,300)]},
 {date:tk(dd(1)),steps:7000,exercises:[ex('n1','natacao',1,40,380,{distM:1500,voltas:60,fcMedia:131.6,fcMax:158})]},
 {date:tk(dd(2)),steps:9000,exercises:[ex('c2','corrida',2,30,290,{distM:null})]},
 {date:tk(dd(4)),steps:6000,exercises:[ex('n4','natacao',4,35,320,{distM:1200})]},
];
window.Capacitor={isNativePlatform:()=>true,Plugins:{App:{addListener(){}},ForjaSaude:{
  status:async()=>({nativo:true,disponivel:true,autorizado:true,tudo:true,segundoPlano:true,horas:[8,12,15,21],ultima:new Date().toISOString()}),
  guardado:async()=>({dias}),ler:async()=>({dias}),autorizar:async()=>({autorizado:true}),abrirHealthConnect:async()=>{},
  googleToken:async()=>({token:'x'}),ouvir:async()=>({texto:''}),parar:async()=>{},addListener:async()=>({remove(){}})}}};
window.__semTour=true;})();
"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for tema in ('dark','light'):
      ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
      await ctx.add_init_script(MOCK)
      if tema=='light': await ctx.add_init_script("try{localStorage.setItem('forja-theme','light')}catch{}")
      pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
      await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','githubusercontent','fonts.g']) else r.continue_())
      await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(5000)
      if tema=='light': await pg.evaluate("document.body.dataset.theme='light'")
      nat=await pg.evaluate("(async()=>{const db=await claude.use('db');return (await db.collection('natacao').get()).docs.map(x=>x.data()).map(v=>[v.data,v.distancia_m,v.voltas,v.fc_media,v.origem])})()")
      cor=await pg.evaluate("(async()=>{const db=await claude.use('db');return (await db.collection('corridas').get()).docs.map(x=>x.data()).map(v=>[v.data,v.distancia_km,v.origem])})()")
      print(tema,'natação:',nat);print(tema,'corrida:',cor)
      await pg.evaluate("ForjaSaude.importar({silencioso:true})");await pg.wait_for_timeout(900)
      print(tema,'sem duplicar:',await pg.evaluate("(async()=>{const db=await claude.use('db');return [(await db.collection('natacao').get()).docs.length,(await db.collection('corridas').get()).docs.length]})()"))
      await pg.evaluate("switchTab('natacao')");await pg.wait_for_timeout(900)
      print(tema,'aba natação:',(await pg.evaluate("document.querySelector('#tab-natacao')?.innerText||''"))[:700].replace('\n',' | '))
      await pg.screenshot(path=f'{S}/cl-natacao-{tema}.png',full_page=False)
      await pg.evaluate("switchTab('academia')");await pg.wait_for_timeout(900)
      print(tema,'faixa semana:',await pg.evaluate("[...document.querySelectorAll('.semana .dias i')].map(i=>i.className||'-').join(',')"))
      await pg.click('.semana[role=button]');await pg.wait_for_timeout(900)
      print(tema,'folha:',(await pg.evaluate("document.querySelector('.cl')?.innerText||'(sem calendário)'"))[:260].replace('\n',' | '))
      cx=await pg.query_selector('.f3-caixa');await cx.screenshot(path=f'{S}/cl-folha-{tema}.png')
      # toca no dia de ontem
      await pg.evaluate("(()=>{const d=new Date();d.setDate(d.getDate()-1);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;if(d.getMonth()===new Date().getMonth())ForjaCalendario.dia(k,'cl-folha');})()");await pg.wait_for_timeout(500)
      print(tema,'detalhe ontem:',(await pg.evaluate("document.querySelector('#cl-folha .cl-det')?.innerText||''")).replace('\n',' | '))
      await cx.screenshot(path=f'{S}/cl-folha-dia-{tema}.png')
      await pg.evaluate("ForjaCalendario.mudar(-1,'cl-folha')");await pg.wait_for_timeout(400)
      print(tema,'mês anterior:',await pg.evaluate("document.querySelector('#cl-folha .cl-nav b')?.textContent"))
      await pg.evaluate("Forja3.fecharFolha()");await pg.wait_for_timeout(300)
      await pg.evaluate("switchTab('relatorios')");await pg.wait_for_timeout(900)
      card=await pg.query_selector('#gym-calendar-card')
      print(tema,'relatórios:',(await pg.evaluate("document.querySelector('#cl-relatorios .cl-top')?.innerText||'(vazio)'")).replace('\n',' | '))
      if card: await card.screenshot(path=f'{S}/cl-relatorios-{tema}.png')
      sw=await pg.evaluate("document.documentElement.scrollWidth");print(tema,'rolagem lateral:',sw>391)
      print(tema,'erros:',errs);await ctx.close()
    await b.close()
asyncio.run(main())
