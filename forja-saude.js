/* Forja — Samsung Health (via Health Connect), só dentro do app Android do Forja.
   O app nativo lê o Health Connect ao abrir e às 8h/12h/15h/21h (em segundo plano) e guarda um
   resumo por dia. Este módulo busca esse resumo e lança no Forja:
   treinos → atividades (somam na meta de comida) · peso → Corpo · % de gordura → Meus dados ·
   passos, calorias, sono → cartão do Início · água → só se o Samsung Health enviar. */
(function(root){
'use strict';
const doc=root.document,$=id=>doc.getElementById(id);
const S=()=>root.ForjaStorage||root.storage;
async function getJ(k,d){try{const r=await S().get(k);return r&&r.value?JSON.parse(r.value):d;}catch{return d;}}
async function setJ(k,v){await S().set(k,JSON.stringify(v));}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
const toast=(m,a)=>root.showToast?.(m,a);
const tk=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const hhmm=iso=>{try{const d=new Date(iso);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}catch{return '';}};
const horas=min=>{min=Math.round(min||0);const h=Math.floor(min/60),m=min%60;return h?`${h}h${m?String(m).padStart(2,'0'):''}`:`${m} min`;};
const APK='https://github.com/danielsoaresbarboza-debug/forja/releases/download/forja-android/Forja.apk';
const NOMES={corrida:'Corrida',caminhada:'Caminhada',spinning:'Bike',natacao:'Natação',musculacao:'Musculação',funcional:'Funcional',outro:'Treino'};

function plugin(){const C=root.Capacitor;return C&&C.isNativePlatform&&C.isNativePlatform()?C.Plugins?.ForjaSaude:null;}
let ocupado=false,ultimoStatus=null;

// ---------- lançar no Forja ----------
async function aplicar(dias){
  if(!Array.isArray(dias)||!dias.length)return {treinos:0,peso:0};
  const resumo=await getJ('f3-saude-dias',{});
  const acts=await getJ('f3-activities',[]);
  let body=await root.loadBody();let bodyMudou=false;
  const dados=await getJ('f3-dados',{});let dadosMudou=false;
  let novosTreinos=0,novoPeso=0;
  for(const d of dias){
    if(!d||!d.date)continue;
    resumo[d.date]={bodyFat:d.bodyFat&&d.bodyFat.pct||null,peso:d.weight&&d.weight.kg||null,steps:d.steps??null,activeKcal:d.activeKcal??null,totalKcal:d.totalKcal??null,sleepMin:d.sleepMin??null,em:new Date().toISOString()};
    for(const ex of (d.exercises||[])){
      const id='sh-'+ex.id;const i=acts.findIndex(a=>a.id===id);
      const item={id,date:d.date,time:hhmm(ex.start),tipo:ex.tipo||'outro',min:Math.round(ex.min||0),kcal:ex.kcal!=null?Math.round(ex.kcal):0,
        nota:'⌚ '+(ex.title||NOMES[ex.tipo]||'Treino')+' (Samsung Health)',fonte:'samsung'};
      if(i<0){acts.push(item);novosTreinos++;}else acts[i]={...acts[i],...item};
    }
    if(d.weight&&d.weight.kg){
      const id='sh-w-'+d.weight.id;
      if(!body.some(e=>e.id===id)){
        const h=new Date(d.weight.time).getHours();
        body.push({id,date:d.date,time:hhmm(d.weight.time),type:'weight',period:h<12?'manha':h<18?'tarde':'noite',value:String(d.weight.kg).replace('.',','),fonte:'samsung'});
        bodyMudou=true;novoPeso++;
      }
    }
    if(d.waterMl>0){
      const id='sh-agua-'+d.date;const i=body.findIndex(e=>e.id===id);
      const item={id,date:d.date,time:'23:59',type:'water',ml:Math.round(d.waterMl),fonte:'samsung'};
      if(i<0)body.push(item);else body[i]=item;bodyMudou=true;
    }
    if(d.bodyFat&&d.bodyFat.pct&&(!dados.gorduraRelogioEm||d.bodyFat.time>dados.gorduraRelogioEm)){
      dados.gorduraPct=d.bodyFat.pct;dados.gorduraRelogioEm=d.bodyFat.time;dadosMudou=true;
    }
    if(d.bmr&&d.bmr.kcal){dados.tmbRelogio=d.bmr.kcal;dadosMudou=true;}
  }
  await medicoes(dias,dados);
  try{await esportes(dias);}catch(e){console.warn('esportes',e);}
  // guarda só as últimas 30 datas do resumo
  const chaves=Object.keys(resumo).sort();chaves.slice(0,Math.max(0,chaves.length-30)).forEach(k=>delete resumo[k]);
  await setJ('f3-saude-dias',resumo);await setJ('f3-activities',acts);
  if(bodyMudou)await root.saveBody(body);
  if(dadosMudou)await setJ('f3-dados',dados);
  return {treinos:novosTreinos,peso:novoPeso};
}

// Medição corporal do relógio (Galaxy Watch, bioimpedância) → mesma lista da balança.
// O Samsung Health só repassa peso, % de gordura e metabolismo basal ao Health Connect;
// massa gorda, massa magra e IMC são calculados aqui a partir deles.
async function medicoes(dias,dados){
  const t=root.ForjaGymTraining;if(!t?.loadScaleCache)return 0;
  const scale=await t.loadScaleCache();let n=0;
  const alt=(Number(dados?.alturaCm)||0)/100;
  for(const d of dias){
    if(!d||!d.date||!(d.bodyFat&&d.bodyFat.pct))continue; // sem % de gordura não foi medição do relógio
    const kg=d.weight&&d.weight.kg||null;const pct=d.bodyFat.pct;
    const id='sh-bia-'+d.date;
    const item={id,date:d.date,time:hhmm(d.bodyFat.time)||'08:00',fonte:'samsung',bodyFatPct:pct,
      weightKg:kg,bmr:d.bmr&&d.bmr.kcal||null,
      fatMassKg:kg?Math.round(kg*pct/100*10)/10:null,lbmKg:kg?Math.round((kg-kg*pct/100)*10)/10:null,
      bmi:kg&&alt>1?Math.round(kg/(alt*alt)*10)/10:null};
    const i=scale.findIndex(e=>e.id===id);
    if(i<0){scale.push(item);n++;}else scale[i]={...scale[i],...item};
  }
  if(n||dias.some(d=>d&&d.bodyFat))await t.persistScaleCache();
  return n;
}
// Natação e corrida do relógio → abas Natação e Corrida (as calorias já contam pela Atividade,
// então esses registros têm origem 'samsung' e ficam fora da soma de calorias das abas).
async function esportes(dias){
  const db=root.claude?await root.claude.use('db'):null;if(!db)return 0;
  const cfg={natacao:{col:'natacao',campo:'distancia_m'},corrida:{col:'corridas',campo:'distancia_km'}};
  let n=0;const cache={};
  for(const d of dias){
    for(const ex of (d&&d.exercises)||[]){
      const c=cfg[ex.tipo];if(!c)continue;
      if(!cache[c.col]){const snap=await db.collection(c.col).get();cache[c.col]=snap.docs.map(x=>({id:x.id,...x.data()}));}
      const docs=cache[c.col];
      const dur=Math.max(60,Math.round((new Date(ex.end)-new Date(ex.start))/1000)||Math.round((ex.min||0)*60));
      const m=Number(ex.distM)||0;
      const doc={data:d.date,duracao_s:dur,calorias:ex.kcal!=null?Math.round(ex.kcal):null,origem:'samsung',shId:ex.id,hora:hhmm(ex.start)};
      if(ex.fcMedia)doc.fc_media=Math.round(ex.fcMedia);if(ex.fcMax)doc.fc_max=Math.round(ex.fcMax);
      if(c.col==='natacao'){doc.distancia_m=m;doc.ritmo_100m=m>0?dur/m*100:null;if(ex.voltas)doc.voltas=ex.voltas;}
      else{doc.distancia_km=Math.round(m/10)/100;doc.ritmo=m>0?dur/(m/1000):null;}
      const ja=docs.find(x=>x.shId===ex.id);
      if(ja){const patch={};for(const k in doc)if(doc[k]!=null&&ja[k]!==doc[k])patch[k]=doc[k];if(Object.keys(patch).length){await db.collection(c.col).doc(ja.id).update(patch);Object.assign(ja,patch);}continue;}
      // mesmo treino já lançado por print/manual no mesmo dia → só completa o que falta
      const par=docs.find(x=>x.data===d.date&&!x.shId&&(!(x[c.campo]>0)||!(doc[c.campo]>0)||Math.abs(x[c.campo]-doc[c.campo])<=Math.max(x[c.campo],doc[c.campo])*0.1));
      if(par){const patch={shId:ex.id};for(const k in doc)if(doc[k]!=null&&(par[k]==null||par[k]===0)&&k!=='origem')patch[k]=doc[k];await db.collection(c.col).doc(par.id).update(patch);Object.assign(par,patch);continue;}
      const ref=await db.collection(c.col).add(doc);docs.push({id:ref.id,...doc});n++;
    }
  }
  return n;
}
async function ultimaMedicao(){
  const t=root.ForjaGymTraining;if(!t?.loadScaleCache)return null;
  const s=(await t.loadScaleCache()).filter(e=>e.fonte==='samsung').sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  return s[0]||null;
}

async function importar({silencioso=true,ler=true}={}){
  const p=plugin();if(!p||ocupado)return null;ocupado=true;
  try{
    const g=await p.guardado().catch(()=>null);
    let r=await aplicar(g?.dias||[]);
    if(ler){
      const st=await p.status().catch(()=>null);ultimoStatus=st;
      if(st&&st.autorizado){const tem=Object.keys(await getJ('f3-saude-dias',{})).length>1;const lido=await p.ler({dias:tem?3:14});const r2=await aplicar(lido?.dias||[]);r={treinos:r.treinos+r2.treinos,peso:r.peso+r2.peso};}
    }
    const partes=[];if(r.treinos)partes.push(`${r.treinos} treino${r.treinos>1?'s':''}`);if(r.peso)partes.push('peso');
    if(partes.length)toast(`⌚ Do Samsung Health: ${partes.join(' e ')}`);
    else if(!silencioso)toast('⌚ Samsung Health em dia.');
    try{await root.renderDashboard?.();await root.Forja3?.renderHome?.();await root.renderBody?.();}catch{}
    await render();
    return r;
  }catch(e){if(!silencioso)toast('Não consegui ler o Samsung Health: '+(e.message||'erro'));return null;}
  finally{ocupado=false;}
}

// ---------- Início: linha do dia ----------
async function linhaHome(){
  if(!plugin())return '';
  const r=(await getJ('f3-saude-dias',{}))[tk()];if(!r)return '';
  const p=[];if(r.steps!=null)p.push(`👟 ${nf(r.steps)} passos`);if(r.activeKcal!=null)p.push(`🔥 ${nf(r.activeKcal)} kcal ativas`);if(r.sleepMin)p.push(`😴 ${horas(r.sleepMin)}`);
  return p.length?`<div class="saude-linha">⌚ ${p.join(' · ')}</div>`:'';
}

// ---------- cartão em Mais ----------
async function render(){
  const host=$('saude3');if(!host)return;
  const p=plugin();
  if(!p){
    host.innerHTML=`<div class="f3-t">⌚ Samsung Health</div>
      <p class="f3-nota">Treinos do relógio, passos, peso, % de gordura e sono entram sozinhos no Forja quando você usa o <b>app Android do Forja</b> (aqui no navegador não dá: só um app instalado lê o Samsung Health).</p>
      <a class="f3-cta sec saude-baixar" href="${APK}">⬇ Baixar o app Android</a>
      <p class="f3-nota">Depois de instalar, abra o app, toque em "Entrar com Google" para trazer seus dados e autorize o Samsung Health aqui.</p>`;
    return;
  }
  const st=ultimoStatus||await p.status().catch(()=>null);ultimoStatus=st;
  const dt=iso=>{if(!iso)return '—';const d=new Date(iso);return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});};
  let corpo='';
  if(!st||!st.disponivel){
    corpo=`<p class="f3-nota">${st&&st.precisaAtualizar?'Atualize o Health Connect na Play Store.':'Este celular não tem o Health Connect ativo.'}</p><button type="button" class="f3-cta" onclick="ForjaSaude.autorizar()">Instalar / atualizar Health Connect</button>`;
  }else if(!st.autorizado){
    corpo=`<ol class="saude-passos"><li>No <b>Samsung Health</b>: ⋮ → Configurações → <b>Health Connect</b> → permitir tudo.</li><li>Aqui: toque em <b>Autorizar</b> e ligue tudo, inclusive <b>"acessar em segundo plano"</b>.</li></ol>
      <button type="button" class="f3-cta" onclick="ForjaSaude.autorizar()">Autorizar o Forja</button>`;
  }else{
    corpo=`<div class="saude-st"><div><small>Última leitura</small><b>${dt(st.ultima)}</b></div><div><small>Próxima automática</small><b>${dt(st.proxima)}</b></div></div>
      <p class="f3-nota">Lê sozinho às ${(st.horas||[8,12,15,21]).map(h=>h+'h').join(', ')} e sempre que você abre o app.${st.segundoPlano?'':' <b>Falta ligar "acessar em segundo plano"</b> para funcionar com o app fechado.'}${st.tudo?'':' Algumas permissões estão desligadas.'}</p>
      <button type="button" class="f3-cta" onclick="ForjaSaude.sincronizar()">⌚ Sincronizar agora</button>
      <button type="button" class="f3-cta sec" onclick="ForjaSaude.permissoes()">Permissões no Health Connect</button>
      <p class="f3-nota">A água não vem: o Samsung Health não envia água para o Health Connect. Continue pelo +250 ml.</p>`;
  }
  host.innerHTML=`<div class="f3-t">⌚ Samsung Health</div>${corpo}`;
}
async function autorizar(){const p=plugin();if(!p)return;try{ultimoStatus=await p.autorizar();await render();if(ultimoStatus?.autorizado)await importar({silencioso:false});}catch(e){toast(e.message||'Não consegui abrir as permissões.');}}
async function permissoes(){try{await plugin()?.abrirHealthConnect();}catch{}}
async function sincronizar(){await importar({silencioso:false});}

function montar(){
  const mais=$('tab-mais');if(!mais||$('saude3')||doc.body.dataset.forjaVariant==='essencial')return;
  const d=doc.createElement('div');d.id='saude3';d.className='f3-card saude3';
  const ref=$('sheet-sync-card');if(ref)ref.before(d);else mais.prepend(d);
}
async function init(){
  montar();await render();
  const p=plugin();if(!p)return;
  await importar({silencioso:true});
  try{root.Capacitor.Plugins.App?.addListener?.('resume',()=>importar({silencioso:true}));}catch{}
}

root.ForjaSaude={init,importar,aplicar,medicoes,esportes,ultimaMedicao,render,linhaHome,autorizar,permissoes,sincronizar,plugin};
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>setTimeout(init,1500));else setTimeout(init,1500);
})(window);
