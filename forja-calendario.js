/* Forja — Calendário de treinos (estilo "ofensiva"): todo tipo de treino num lugar só.
   Fontes: séries da academia, sessões, atividades (inclui as do Galaxy Watch) e as abas
   Corrida / Natação / CrossFit. Dias treinados seguidos viram uma faixa contínua. */
(function(root){
'use strict';
const doc=root.document,$=id=>doc.getElementById(id);
const S=()=>root.ForjaStorage||root.storage;
async function getJ(k,d){try{const r=await S().get(k);return r&&r.value?JSON.parse(r.value):d;}catch{return d;}}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tk=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const pd=k=>{const [a,m,d]=k.split('-').map(Number);return new Date(a,m-1,d);};
const nf=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const TIPOS={academia:['🏋️','Academia'],musculacao:['🏋️','Musculação'],natacao:['🏊','Natação'],corrida:['🏃','Corrida'],
  caminhada:['🚶','Caminhada'],spinning:['🚴','Bike'],funcional:['🔥','Funcional'],crossfit:['🔥','CrossFit'],outro:['✳️','Treino']};
const tipoDe=k=>TIPOS[k]||TIPOS.outro;
const ESTADOS={};const est=id=>ESTADOS[id]=ESTADOS[id]||{mes:null,sel:null};

// ---------- juntar tudo por dia ----------
async function dados(){
  const dias={};const dia=k=>dias[k]=dias[k]||{tipos:[],itens:[]};
  const addTipo=(k,t)=>{const d=dia(k);const g=t==='musculacao'?'academia':t;if(!d.tipos.includes(g))d.tipos.push(g);};
  const t=root.ForjaGymTraining;
  try{
    if(t){await t.loadMuscleCache?.();
      const ws=await t.loadWorkouts();const por={};
      ws.forEach(e=>{if(!e.date)return;const p=por[e.date]=por[e.date]||{n:new Set(),m:new Set()};const nome=(e.name||'').trim();if(nome)p.n.add(nome);const m=t.getMuscleSync?.(nome);if(m&&m!=='Cardio')p.m.add(m);});
      Object.entries(por).forEach(([k,p])=>{addTipo(k,'academia');dia(k).itens.push({ic:'🏋️',t:'Academia',s:`${[...p.m].slice(0,4).join(' · ')||'treino'} · ${p.n.size} exercício${p.n.size===1?'':'s'}`});});
      const ss=await t.loadSessionsCache?.()||[];ss.forEach(s=>{if(s.date&&!por[s.date]){addTipo(s.date,'academia');dia(s.date).itens.push({ic:'🏋️',t:'Academia',s:s.durationMin?`${s.durationMin} min`:'sessão'});}});
    }
  }catch{}
  const acts=await getJ('f3-activities',[]);
  acts.forEach(a=>{if(!a.date||a.tipo==='relogio')return;const [ic,l]=tipoDe(a.tipo);addTipo(a.date,a.tipo||'outro');
    const p=[];if(a.min)p.push(a.min+' min');if(a.kcal)p.push(nf(a.kcal)+' kcal');
    dia(a.date).itens.push({ic,t:l,s:p.join(' · '),relogio:a.fonte==='samsung'});});
  try{
    const db=root.claude?await root.claude.use('db'):null;
    if(db){
      for(const [col,tipo] of [['natacao','natacao'],['corridas','corrida'],['crossfit','crossfit']]){
        let docs=[];try{docs=(await db.collection(col).get()).docs.map(x=>x.data());}catch{}
        docs.forEach(v=>{if(!v||!v.data)return;
          const d=dia(v.data);const [ic,l]=tipoDe(tipo);addTipo(v.data,tipo);
          // a sessão do relógio já entrou pela Atividade: só completa a distância
          const dist=tipo==='natacao'&&v.distancia_m>0?nf(v.distancia_m)+' m':tipo==='corrida'&&v.distancia_km>0?String(v.distancia_km.toFixed(2)).replace('.',',')+' km':'';
          const ja=v.origem==='samsung'?d.itens.find(i=>i.t===l&&i.relogio):null;
          if(ja){if(dist&&!ja.s.includes(dist))ja.s=dist+(ja.s?' · '+ja.s:'');return;}
          const p=[];if(dist)p.push(dist);if(v.duracao_s)p.push(Math.round(v.duracao_s/60)+' min');if(v.calorias)p.push(nf(v.calorias)+' kcal');
          d.itens.push({ic,t:l,s:p.join(' · ')});});
      }
    }
  }catch{}
  return dias;
}

function sequencias(dias){
  const hoje=tk();const set=new Set(Object.keys(dias).filter(k=>k<=hoje));
  // sequência atual: termina hoje ou ontem (o dia de hoje ainda pode ser treinado)
  let atual=0;const c=new Date();c.setHours(0,0,0,0);if(!set.has(tk(c)))c.setDate(c.getDate()-1);
  while(set.has(tk(c))){atual++;c.setDate(c.getDate()-1);}
  let melhor=0,run=0,prev=null;[...set].sort().forEach(k=>{const d=pd(k);if(prev&&(d-prev)/864e5===1)run++;else run=1;melhor=Math.max(melhor,run);prev=d;});
  return {atual,melhor};
}

// ---------- desenho ----------
async function render(host){
  if(typeof host==='string')host=$(host);if(!host)return;
  if(!host.id)host.id='cl-h'+Object.keys(ESTADOS).length;const hid=host.id,st=est(hid);
  const dias=await dados();const hoje=tk();
  if(!st.mes){const h=new Date();st.mes=[h.getFullYear(),h.getMonth()];}
  const [y,m]=st.mes;const ini=new Date(y,m,1),nDias=new Date(y,m+1,0).getDate();
  const doMes=Object.keys(dias).filter(k=>k.startsWith(`${y}-${String(m+1).padStart(2,'0')}`));
  const seq=sequencias(dias);
  const cont={};doMes.forEach(k=>dias[k].tipos.forEach(t=>cont[t]=(cont[t]||0)+1));
  let meta=null;try{meta=await root.ForjaGymTraining?.computeWeeklyGoal?.();}catch{}
  // semana atual (seg–dom), qualquer treino
  const seg=new Date();seg.setHours(0,0,0,0);seg.setDate(seg.getDate()-((seg.getDay()+6)%7));
  let semFeitos=0;for(let i=0;i<7;i++){const d=new Date(seg);d.setDate(seg.getDate()+i);if(dias[tk(d)])semFeitos++;}
  const alvo=Math.max(1,meta?.target||3);
  // grade: domingo primeiro, faixas por linha
  const cel=[];for(let i=0;i<ini.getDay();i++)cel.push(null);for(let d=1;d<=nDias;d++)cel.push(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);while(cel.length%7)cel.push(null);
  let grade='';
  for(let r=0;r<cel.length;r+=7){
    grade+='<div class="cl-lin">';
    for(let c=0;c<7;c++){
      const k=cel[r+c];if(!k){grade+='<div class="cl-d vazio"></div>';continue;}
      const f=!!dias[k],antes=c>0&&cel[r+c-1]&&dias[cel[r+c-1]],depois=c<6&&cel[r+c+1]&&dias[cel[r+c+1]];
      const cls=['cl-d'];if(f){cls.push('f');if(!antes)cls.push('ini');if(!depois)cls.push('fim');}else if(k<hoje)cls.push('folga');else if(k>hoje)cls.push('futuro');
      if(k===hoje)cls.push('hoje');if(k===st.sel)cls.push('sel');
      const ics=f?dias[k].tipos.slice(0,2).map(t=>tipoDe(t)[0]).join(''):'';
      grade+=`<button type="button" class="${cls.join(' ')}" onclick="ForjaCalendario.dia('${k}','${hid}')" aria-label="${pd(k).getDate()} de ${MESES[m]}${f?': treinou':''}"><b>${pd(k).getDate()}</b>${ics?`<i>${ics}</i>`:''}</button>`;
    }
    grade+='</div>';
  }
  const sel=st.sel&&st.sel.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)?st.sel:null;
  const det=sel?(dias[sel]?`<div class="cl-det"><div class="cl-det-t">${pd(sel).getDate()} de ${MESES[m]}</div>${dias[sel].itens.map(i=>`<div class="cl-it"><span>${i.ic}</span><div><b>${esc(i.t)}${i.relogio?' <small>⌚ relógio</small>':''}</b>${i.s?`<small>${esc(i.s)}</small>`:''}</div></div>`).join('')}</div>`
    :`<div class="cl-det"><div class="cl-det-t">${pd(sel).getDate()} de ${MESES[m]}</div><p class="cl-nada">${sel>hoje?'Ainda não chegou.':sel===hoje?'Ainda sem treino hoje.':'Descanso — nenhum treino registrado.'}</p></div>`):'';
  const agora=new Date();const ehAtual=y===agora.getFullYear()&&m===agora.getMonth();
  host.innerHTML=`<div class="cl">
    <div class="cl-top"><div><div class="cl-num">${doMes.length}</div><div class="cl-lbl">dia${doMes.length===1?'':'s'} de treino em ${MESES[m]}</div></div>
      <div class="cl-chama${seq.atual?' on':''}"><span>🔥</span><b>${seq.atual}</b><small>dia${seq.atual===1?'':'s'} seguido${seq.atual===1?'':'s'}</small></div></div>
    ${Object.keys(cont).length?`<div class="cl-tipos">${Object.entries(cont).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<span>${tipoDe(t)[0]} ${tipoDe(t)[1]} <b>${n}</b></span>`).join('')}</div>`:''}
    <div class="cl-cal">
      <div class="cl-nav"><button type="button" aria-label="Mês anterior" onclick="ForjaCalendario.mudar(-1,'${hid}')">‹</button><b>${MESES[m]} de ${y}</b><button type="button" aria-label="Próximo mês" ${ehAtual?'disabled':''} onclick="ForjaCalendario.mudar(1,'${hid}')">›</button></div>
      <div class="cl-sem"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div>
      ${grade}
      <div class="cl-leg"><span><i class="f"></i>treinou</span><span><i class="folga"></i>descanso</span><span><i class="hoje"></i>hoje</span></div>
    </div>
    ${det}
    <div class="cl-meta"><div class="cl-meta-t">Meta da semana <b>${semFeitos} / ${alvo} dias</b></div><div class="cl-barra"><i style="width:${Math.min(100,Math.round(semFeitos/alvo*100))}%"></i></div>
      <small>Melhor sequência: ${seq.melhor} dia${seq.melhor===1?'':'s'} seguido${seq.melhor===1?'':'s'}</small></div>
  </div>`;
}
function mudar(n,hid){const st=est(hid);const [y,m]=st.mes;const d=new Date(y,m+n,1);st.mes=[d.getFullYear(),d.getMonth()];st.sel=null;render(hid);}
function dia(k,hid){const st=est(hid);st.sel=st.sel===k?null:k;render(hid);}
async function abrir(){
  const st=est('cl-folha');st.mes=null;st.sel=tk();
  root.Forja3.abrirFolha('<div class="f3-t">📅 Calendário de treinos</div><div id="cl-folha"></div>'+(root.ForjaMontar?'<button type="button" class="cl-mais" onclick="ForjaMontar.semana(0)">🏋️ Exercícios de cada dia da semana</button>':''));
  await render('cl-folha');
}
// dias treinados (qualquer tipo) — usado na faixa da semana da Academia
async function diasTreinados(){return new Set(Object.keys(await dados()));}

root.ForjaCalendario={dados,render,abrir,mudar,dia,diasTreinados,sequencias};
})(window);
