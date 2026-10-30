/* Forja — GIFs dos exercícios de musculação pela API grátis do ExerciseDB (v1: 1.500 exercícios,
   sem chave). Na primeira vez o app baixa a lista (nome, músculo, equipamento, id do GIF) e guarda no
   aparelho; o GIF em si é carregado direto do ExerciseDB quando você abre o exercício.
   No app Android usa o HTTP nativo (sem bloqueio de CORS); no navegador tenta o fetch normal. */
(function(root){
'use strict';
const API='https://oss.exercisedb.dev/api/v1/exercises';
const GIF=id=>`https://static.exercisedb.dev/media/${id}.gif`;
const K='edb-indice-v1';
const S=()=>root.ForjaStorage||root.storage;
let indice=null,carregando=null,progresso=0;

const STOP=new Set(['with','the','a','on','of','to','and','for','in','version','variation','exercise','style','medium','grip','v','s']);
const SIN={dumbbells:'dumbbell',db:'dumbbell',barbells:'barbell',bb:'barbell',machine:'lever',lever:'lever',cables:'cable',bands:'band',band:'band',resistance:'band',bodyweight:'body',weight:'',flyes:'fly',flies:'fly',flye:'fly',rows:'row',raises:'raise',curls:'curl',presses:'press',extensions:'extension',pulldowns:'pulldown',crunches:'crunch',squats:'squat',lunges:'lunge',dips:'dip',pushups:'pushup','push':'push',ups:'up',pullups:'pullup',kettlebells:'kettlebell',ez:'ez',bicep:'biceps',tricep:'triceps',lat:'lat',lats:'lat',bar:'barbell'};
const EQUIP=new Set(['dumbbell','barbell','lever','cable','band','body','kettlebell','smith','ez','sled','medicine','stability','trap','roller']);
function tokens(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\b(push|pull|chin|sit|step)[\s-]?ups?\b/g,'$1up').replace(/[^a-z0-9 ]+/g,' ').split(/\s+/)
    .map(w=>SIN[w]!==undefined?SIN[w]:w).map(w=>w.length>4&&w.endsWith('s')&&!w.endsWith('ss')&&!['biceps','triceps'].includes(w)?w.slice(0,-1):w)
    .filter(w=>w&&!STOP.has(w));
}
function prepara(lista){return lista.map(([id,nome,alvo,parte,equip])=>{const t=new Set(tokens(nome));return {id,nome,alvo,parte,equip,t,eq:[...t].filter(x=>EQUIP.has(x))};});}

let ultimoErro='';
async function http(url){
  const C=root.Capacitor;const erros=[];
  if(C&&C.isNativePlatform&&C.isNativePlatform()&&C.Plugins&&C.Plugins.CapacitorHttp){
    try{
      const r=await C.Plugins.CapacitorHttp.request({url,method:'GET',responseType:'json',
        headers:{'Accept':'application/json','User-Agent':root.navigator.userAgent||'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36'}});
      if(r.status&&r.status>=400)throw Error('HTTP '+r.status);
      const d=typeof r.data==='string'?JSON.parse(r.data):r.data;
      if(d&&Array.isArray(d.data))return d;
      throw Error('resposta inesperada');
    }catch(e){erros.push('nativo: '+(e.message||e));}
  }
  try{const r=await root.fetch(url,{headers:{'Accept':'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}
  catch(e){erros.push('web: '+(e.message||e));}
  ultimoErro=erros.join(' · ');throw Error(ultimoErro);
}
async function baixar(onProg){
  const itens=[];let depois=null;
  for(let i=0;i<80;i++){
    let j=null;
    for(let t=0;t<6&&!j;t++){
      try{j=await http(API+'?limit=25'+(depois?'&after='+encodeURIComponent(depois):''));}
      catch(e){if(t===5)throw e;await new Promise(r=>setTimeout(r,8000*(t+1)));} // o ExerciseDB limita pedidos seguidos
    }
    (j.data||[]).forEach(e=>itens.push([e.exerciseId,e.name,(e.targetMuscles||[])[0]||'',(e.bodyParts||[])[0]||'',(e.equipments||[])[0]||'']));
    progresso=itens.length;onProg&&onProg(itens.length,j.meta&&j.meta.total);
    if(!j.meta||!j.meta.hasNextPage||!j.meta.nextCursor)break;
    depois=j.meta.nextCursor;await new Promise(r=>setTimeout(r,2500));
  }
  if(itens.length<100)throw Error('lista incompleta');
  return itens;
}
async function carregar({forcar=false,onProg}={}){
  if(indice&&!forcar)return indice;
  if(carregando)return carregando;
  carregando=(async()=>{
    try{
      if(!forcar){const r=await S().get(K);if(r&&r.value){const o=JSON.parse(r.value);if(o.itens&&o.itens.length>100&&Date.now()-o.em<60*864e5){indice=prepara(o.itens);return indice;}}}
    }catch{}
    let itens=null;
    // 1º: a lista que o GitHub baixou e guardou junto do site (mesmo endereço, sem bloqueio)
    try{const r=await root.fetch('edb-index.json',{cache:'no-cache'});if(r.ok){const o=await r.json();if(o.itens&&o.itens.length>1000)itens=o.itens;}}catch{}
    // 2º: direto do ExerciseDB
    if(!itens)itens=await baixar(onProg);
    try{await S().set(K,JSON.stringify({em:Date.now(),itens}));}catch{}
    indice=prepara(itens);return indice;
  })();
  try{return await carregando;}finally{carregando=null;}
}

/** nome em inglês da base (ou em português, se for um exercício próprio) → item do ExerciseDB */
const cache=new Map();
function achar(nome){
  if(!indice||!nome)return null;
  if(cache.has(nome))return cache.get(nome);
  let alvo=nome;
  // exercício próprio em português: tenta achar o nome em inglês da biblioteca
  const dn=root.ForjaExerciseNames&&root.ForjaExerciseNames.display;
  if(dn&&/[ãõçáéíóúâê]|supino|rosca|agachamento|remada|puxada|desenvolvimento|elevacao|elevação|crucifixo|cadeira|mesa|panturrilha|abdominal|flexao|flexão|triceps|tríceps/i.test(nome)){
    const n=nome.toLowerCase();
    const r=(root.ForjaFreeExerciseLibrary||[]).find(x=>String(dn(x[1])).toLowerCase()===n)||(root.ForjaGymCatalog||[]).find(x=>String(dn(x[0])).toLowerCase()===n);
    if(r)alvo=r[1]&&r.length>5?r[1]:r[0];
  }
  const t=new Set(tokens(alvo));if(!t.size){cache.set(nome,null);return null;}
  let eq=[...t].filter(x=>EQUIP.has(x));
  // sem equipamento no nome: usa o equipamento que a própria biblioteca do app conhece
  let soCorpo=false;
  if(!eq.length){
    const nn=String(alvo).toLowerCase();
    const r=(root.ForjaFreeExerciseLibrary||[]).find(x=>String(x[1]).toLowerCase()===nn);
    const c=r?r[4]:((root.ForjaGymCatalog||[]).find(x=>String(x[0]).toLowerCase()===nn)||[])[3];
    const MAPA={'Halteres':['dumbbell'],'Barra':['barbell'],'Barra W':['ez','barbell'],'Máquina':['lever','sled'],'Polia':['cable'],'Kettlebell':['kettlebell'],'Elástico':['band']};
    if(c&&MAPA[c])eq=MAPA[c];else if(c==='Peso corporal')soCorpo=true;
  }
  let melhor=null,nota=0;
  for(const it of indice){
    if(eq.length&&it.eq.length&&!eq.some(e=>it.eq.includes(e)))continue;
    if(soCorpo&&it.eq.length&&!it.eq.includes('body'))continue;
    let inter=0;t.forEach(w=>{if(it.t.has(w))inter++;});if(!inter)continue;
    const tam=[...t].some(x=>EQUIP.has(x))?it.t.size:it.t.size-it.eq.length; // sem equipamento no nome: não penaliza o do ExerciseDB
    const dice=2*inter/(t.size+Math.max(1,tam));
    if(inter/t.size<0.6)continue; // a maior parte do nome precisa bater (evita 'goblet squat' → 'smith squat')
    if(dice>nota+1e-9||(Math.abs(dice-nota)<1e-9&&melhor&&it.t.size<melhor.t.size)){nota=dice;melhor=it;}
  }
  const r=nota>=0.66?melhor:null;cache.set(nome,r);return r;
}
function gif(nome){const r=achar(nome);return r?GIF(r.id):null;}
/** HTML do GIF (com crédito) ou null */
function html(nome,cls){
  const r=achar(nome);if(!r)return null;
  return `<figure class="edb ${cls||''}"><img src="${GIF(r.id)}" alt="Execução: ${String(r.nome).replace(/"/g,'')}" loading="lazy" onerror="this.closest('figure').remove()"><figcaption>GIF: ExerciseDB${r.alvo?` · alvo: ${r.alvo}`:''}</figcaption></figure>`;
}

// Mais: estado e botão de atualizar
async function render(){
  const host=root.document.getElementById('gifs3');if(!host)return;
  const n=indice?indice.length:0;
  host.innerHTML=`<div class="f3-t">🎞️ GIFs dos exercícios</div>
    <p class="f3-nota">${n?`${n.toLocaleString('pt-BR')} exercícios de musculação com GIF (ExerciseDB, grátis). Aparecem ao abrir um exercício.`:carregando?`Baixando a lista… ${progresso} de 1.500`:'Baixe a lista uma vez (precisa de internet). Os GIFs aparecem ao abrir um exercício.'}</p>${!n&&ultimoErro?`<p class="f3-nota" style="color:var(--f3-treino)">Não deu certo (${ultimoErro.replace(/[<>]/g,'')}). Me mande um print disto.</p>`:''}
    <button type="button" class="f3-cta sec" onclick="ForjaGifs.atualizar()">${n?'Atualizar lista':'Baixar lista de GIFs'}</button>`;
}
async function atualizar(){
  try{root.showToast?.('Baixando a lista de GIFs…');const p=carregar({forcar:!!indice,onProg:()=>render()});render();await p;root.showToast?.(`🎞️ ${indice.length} exercícios com GIF prontos.`);}
  catch(e){ultimoErro=ultimoErro||e.message||'erro';root.showToast?.('Não consegui baixar os GIFs. Detalhe no cartão.');}
  render();
}
function montar(){
  const mais=root.document.getElementById('tab-mais');if(!mais||root.document.getElementById('gifs3'))return;
  const d=root.document.createElement('div');d.id='gifs3';d.className='f3-card gifs3';
  // fica no lugar do cartão antigo (chave paga da RapidAPI), que some
  const velho=root.document.getElementById('exdb-key-card');
  if(velho)velho.before(d);else{const ref=root.document.getElementById('saude3')||root.document.getElementById('sheet-sync-card');if(ref)ref.after(d);else mais.appendChild(d);}
}
async function init(){
  montar();
  try{const r=await S().get(K);if(r&&r.value){const o=JSON.parse(r.value);if(o.itens)indice=prepara(o.itens);}}catch{}
  render();
  // primeira vez: baixa sozinho em segundo plano (60 pedidos pequenos)
  if(!indice)carregar({onProg:()=>render()}).then(render).catch(()=>render()); // a lista vem junto do site: carrega na hora
}
root.ForjaGifs={carregar,achar,gif,html,render,atualizar,init,tokens,_set:(lista)=>{indice=prepara(lista);cache.clear();}};
if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1200));else setTimeout(init,1200);
})(window);
