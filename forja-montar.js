/* Forja — montar o treino do dia pelos músculos ("hoje: peito, costas, tríceps e bíceps").
   - Sugere exercícios por músculo: primeiro os que você já faz (com a última carga), depois os clássicos.
   - "Seus treinos de sempre": o app percebe as combinações que você repete e vira Treino A, B, C sozinho.
   - "Semana": o que foi feito em cada dia (músculos e exercícios). */
(function(root){
'use strict';
const doc=root.document,$=id=>doc.getElementById(id);
const T=()=>root.ForjaGymTraining,G=()=>root.ForjaGymUI;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsq=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const dn=n=>root.ForjaExerciseNames&&root.ForjaExerciseNames.display?root.ForjaExerciseNames.display(n):n;
const tap=()=>{try{navigator.vibrate?.(8);}catch{}};
const toast=(m,a)=>root.showToast?.(m,a);
const tk=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const pd=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12);};
const DIAS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const MUSCULOS=['Peito','Costas','Ombro','Bíceps','Tríceps','Perna','Glúteo','Panturrilha','Abdômen'];
const GRANDES=new Set(['Peito','Costas','Perna']);
// clássicos de academia por músculo (nomes da biblioteca do app; quase todos têm GIF)
const CLASSICOS={
  'Peito':['Barbell Bench Press - Medium Grip','Incline Dumbbell Press','Dumbbell Bench Press','Dumbbell Flyes','Cable Crossover','Butterfly','Barbell Incline Bench Press - Medium Grip','Decline Barbell Bench Press','Pushups','Machine Bench Press'],
  'Costas':['Wide-Grip Lat Pulldown','Seated Cable Rows','Bent Over Barbell Row','One-Arm Dumbbell Row','Close-Grip Front Lat Pulldown','Pullups','Straight-Arm Pulldown','T-Bar Row with Handle','Hyperextensions (Back Extensions)'],
  'Ombro':['Dumbbell Shoulder Press','Side Lateral Raise','Seated Barbell Military Press','Front Dumbbell Raise','Reverse Flyes','Face Pull','Arnold Dumbbell Press','Upright Barbell Row'],
  'Bíceps':['Barbell Curl','Dumbbell Bicep Curl','Hammer Curls','Preacher Curl','Incline Dumbbell Curl','EZ-Bar Curl','Cable Hammer Curls - Rope Attachment','Concentration Curls'],
  'Tríceps':['Triceps Pushdown','Triceps Pushdown - Rope Attachment','Lying Triceps Press','Cable Rope Overhead Triceps Extension','Dips - Triceps Version','Bench Dips','Close-Grip Barbell Bench Press','Standing Dumbbell Triceps Extension'],
  'Perna':['Barbell Full Squat','Leg Press','Leg Extensions','Lying Leg Curls','Seated Leg Curl','Romanian Deadlift','Dumbbell Lunges','Goblet Squat','Hack Squat','Barbell Walking Lunge'],
  'Glúteo':['Barbell Hip Thrust','Barbell Glute Bridge','Glute Kickback','Thigh Abductor','Romanian Deadlift','Dumbbell Step Ups','Cable Hip Adduction'],
  'Panturrilha':['Standing Calf Raises','Seated Calf Raise','Calf Press On The Leg Press Machine','Smith Machine Calf Raise'],
  'Abdômen':['Crunches','Plank','Hanging Leg Raise','Cable Crunch','Russian Twist','Ab Roller','Decline Crunch','Bicycling'],
};

let st={sel:new Set(),pick:new Set(),musc:{},semanaOff:0};

// ---------- histórico ----------
function resumoSeries(e){
  const t=T();const ws=t.parseWeightList(e.weight),rs=t.parseRepsList(e.reps),wu=t.parseWarmupList?t.parseWarmupList(e.warmup):[];
  const n=Math.max(ws.length,rs.length);let s=0,top=0,rep=null;
  for(let i=0;i<n;i++){if(wu[i])continue;s++;if((ws[i]||0)>=top){top=ws[i]||0;rep=rs[i]??rep;}}
  if(!s)return '';
  return `${s} × ${rep??'—'}${top?` · ${String(top).replace('.',',')} kg`:''}`;
}
async function historico(){
  const t=T();await t.loadMuscleCache();
  const arr=await t.loadWorkouts();const lim=tk(new Date(Date.now()-120*864e5));
  const porNome={},porDia={};
  arr.forEach(e=>{
    const nome=(e.name||'').trim();if(!nome||e.date<lim)return;
    const m=t.getMuscleSync(nome);if(!m||m==='Cardio')return;
    const h=porNome[nome]=porNome[nome]||{nome,musc:m,datas:new Set(),ultima:'',resumo:''};
    h.datas.add(e.date);if(e.date>=h.ultima){h.ultima=e.date;h.resumo=resumoSeries(e);}
    const d=porDia[e.date]=porDia[e.date]||{data:e.date,nomes:[],musc:new Set()};
    if(!d.nomes.includes(nome))d.nomes.push(nome);d.musc.add(m);
  });
  return {porNome,porDia};
}
function ultimaVez(porDia){const r={};Object.values(porDia).forEach(d=>d.musc.forEach(m=>{if(!r[m]||d.data>r[m])r[m]=d.data;}));return r;}
function haDias(k){if(!k)return null;return Math.round((pd(tk(new Date()))-pd(k))/864e5);}

/** combinações repetidas viram Treino A, B, C… */
async function rotinas(){
  const {porDia}=await historico();
  const grupos={};
  Object.values(porDia).forEach(d=>{if(d.nomes.length<2)return;const k=[...d.musc].sort((x,y)=>MUSCULOS.indexOf(x)-MUSCULOS.indexOf(y)).join('+');(grupos[k]=grupos[k]||[]).push(d);});
  const lista=Object.entries(grupos).filter(([,ds])=>ds.length>=2).map(([k,ds])=>{
    const cont={};ds.forEach(d=>d.nomes.forEach((n,i)=>{const c=cont[n]=cont[n]||{n,v:0,pos:0};c.v++;c.pos+=i;}));
    const nomes=Object.values(cont).filter(c=>c.v>=Math.max(1,Math.ceil(ds.length*0.4))).sort((a,b)=>a.pos/a.v-b.pos/b.v).map(c=>c.n);
    const ultima=ds.map(d=>d.data).sort().pop();
    return {musc:k.split('+'),vezes:ds.length,nomes,ultima};
  }).filter(r=>r.nomes.length>=2).sort((a,b)=>b.vezes-a.vezes||b.ultima.localeCompare(a.ultima)).slice(0,4);
  lista.forEach((r,i)=>{r.letra='ABCD'[i];});
  return lista;
}

// ---------- sugestões ----------
function existe(nome){const n=nome.toLowerCase();return (root.ForjaFreeExerciseLibrary||[]).some(r=>r[1].toLowerCase()===n)||(root.ForjaGymCatalog||[]).some(r=>r[0].toLowerCase()===n);}
function sugestoes(m,porNome){
  const meus=Object.values(porNome).filter(h=>h.musc===m).sort((a,b)=>b.datas.size-a.datas.size||b.ultima.localeCompare(a.ultima));
  const ja=new Set(meus.map(h=>h.nome.toLowerCase()));
  const classicos=(CLASSICOS[m]||[]).filter(n=>!ja.has(n.toLowerCase())&&existe(n)).map(n=>({nome:n,musc:m,novo:true}));
  return [...meus.map(h=>({nome:h.nome,musc:m,vezes:h.datas.size,resumo:h.resumo,ultima:h.ultima})),...classicos].slice(0,8);
}
function padrao(m,lista){return lista.slice(0,GRANDES.has(m)?3:2).map(x=>x.nome);}

async function abrir(pre){
  tap();const {porNome,porDia}=await historico();st.hist=porNome;st.ult=ultimaVez(porDia);
  st.sel=new Set(pre&&pre.musc||[]);st.pick=new Set(pre&&pre.nomes||[]);st.musc={};
  if(pre&&pre.nomes)pre.nomes.forEach(n=>{st.musc[n]=T().getMuscleSync(n);});
  if(!st.sel.size)st.pick=new Set();
  root.Forja3.abrirFolha(`<div class="f3-t">${pre&&pre.letra?`Treino ${pre.letra}`:'Montar treino de hoje'}</div>
    <p class="f3-nota">Escolha os músculos de hoje. O app sugere os exercícios: primeiro os que você já faz, depois os clássicos. Segure o dedo num exercício para ver o GIF.</p>
    <div class="mt-musc" id="mt-musc"></div><div id="mt-sug"></div>
    <div class="mt-rodape"><button type="button" class="f3-cta" id="mt-go" onclick="ForjaMontar.comecar()">Começar</button></div>`);
  pintar();
}
function pintar(){
  const box=$('mt-musc');if(!box)return;
  box.innerHTML=MUSCULOS.map(m=>{const d=haDias(st.ult[m]);return `<button type="button" class="${st.sel.has(m)?'on':''}" aria-pressed="${st.sel.has(m)}" onclick="ForjaMontar.musculo('${m}')"><b>${m}</b><small>${d==null?'—':d===0?'hoje':d===1?'ontem':`há ${d} dias`}</small></button>`;}).join('');
  const sug=$('mt-sug');
  sug.innerHTML=[...st.sel].map(m=>{
    const l=sugestoes(m,st.hist);
    return `<div class="mt-grupo"><div class="f3-lbl">${m}</div>${l.map(x=>{const on=st.pick.has(x.nome);
      return `<button type="button" class="mt-ex${on?' on':''}" data-ex-name="${esc(x.nome)}" data-ex-src="${x.novo?'free':'mine'}" onclick="ForjaMontar.exercicio('${jsq(x.nome)}','${m}')">
        <i>${on?'✓':''}</i><span><b>${esc(dn(x.nome))}</b><small>${x.novo?'sugestão':`você fez ${x.vezes}×${x.resumo?` · ${esc(x.resumo)}`:''}`}</small></span></button>`;}).join('')||'<p class="f3-nota">Nada para este músculo ainda.</p>'}</div>`;
  }).join('');
  const go=$('mt-go');if(go){const n=st.pick.size;go.disabled=!n;go.textContent=n?`▶ Começar com ${n} exercício${n>1?'s':''}`:'Escolha os músculos';}
}
function musculo(m){
  tap();
  if(st.sel.has(m)){st.sel.delete(m);[...st.pick].forEach(n=>{if(st.musc[n]===m)st.pick.delete(n);});}
  else{st.sel.add(m);padrao(m,sugestoes(m,st.hist)).forEach(n=>{st.pick.add(n);st.musc[n]=m;});}
  pintar();
}
function exercicio(nome,m){tap();if(st.pick.has(nome))st.pick.delete(nome);else{st.pick.add(nome);st.musc[nome]=m;}pintar();}
async function comecar(){
  const t=T(),g=G();if(!st.pick.size)return;tap();
  const cache=await t.loadMuscleCache();let mud=false;
  st.pick.forEach(n=>{const k=t.slug(n);if(!cache[k]&&st.musc[n]){cache[k]=st.musc[n];mud=true;}});
  if(mud)await t.persistMuscleCache();
  const nome=[...st.sel].join(' + ');
  root.Forja3.fecharFolha();
  if(!$('session-running')||$('session-running').style.display==='none')await g.startWorkoutSession({groupName:nome,silent:true});
  // na ordem dos músculos escolhidos
  const ordem=[...st.sel].flatMap(m=>[...st.pick].filter(n=>st.musc[n]===m));
  for(const n of ordem)await g.addExerciseToSession(n,{silent:true});
  try{await g.renderSessionStack?.();g.refreshTreinoTabVisibility?.();}catch{}
  toast(`Treino de ${nome} montado: ${ordem.length} exercícios.`);
  root.document.getElementById('session-stack')?.scrollIntoView({behavior:'smooth',block:'start'});
}

// ---------- Início da Academia ----------
async function heroHtml(){
  let r=[];try{r=await rotinas();}catch{}
  let semGrupos=false;try{semGrupos=!(await T().loadWorkoutGroups()).length;}catch{} // sem grupos, o botão grande do topo já monta por músculo
  const chips=r.map(x=>`<button type="button" onclick="ForjaMontar.usarRotina('${x.letra}')"><b>Treino ${x.letra}</b><small>${esc(x.musc.join(' + '))} · ${x.vezes}×</small></button>`).join('');
  return `<div class="mt-hero">${semGrupos?'':`<button type="button" class="mt-montar" onclick="ForjaMontar.abrir()">`}${semGrupos?'':`<span>🎯</span><span><b>Montar por músculo</b><small>ex.: peito, costas, tríceps e bíceps</small></span><i>›</i></button>`}
    ${r.length?`<div class="f3-lbl">Seus treinos de sempre</div><div class="mt-rot">${chips}</div><p class="f3-nota">O app junta sozinho as combinações que você repete.</p>`:''}</div>`.replace('<div class="mt-hero"></div>','');
}
async function usarRotina(letra){
  const r=(await rotinas()).find(x=>x.letra===letra);if(!r)return;
  await abrir({musc:r.musc,nomes:r.nomes,letra});
  const go=$('mt-go');
  if(go&&!$('mt-salvar'))go.insertAdjacentHTML('afterend',`<button type="button" class="f3-cta sec" id="mt-salvar" onclick="ForjaMontar.salvarRotina('${letra}')">Salvar em Meus treinos</button>`);
}
async function salvarRotina(letra){
  const t=T();const r=(await rotinas()).find(x=>x.letra===letra);if(!r)return;
  const groups=await t.loadWorkoutGroups();const nome=`Treino ${letra} — ${r.musc.join(' + ')}`;
  const nomes=[...st.pick].length?[...st.pick]:r.nomes;
  const ex=groups.find(g=>g.name===nome);if(ex)ex.exercises=nomes;else groups.push({id:t.cid(),name:nome,exercises:nomes});
  await t.persistWorkoutGroups();toast(`"${nome}" salvo em Meus treinos.`);
  try{await G().renderWorkoutGroups?.();await G().renderHoje?.();}catch{}
}

// ---------- semana ----------
async function semana(off){
  tap();if(typeof off==='number')st.semanaOff=off;const t=T();await t.loadMuscleCache();
  const arr=await t.loadWorkouts();
  const seg=t.getMonday(new Date());seg.setDate(seg.getDate()+7*st.semanaOff);
  const dias=[...Array(7)].map((_,i)=>{const d=new Date(seg);d.setDate(seg.getDate()+i);return tk(d);});
  const linhas=dias.map(k=>{
    const es=arr.filter(e=>e.date===k);
    const musc=[...new Set(es.map(e=>t.getMuscleSync((e.name||'').trim())).filter(Boolean))];
    const d=pd(k);
    return `<div class="sm-dia${es.length?' f':''}${k===tk(new Date())?' h':''}"><div class="sm-cab"><b>${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}</b>${musc.length?`<span>${musc.map(esc).join(' · ')}</span>`:'<span class="v">descanso</span>'}</div>
      ${es.map(e=>`<div class="sm-ex" data-ex-name="${esc((e.name||'').trim())}" data-ex-src="mine"><span>${esc(dn((e.name||'').trim()))}</span><small>${esc(resumoSeries(e))}</small></div>`).join('')}</div>`;
  }).join('');
  const titulo=st.semanaOff===0?'Esta semana':st.semanaOff===-1?'Semana passada':`Semana de ${pd(dias[0]).getDate()}/${pd(dias[0]).getMonth()+1}`;
  root.Forja3.abrirFolha(`<div class="sm-top"><button type="button" aria-label="Semana anterior" onclick="ForjaMontar.semana(${st.semanaOff-1})">‹</button><div class="f3-t">${titulo}</div><button type="button" aria-label="Próxima semana" ${st.semanaOff>=0?'disabled':''} onclick="ForjaMontar.semana(${st.semanaOff+1})">›</button></div>${linhas}`);
}

root.ForjaMontar={abrir,musculo,exercicio,comecar,heroHtml,usarRotina,salvarRotina,semana,rotinas,sugestoes,CLASSICOS};
})(window);
