/* Forja — Gráficos e evolução: peso, composição (balança OKOK), calorias × meta, proteína, água,
   treino por semana, passos, calorias ativas e sono (Samsung Health). Períodos de 30, 90 e 365 dias.
   Gráficos em SVG próprio (sem biblioteca). */
(function(root){
'use strict';
const doc=root.document,$=id=>doc.getElementById(id);
const S=()=>root.ForjaStorage||root.storage;
async function getJ(k,d){try{const r=await S().get(k);return r&&r.value?JSON.parse(r.value):d;}catch{return d;}}
const tk=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const pd=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12);};
const nf=(n,c=0)=>(Math.round(n*10**c)/10**c).toLocaleString('pt-BR',{minimumFractionDigits:c,maximumFractionDigits:c});
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const rot=k=>{const d=pd(k);return `${d.getDate()} ${MES[d.getMonth()]}`;};
const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return isNaN(n)?null:n;};
let periodo=30;

// ---------- desenho ----------
const W=340,H=130,PL=30,PR=8,PT=10,PB=20;
function escala(pts,meta){
  const ys=pts.map(p=>p.y).concat(meta!=null?[meta]:[]);let mn=Math.min(...ys),mx=Math.max(...ys);
  if(mn===mx){mn-=1;mx+=1;}const pad=(mx-mn)*0.12;return {mn:mn-pad,mx:mx+pad};
}
function eixoX(ini,fim){const span=Math.max(1,(pd(fim)-pd(ini))/864e5);return k=>PL+(pd(k)-pd(ini))/864e5/span*(W-PL-PR);}
function moldura(e,ini,fim,un){
  const Y=v=>PT+(e.mx-v)/(e.mx-e.mn)*(H-PT-PB);
  const g=[e.mx,(e.mx+e.mn)/2,e.mn].map(v=>`<line x1="${PL}" x2="${W-PR}" y1="${Y(v)}" y2="${Y(v)}" class="gr-grid"/><text x="${PL-4}" y="${Y(v)+4}" class="gr-y">${nf(v,Math.abs(e.mx-e.mn)<10?1:0)}</text>`).join('');
  return {Y,g:g+`<text x="${PL}" y="${H-4}" class="gr-x">${rot(ini)}</text><text x="${W-PR}" y="${H-4}" class="gr-x" text-anchor="end">${rot(fim)}</text>`};
}
function linha(pts,{ini,fim,meta,cor='var(--f3-corpo)',media7=true}){
  if(pts.length<2)return null;
  const e=escala(pts,meta);const X=eixoX(ini,fim);const {Y,g}=moldura(e,ini,fim);
  const d=pts.map(p=>`${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  let suave='';
  if(media7&&pts.length>=5){const m=pts.map((p,i)=>{const jan=pts.filter(q=>Math.abs((pd(q.x)-pd(p.x))/864e5)<=3);return {x:p.x,y:jan.reduce((a,b)=>a+b.y,0)/jan.length};});
    suave=`<polyline points="${m.map(p=>`${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}" class="gr-suave" style="stroke:${cor}"/>`;}
  return `<svg viewBox="0 0 ${W} ${H}" class="gr-svg" role="img">${g}${meta!=null?`<line x1="${PL}" x2="${W-PR}" y1="${Y(meta)}" y2="${Y(meta)}" class="gr-meta"/>`:''}
    <polyline points="${d}" class="gr-linha" style="stroke:${cor}"/>${suave}${pts.map(p=>`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${pts.length>60?1.6:2.6}" style="fill:${cor}"/>`).join('')}</svg>`;
}
function barras(pts,{ini,fim,meta,cor='var(--f3-comida)',acima='var(--f3-treino)'}){
  if(!pts.length)return null;
  const e=escala(pts.concat([{y:0}]),meta);e.mn=0;const X=eixoX(ini,fim);const {Y,g}=moldura(e,ini,fim);
  const dias=Math.max(1,(pd(fim)-pd(ini))/864e5);const bw=Math.max(1.5,Math.min(14,(W-PL-PR)/dias*0.7));
  return `<svg viewBox="0 0 ${W} ${H}" class="gr-svg" role="img">${g}${pts.map(p=>{const y=Y(p.y);const c=meta!=null&&p.y>meta*1.03&&acima?acima:cor;return `<rect x="${(X(p.x)-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,Y(0)-y).toFixed(1)}" rx="1.5" style="fill:${c}"/>`;}).join('')}
    ${meta!=null?`<line x1="${PL}" x2="${W-PR}" y1="${Y(meta)}" y2="${Y(meta)}" class="gr-meta"/>`:''}</svg>`;
}
function cartao(titulo,valor,sub,svg,nota){
  if(!svg)return '';
  return `<div class="f3-card gr-card"><div class="gr-top"><b>${titulo}</b><span>${valor}</span></div>${sub?`<small class="gr-sub">${sub}</small>`:''}${svg}${nota?`<p class="f3-nota">${nota}</p>`:''}</div>`;
}
function variacao(pts,c=1,un=''){if(pts.length<2)return '';const d=pts[pts.length-1].y-pts[0].y;return `${d>0?'+':''}${nf(d,c)}${un} no período`;}
const media=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;

// ---------- dados ----------
async function dados(){
  const fim=tk(new Date());const ini=tk(new Date(Date.now()-(periodo-1)*864e5));
  const dentro=k=>k>=ini&&k<=fim;
  const body=(await root.loadBody?.())||[];
  // peso: último do dia (registro manual, Samsung ou balança)
  const pesoDia={};
  body.filter(e=>e.type==='weight'&&dentro(e.date)).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).forEach(e=>{const v=num(e.value);if(v>25&&v<400)pesoDia[e.date]=v;});
  const scale=await (root.ForjaGymTraining?.loadScaleCache?.()||[]);
  const sc=(scale||[]).filter(e=>dentro(e.date)).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  sc.forEach(e=>{if(e.weightKg>25&&!pesoDia[e.date])pesoDia[e.date]=e.weightKg;});
  const saude=await getJ('f3-saude-dias',{});
  const gordura={};sc.forEach(e=>{if(e.bodyFatPct)gordura[e.date]=e.bodyFatPct;});
  Object.entries(saude).forEach(([k,v])=>{if(dentro(k)&&v.bodyFat&&!gordura[k])gordura[k]=v.bodyFat;});
  const musc={},visc={};sc.forEach(e=>{const m=e.skeletalMuscleKg||e.muscleMassKg;if(m)musc[e.date]=m;if(e.visceralFat)visc[e.date]=e.visceralFat;});
  // água
  const agua={};body.filter(e=>e.type==='water'&&dentro(e.date)).forEach(e=>{agua[e.date]=(agua[e.date]||0)+(root.waterMl?root.waterMl(e):Number(e.ml)||0);});
  // comida
  await root.loadDietCache?.();const dc=(typeof dietCache!=='undefined'?dietCache:[]); // eslint-disable-line no-undef
  const kcal={},prot={};dc.filter(e=>dentro(e.date)).forEach(e=>{kcal[e.date]=(kcal[e.date]||0)+(Number(e.kcal)||0);prot[e.date]=(prot[e.date]||0)+(Number(e.protein_g)||0);});
  const meta={};
  for(const k of Object.keys(kcal)){if(k===fim)continue;try{const s=await root.computeDietDaySummary(k);if(s.goal)meta[k]=Math.round(s.goal);}catch{}}
  // treino por semana
  const t=root.ForjaGymTraining;const semanas={};
  if(t){const arr=await t.loadWorkouts();arr.filter(e=>dentro(e.date)).forEach(e=>{
    const seg=t.getMonday(pd(e.date));const k=tk(seg);const s=semanas[k]=semanas[k]||{series:0,vol:0,dias:new Set()};
    const ws=t.parseWeightList(e.weight),rs=t.parseRepsList(e.reps),wu=t.parseWarmupList?t.parseWarmupList(e.warmup):[];
    rs.forEach((r,i)=>{if(wu[i])return;s.series++;s.vol+=(ws[i]||0)*(r||0);});s.dias.add(e.date);});}
  return {ini,fim,pesoDia,gordura,musc,visc,agua,kcal,prot,meta,semanas,saude:Object.fromEntries(Object.entries(saude).filter(([k])=>dentro(k)))};
}
const serie=obj=>Object.entries(obj).sort((a,b)=>a[0].localeCompare(b[0])).map(([x,y])=>({x,y}));

async function render(){
  const host=$('graf3');if(!host)return;
  host.innerHTML=`<div class="gr-per">${[[30,'30 dias'],[90,'3 meses'],[365,'1 ano']].map(([d,l])=>`<button type="button" class="${periodo===d?'on':''}" onclick="ForjaGraficos.periodo(${d})">${l}</button>`).join('')}</div><p class="f3-nota">Carregando…</p>`;
  const D=await dados();const o={ini:D.ini,fim:D.fim};
  const G=(typeof NUTRITION_GOAL!=='undefined'?NUTRITION_GOAL:{}); // eslint-disable-line no-undef
  const W2=(typeof waterDailyGoal!=='undefined'?waterDailyGoal:2000); // eslint-disable-line no-undef
  const peso=serie(D.pesoDia),gord=serie(D.gordura),musc=serie(D.musc),visc=serie(D.visc);
  const kc=serie(D.kcal).filter(p=>p.x!==D.fim);const pr=serie(D.prot);const ag=serie(D.agua).map(p=>({x:p.x,y:p.y/1000}));
  const metaMedia=Object.values(D.meta).length?Math.round(media(Object.values(D.meta))):null;
  const dentroMeta=kc.filter(p=>D.meta[p.x]&&p.y<=D.meta[p.x]*1.03).length;
  const sem=Object.entries(D.semanas).sort((a,b)=>a[0].localeCompare(b[0]));
  const passos=serie(Object.fromEntries(Object.entries(D.saude).filter(([,v])=>v.steps!=null).map(([k,v])=>[k,v.steps])));
  const ativas=serie(Object.fromEntries(Object.entries(D.saude).filter(([,v])=>v.activeKcal!=null).map(([k,v])=>[k,v.activeKcal])));
  const sono=serie(Object.fromEntries(Object.entries(D.saude).filter(([,v])=>v.sleepMin).map(([k,v])=>[k,v.sleepMin/60])));
  let h='';
  h+=cartao('⚖️ Peso',peso.length?`${nf(peso[peso.length-1].y,1)} kg`:'',variacao(peso,1,' kg'),linha(peso,{...o,cor:'var(--f3-corpo)'}),'Linha grossa: média de 7 dias, que tira o sobe e desce da água no corpo.');
  h+=cartao('🔥 Calorias comidas',kc.length?`média ${nf(media(kc.map(p=>p.y)))} kcal`:'',metaMedia?`meta média ${nf(metaMedia)} kcal · ${dentroMeta} de ${kc.length} dias dentro da meta`:'',barras(kc,{...o,meta:metaMedia}),'Vermelho: dia acima da meta. Hoje entra amanhã.');
  h+=cartao('🥩 Proteína',pr.length?`média ${nf(media(pr.map(p=>p.y)))} g`:'',G.protein_g?`meta ${nf(G.protein_g)} g/dia`:'',barras(pr,{...o,meta:G.protein_g||null,cor:'var(--f3-supl)',acima:null}));
  h+=cartao('💧 Água',ag.length?`média ${nf(media(ag.map(p=>p.y)),1)} L`:'',`meta ${nf(W2/1000,1)} L/dia`,barras(ag,{...o,meta:W2/1000,cor:'var(--f3-agua)',acima:null}));
  if(sem.length){
    const pts=sem.map(([k,v])=>({x:k,y:v.series}));
    h+=cartao('🏋️ Treino por semana',`${sem[sem.length-1][1].series} séries`,`${nf(media(sem.map(([,v])=>v.dias.size)),1)} dias de treino por semana · volume total ${nf(sem.reduce((a,[,v])=>a+v.vol,0)/1000,1)} t`,barras(pts,{...o,cor:'var(--f3-treino)',acima:null}),'Séries de trabalho por semana (aquecimento não conta).');
  }
  h+=cartao('📊 % de gordura',gord.length?`${nf(gord[gord.length-1].y,1)}%`:'',variacao(gord,1,' pontos'),linha(gord,{...o,cor:'var(--f3-supl)',media7:false}),'Da balança (OKOK) e do Samsung Health.');
  h+=cartao('💪 Massa muscular',musc.length?`${nf(musc[musc.length-1].y,1)} kg`:'',variacao(musc,1,' kg'),linha(musc,{...o,cor:'var(--f3-comida)',media7:false}));
  h+=cartao('🫀 Gordura visceral',visc.length?nf(visc[visc.length-1].y,0):'',variacao(visc,0),linha(visc,{...o,cor:'var(--f3-treino)',media7:false}));
  h+=cartao('👟 Passos',passos.length?`média ${nf(media(passos.map(p=>p.y)))}`:'','Samsung Health',barras(passos,{...o,cor:'var(--f3-agua)',acima:null}));
  h+=cartao('⚡ Calorias ativas',ativas.length?`média ${nf(media(ativas.map(p=>p.y)))} kcal`:'','Samsung Health',barras(ativas,{...o,cor:'var(--f3-treino)',acima:null}));
  h+=cartao('😴 Sono',sono.length?`média ${nf(media(sono.map(p=>p.y)),1)} h`:'','Samsung Health',barras(sono,{...o,meta:7,cor:'var(--f3-corpo)',acima:null}),'Linha: 7 horas.');
  if(!h)h='<div class="f3-card"><p class="f3-nota">Ainda não há dados neste período. Registre peso, comida e treinos que os gráficos aparecem aqui.</p></div>';
  host.innerHTML=`<div class="gr-per">${[[30,'30 dias'],[90,'3 meses'],[365,'1 ano']].map(([d,l])=>`<button type="button" class="${periodo===d?'on':''}" onclick="ForjaGraficos.periodo(${d})">${l}</button>`).join('')}</div>${h}`;
}
function setPeriodo(d){periodo=d;render();}
function abrir(){root.switchTab?.('graficos');}
root.ForjaGraficos={render,periodo:setPeriodo,abrir};
})(window);
