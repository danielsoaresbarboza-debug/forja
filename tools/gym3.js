// ================= FORJA 3.0 — ACADEMIA =================
// Tipos de exercício: normal = kg × reps · none = só repetições (peso = extra opcional) · bodyweight (legado: peso corporal)
// time = tempo (reps guarda os segundos) · cardio = min/km/kcal
const MODE_SEG=[['normal','kg'],['none','Repetições'],['time','Tempo'],['cardio','Cardio']];
const K_LAST_GROUP='gym-last-group';
let activeGroupName='',activeGroupId=null,timeTickInterval=null,wakeLockRef=null;
function segMode(m){return m==='bodyweight'?'none':(m||'normal');}
function fw(w){return T().fmtWeight(w);}
function fmtSecs(n){n=Math.max(0,Math.round(n||0));return n>=60?`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`:`${n} s`;}
function fmtSetValue(st,mode){
  const m=segMode(mode);
  if(m==='time')return fmtSecs(st.reps)+(st.weight>0&&mode!=='bodyweight'?` · +${fw(st.weight)} kg`:'');
  if(m==='none')return `${st.reps}`+(st.weight>0&&mode!=='bodyweight'?` · +${fw(st.weight)} kg`:'');
  return `${fw(st.weight)} × ${st.reps}`;
}
function fmtSetsShort(sets,mode){
  const m=segMode(mode);const work=(sets||[]).filter(x=>!x.warmup);if(!work.length)return '';
  const sameR=work.every(x=>x.reps===work[0].reps),sameW=work.every(x=>Math.abs((x.weight||0)-(work[0].weight||0))<0.01);
  if(m==='time')return sameR?`${work.length} × ${fmtSecs(work[0].reps)}`:work.map(x=>fmtSecs(x.reps)).join(' · ');
  if(m==='none'){const ex=work[0].weight>0&&mode!=='bodyweight'&&sameW?` · +${fw(work[0].weight)} kg`:'';return sameR?`${work.length} × ${work[0].reps}${ex}`:work.map(x=>x.reps).join(' · ')+ex;}
  if(sameR&&sameW)return `${work.length} × ${work[0].reps} · ${fw(work[0].weight)} kg`;
  if(sameR)return `${work.map(x=>fw(x.weight)).join(' · ')} kg × ${work[0].reps}`;
  return work.map(x=>`${fw(x.weight)}×${x.reps}`).join(' · ');
}
const DIAS_CURTOS=['dom','seg','ter','qua','qui','sex','sáb'];
const MESES_CURTOS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function diaCurto(key){const [y,m,d]=key.split('-').map(Number);const dt=new Date(y,m-1,d,12);const hoje=new Date();const diff=Math.round((new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate(),12)-dt)/864e5);if(diff===1)return 'ontem';if(diff>1&&diff<7)return DIAS_CURTOS[dt.getDay()];return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;}
function thumbHtml(photo,cls){
  return photo?`<span class="ex-thumb ${cls||''}"><img src="${photo}" alt="" draggable="false" onerror="this.parentNode.classList.add('ph');this.remove()"></span>`:`<span class="ex-thumb ${cls||''} ph"></span>`;
}
function entrySets(e){
  const t=T();const ws=t.parseWeightList(e.weight),rs=t.parseRepsList(e.reps),warm=t.parseWarmupList(e.warmup);
  return rs.map((r,i)=>({weight:ws[i]!==undefined?ws[i]:(ws[ws.length-1]||0),reps:r,warmup:!!warm[i]}));
}
async function lastSessionFor(name){
  const t=T();const arr=await t.loadWorkouts();
  const past=arr.filter(e=>e.name.trim()===name&&e.date!==t.todayKey()).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
  if(!past.length)return null;
  return{date:past[0].date,sets:entrySets(past[0])};
}
function lastWork(ex){return ex.last?ex.last.sets.filter(x=>!x.warmup):[];}
function workDone(ex){return ex.sets.filter(x=>!x.warmup).length;}
function planCount(ex){return Math.max(ex.planCount||3,workDone(ex));}
function defaultRepsFor(ex,k){const lw=lastWork(ex);if(ex.targetReps)return ex.targetReps;if(lw[k])return lw[k].reps;if(lw.length)return lw[lw.length-1].reps;return segMode(ex.weightMode)==='time'?30:10;}
function suggestionFor(ex){
  const lw=lastWork(ex);if(lw.length<2)return null;const m=segMode(ex.weightMode);
  const r0=lw[0].reps;const allHit=lw.every(x=>x.reps>=r0);if(!allHit)return null;
  if(m==='normal'){
    const w=lw[0].weight;if(!(w>0))return null;if(!lw.every(x=>Math.abs(x.weight-w)<0.01))return null;
    const inc=w>=20?2.5:1;const nw=Math.round((w+inc)*10)/10;
    return{kind:'kg',value:nw,text:`Você fez ${lw.length} × ${r0} com ${fw(w)} kg.`,action:`Hoje: ${fw(nw)} kg`};
  }
  if(m==='none')return{kind:'reps',value:r0+1,text:`Bateu ${r0} nas ${lw.length} séries.`,action:`Hoje: ${r0+1}`};
  if(m==='time')return{kind:'reps',value:r0+5,text:`Segurou ${fmtSecs(r0)} nas ${lw.length} séries.`,action:`Hoje: ${fmtSecs(r0+5)}`};
  return null;
}
async function applySuggestion(idx){
  tapFeedback();const ex=sessionExercises[idx];if(!ex)return;const sg=suggestionFor(ex);if(!sg)return;
  if(sg.kind==='kg')ex.weight=sg.value;else{ex.targetReps=sg.value;ex.pendingReps=sg.value;}
  ex.sgApplied=true;renderCard(idx);
}

// ---------- sessão ----------
async function startWorkoutSession(opts){
  tapFeedback();const t=T();opts=opts||{};
  activeSessionStartTs=Date.now();activeGroupName=opts.groupName||'';activeGroupId=opts.groupId||null;
  await t.storage().set(t.K_ACTIVE,JSON.stringify({date:t.todayKey(),start:activeSessionStartTs,groupName:activeGroupName,groupId:activeGroupId}));
  showSessionRunningUI();refreshTreinoTabVisibility();keepAwake(true);
  if(!opts.silent)showToast('Treino iniciado. Bora!');
}
function showSessionRunningUI(){
  $('session-idle').style.display='none';$('session-running').style.display='block';const sbx=$('session-box');if(sbx)sbx.classList.add('running');
  const nm=$('tr-nome');if(nm)nm.textContent=activeGroupName||'Treino livre';
  renderHeroStats();clearInterval(sessionTickInterval);tickSessionTimer();sessionTickInterval=setInterval(tickSessionTimer,1000);
}
function tickSessionTimer(){
  if(!activeSessionStartTs)return;
  const el=Math.floor((Date.now()-activeSessionStartTs)/1000);
  const h=Math.floor(el/3600),mm=String(Math.floor(el/60)%60).padStart(2,'0'),ss=String(el%60).padStart(2,'0');
  const e=$('session-timer');if(e)e.textContent=h?`${h}:${mm}:${ss}`:`${mm}:${ss}`;
}
async function initSessionState(){
  const t=T();
  try{
    const r=await t.storage().get(t.K_ACTIVE);
    if(r&&r.value){const data=JSON.parse(r.value);if(data&&data.date===t.todayKey()&&data.start){activeSessionStartTs=data.start;activeGroupName=data.groupName||'';activeGroupId=data.groupId||null;showSessionRunningUI();}}
  }catch{}
  refreshTreinoTabVisibility();
}
function refreshTreinoTabVisibility(){
  const hasCards=sessionExercises.length>0,sessionActive=!!activeSessionStartTs;
  const show=(id,v,disp)=>{const e=$(id);if(e)e.style.display=v?(disp||'block'):'none';};
  show('session-stack',hasCards);show('add-exercise-btn',hasCards&&sessionActive);
  show('muscle-overview-card',hasCards);
  show('picker-card',!hasCards&&sessionActive);
  const pc=$('picker-close-btn');if(pc)pc.style.display=hasCards?'inline-block':'none';
  show('start-session-prompt',false);
  show('ac-hoje',!sessionActive);
  const ac=$('tab-academia');if(ac)ac.classList.toggle('em-treino',sessionActive);
}
async function endWorkoutSession(){
  tapFeedback();const t=T();
  if(!activeSessionStartTs)return;
  const durationMin=Math.max(1,Math.round((Date.now()-activeSessionStartTs)/60000));
  const stats=computeSessionStats();const kcal=await estimateKcal(stats.sets,durationMin,stats.cardioKcal);
  if(sheetIdx!==null)await closeExSheet();
  pularRest(true);
  const sessions=await t.loadSessionsCache();
  const sessionId=t.cid();
  sessions.push({id:sessionId,date:t.todayKey(),start:activeSessionStartTs,end:Date.now(),durationMin,sets:stats.sets,volume:Math.round(stats.vol),kcal,group:activeGroupName||'',groupId:activeGroupId||null});
  await t.persistSessionsCache();
  if(activeGroupId){try{await t.storage().set(K_LAST_GROUP,JSON.stringify({id:activeGroupId,date:t.todayKey()}));}catch{}}
  pendingSummary={sessionId,durationMin,sets:stats.sets,volume:Math.round(stats.vol),kcal,exs:stats.exs,names:stats.names.slice(),records:sessionRecordList.slice(),group:activeGroupName};
  sessionRecords=0;sessionRecordList=[];
  await t.storage().set(t.K_ACTIVE,'');
  clearInterval(sessionTickInterval);activeSessionStartTs=null;activeGroupName='';activeGroupId=null;keepAwake(false);
  $('session-running').style.display='none';$('session-idle').style.display='block';const sbx=$('session-box');if(sbx)sbx.classList.remove('running');
  sessionExercises=[];
  await renderSessionStack();refreshTreinoTabVisibility();
  await renderTodayList();await renderWeeklyGoal();await renderHoje();
  root.ForjaGymSuggest?.render?.();
  await showSummary();
}
async function loadWorkoutGroupToSession(id){
  tapFeedback();const t=T();const groups=await t.loadWorkoutGroups();
  const g=groups.find(x=>x.id===id);if(!g)return;
  if(!activeSessionStartTs)await startWorkoutSession({groupName:g.name,groupId:g.id,silent:true});
  else if(!activeGroupName){activeGroupName=g.name;activeGroupId=g.id;const nm=$('tr-nome');if(nm)nm.textContent=g.name;}
  for(const name of g.exercises){await addExerciseToSession(name,{silent:true});}
  await renderSessionStack();refreshTreinoTabVisibility();renderHeroStats();
  showToast(`${g.name}: ${g.exercises.length} exercícios. Toque no primeiro para começar.`);
  $('tab-academia')?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function startFreeWorkout(){
  if(!activeSessionStartTs)await startWorkoutSession({groupName:'',silent:true});
  await openPickerForAdd();
}
async function addExerciseToSession(name,opts){
  opts=opts||{};if(!opts.silent)tapFeedback();const t=T();
  if(!activeSessionStartTs){showToast('Comece um treino primeiro.');return;}
  const existingIdx=sessionExercises.findIndex(e=>e.name===name);
  if(existingIdx>=0){if(opts.silent)return;sessionExercises[existingIdx].finished=false;refreshTreinoTabVisibility();await openExSheet(existingIdx);return;}
  await t.loadNotesCache();await t.loadPhotosCache();await t.loadMuscleCache();await t.loadWeightModeCache();
  const arr=await t.loadWorkouts();
  const todayEntry=arr.find(e=>e.name.trim()===name&&e.date===t.todayKey());
  let sets=[],workoutId=null;
  if(todayEntry){
    workoutId=todayEntry.id;
    const rirs=t.parseRirList(todayEntry.rir);
    sets=entrySets(todayEntry).map((x,i)=>({...x,rir:rirs[i]||''}));
  }
  const weightMode=t.getWeightModeSync(name);
  const last=await lastSessionFor(name);
  const ex={name,workoutId,sets,weight:0,weightMode,pendingReps:10,finished:false,last,planCount:3};
  const lw=lastWork(ex);if(lw.length)ex.planCount=lw.length;
  if(sets.length)ex.weight=sets[sets.length-1].weight;
  else if(weightMode==='bodyweight')ex.weight=await t.getLastBodyWeight()||0;
  else if(weightMode==='normal')ex.weight=lw.length?lw[0].weight:(last&&last.sets.length?last.sets[last.sets.length-1].weight:20);
  else ex.weight=lw.length&&weightMode!=='cardio'?(lw[0].weight||0):0;
  ex.pendingReps=defaultRepsFor(ex,workDone(ex));
  const idx=sessionExercises.length;
  sessionExercises.push(ex);
  const f=$('new-ex-form');if(f)f.style.display='none';
  if(opts.silent)return;
  refreshTreinoTabVisibility();await openExSheet(idx);
}
async function setExerciseMode(idx,mode){
  tapFeedback();const t=T();const ex=sessionExercises[idx];if(!ex)return;
  if(segMode(ex.weightMode)===mode)return;
  ex.weightMode=mode;const cache=await t.loadWeightModeCache();cache[t.slug(ex.name)]=mode;await t.persistWeightModeCache();
  if(mode==='normal'){if(!(ex.weight>0))ex.weight=20;}else ex.weight=0;
  ex.targetReps=null;ex.pendingReps=mode==='time'?(ex.timeTarget||30):defaultRepsFor(ex,workDone(ex));
  stopTimeTick(ex);renderCard(idx);
}
function adjustPendingReps(idx,delta){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.pendingReps=Math.max(segMode(ex.weightMode)==='time'?5:1,(ex.pendingReps||0)+delta);renderCard(idx);}
function addPlannedSet(idx){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.planCount=planCount(ex)+1;renderCard(idx);}
function toggleExtraWeight(idx){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.showExtra=!ex.showExtra;if(!ex.showExtra)ex.weight=0;renderCard(idx);}

// ---------- linha da lista ----------
function buildRowHtml(idx){
  const t=T();const ex=sessionExercises[idx];
  const photo=t.getPhotoSync(ex.name)||(root.ForjaExerciseLibrary&&root.ForjaExerciseLibrary.getWgerImageSync(ex.name));
  const done=workDone(ex),plan=planCount(ex),m=segMode(ex.weightMode);
  let sub,st;
  if(m==='cardio'){sub=ex.sets.length?`${ex.sets.length} registro${ex.sets.length>1?'s':''} de cardio`:'cardio · toque para registrar';st=ex.sets.length?'✓':'';}
  else if(ex.finished){sub=fmtSetsShort(ex.sets,ex.weightMode);st='✓';}
  else if(done){sub=`agora · série ${Math.min(done+1,plan)} de ${plan}`;st=m==='normal'?`${fw(ex.weight)} kg`:'';}
  else{const lw=lastWork(ex);sub=lw.length?`última: ${fmtSetsShort(ex.last.sets,ex.weightMode)}`:'primeira vez';st=String(plan);}
  const dots=m==='cardio'?'':`<span class="dots">${Array.from({length:plan},(_,i)=>`<i class="${i<done?'f':(i===done&&!ex.finished&&done?'c':'')}"></i>`).join('')}</span>`;
  const canRemove=ex.sets.length===0&&!ex.finished;
  const rm=canRemove?`<button type="button" class="row-rm" aria-label="Remover exercício" onclick="event.stopPropagation();ForjaGymUI.removeExerciseCard(${idx})">✕</button>`:'';
  const firstPending=sessionExercises.findIndex(e=>!e.finished);
  const cls=ex.finished?' done':((done&&!ex.finished)||(!done&&idx===firstPending&&!sessionExercises.some(e=>!e.finished&&workDone(e)))?' started':'');
  return `<div class="ex-row${cls}" id="ex-card-${idx}" role="button" tabindex="0" onclick="ForjaGymUI.openExSheet(${idx})">${thumbHtml(photo,'sm')}<div class="row-info"><div class="row-name">${t.escapeHtml(dn(ex.name))}</div><small>${t.escapeHtml(sub)}</small>${dots}</div>${rm}<span class="row-st">${t.escapeHtml(st)}</span></div>`;
}

// ---------- janela do exercício ----------
async function buildSheetHtml(idx){
  const t=T();const ex=sessionExercises[idx];const m=segMode(ex.weightMode);
  const photo=t.getPhotoSync(ex.name)||(root.ForjaExerciseLibrary&&root.ForjaExerciseLibrary.getWgerImageSync(ex.name));
  const N=root.ForjaExerciseNames;const equip=N&&N.equipFor?N.equipFor(ex.name):'';
  const muscle=t.getMuscleSync(ex.name);
  const lastTxt=ex.last&&lastWork(ex).length?`${diaCurto(ex.last.date)}: ${fmtSetsShort(ex.last.sets,ex.weightMode)}`:'primeira vez';
  const seg=`<div class="tipo-seg" role="tablist" aria-label="Tipo de exercício">${MODE_SEG.map(([k,l])=>`<button type="button" class="${m===k?'on':''}" aria-pressed="${m===k}" onclick="ForjaGymUI.setExerciseMode(${idx},'${k}')">${l}</button>`).join('')}</div>`;
  const head=`<div class="sheet-bar"><span class="sheet-grab"></span></div>
    <div class="fh">${photo?`<button type="button" class="ex-thumb lg" onclick="ForjaGymUI.openExercisePhotoPopup(${idx})" aria-label="Ampliar foto"><img src="${photo}" alt="" draggable="false" onerror="this.parentNode.classList.add('ph');this.remove()"></button>`:`<button type="button" class="ex-thumb lg ph" onclick="ForjaGymUI.pickExercisePhoto(${idx})" aria-label="Adicionar foto"></button>`}
    <div class="fh-tx"><b>${t.escapeHtml(dn(ex.name))}</b><small>${t.escapeHtml([muscle,equip].filter(Boolean).join(' · '))} · ${t.escapeHtml(lastTxt)}</small></div>
    <button type="button" class="sheet-x" aria-label="Fechar" onclick="ForjaGymUI.closeExSheet()">✕</button></div>${seg}`;
  if(m==='cardio')return `<div class="ex-card open sheet v3" id="ex-card-${idx}">${head}${buildCardioBody(idx)}${await buildMorePanel(idx)}</div>`;
  const done=workDone(ex),plan=planCount(ex);
  const sg=!done&&!ex.sgApplied?suggestionFor(ex):null;
  const sgHtml=sg?`<button type="button" class="sug" onclick="ForjaGymUI.applySuggestion(${idx})"><span>${t.escapeHtml(sg.text)} <b>${t.escapeHtml(sg.action)}</b></span><em>Usar</em></button>`:'';
  const lw=lastWork(ex);
  const colV=m==='time'?'Tempo':'Reps';
  const showKg=m==='normal'||(m!=='normal'&&(ex.showExtra||ex.weight>0)&&ex.weightMode!=='bodyweight');
  const cols=showKg?'stab-k':'stab-r';
  let rows=`<div class="hd"><span>#</span><span>Anterior</span>${showKg?`<span>${m==='normal'?'kg':'extra'}</span>`:''}<span>${colV}</span><span></span></div>`;
  let wi=0;
  ex.sets.forEach((st,i)=>{
    const isLast=i===ex.sets.length-1;
    const prev=st.warmup?'':(lw[wi]?fmtSetValue(lw[wi],ex.weightMode):'—');
    const label=st.warmup?'A':String(++wi);
    rows+=`<div class="rw f"><span class="sn${st.warmup?' a':''}">${label}</span><span class="ant">${t.escapeHtml(prev)}</span>${showKg?`<span class="cx">${fw(st.weight)}</span>`:''}<span class="cx">${m==='time'?fmtSecs(st.reps):st.reps}</span><button type="button" class="ck" ${isLast?`aria-label="Desfazer esta série" onclick="ForjaGymUI.undoLastSetForCard(${idx})"`:'tabindex="-1" aria-hidden="true"'}>✓</button></div>`;
  });
  for(let k=done;k<plan;k++){
    const cur=k===done;
    const prev=lw[k]?fmtSetValue(lw[k],ex.weightMode):'—';
    const reps=cur?ex.pendingReps:(ex.targetReps||lw[k]?.reps||ex.pendingReps);
    const label=cur&&ex.warmupMode?'A':String(k+1);
    rows+=`<div class="rw ${cur?'c':'p'}"><span class="sn${cur&&ex.warmupMode?' a':''}">${label}</span><span class="ant">${t.escapeHtml(prev)}</span>${showKg?`<span class="cx">${fw(ex.weight)}</span>`:''}<span class="cx">${m==='time'?fmtSecs(reps):reps}</span>${cur?`<button type="button" class="ck" aria-label="Concluir série" onclick="ForjaGymUI.logSetForCard(${idx})">✓</button>`:'<span class="ck" aria-hidden="true"></span>'}</div>`;
  }
  const allDone=done>=plan;
  let timer='';
  if(m==='time'&&!allDone){
    const running=!!ex.timerStart;const el=running?Math.floor((Date.now()-ex.timerStart)/1000):0;const target=ex.pendingReps||30;
    const pct=Math.min(100,Math.round(el/target*100));
    timer=`<div class="crono"><div class="anel" id="time-ring-${idx}" style="--p:${pct}"><div><b id="time-val-${idx}">${running?fmtSecs(el):fmtSecs(target)}</b><small>${running?`meta ${fmtSecs(target)}`:'meta'}</small></div></div></div>
      <div class="metas">${[20,30,45,60,90].map(v=>`<button type="button" class="${target===v?'on':''}" onclick="ForjaGymUI.setTimeTarget(${idx},${v})">${v} s</button>`).join('')}</div>`;
  }
  let ajuste='';
  if(!allDone){
    if(m==='normal')ajuste=`<div class="ajuste"><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},-2.5)">−2,5 kg</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},2.5)">+2,5 kg</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-1)">−1 rep</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},1)">+1 rep</button></div>`;
    else if(m==='time')ajuste=`<div class="ajuste"><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-10)">−10 s</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-5)">−5 s</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},5)">+5 s</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},10)">+10 s</button></div>`;
    else ajuste=`<div class="ajuste"><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-2)">−2</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-1)">−1</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},1)">+1</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},2)">+2</button></div>`;
    if(showKg&&m!=='normal')ajuste+=`<div class="ajuste a2"><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},-2.5)">−2,5 kg extra</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},2.5)">+2,5 kg extra</button></div>`;
  }
  const chips=[`<button type="button" onclick="ForjaGymUI.addPlannedSet(${idx})">+ Série</button>`];
  if(!allDone)chips.push(`<button type="button" class="${ex.warmupMode?'on':''}" onclick="ForjaGymUI.toggleWarmupMode(${idx})">${ex.warmupMode?'✓ ':''}Aquecimento</button>`);
  if(m!=='normal'&&ex.weightMode!=='bodyweight')chips.push(`<button type="button" class="${ex.showExtra||ex.weight>0?'on':''}" onclick="ForjaGymUI.toggleExtraWeight(${idx})">+ Peso extra</button>`);
  chips.push(`<button type="button" onclick="ForjaGymUI.cycleRestPreset()">Descanso ${fmtSecs(restDurationSeconds)}</button>`);
  let cta;
  if(allDone)cta=`<button type="button" class="cta" onclick="ForjaGymUI.finishExercise(${idx})">✓ Finalizar exercício</button>`;
  else if(m==='time')cta=ex.timerStart?`<button type="button" class="cta stop" onclick="ForjaGymUI.stopTimeSet(${idx})">■ Parar e registrar</button>`:`<button type="button" class="cta" onclick="ForjaGymUI.startTimeSet(${idx})">▶ Começar série ${done+1}</button>`;
  else cta=`<button type="button" class="cta" onclick="ForjaGymUI.logSetForCard(${idx})">✓ Concluir série ${done+1}${ex.warmupMode?' (aquecimento)':''}</button>`;
  const fin=!allDone&&done?`<button type="button" class="link-fin" onclick="ForjaGymUI.finishExercise(${idx})">Terminar com ${done} série${done>1?'s':''}</button>`:'';
  return `<div class="ex-card open sheet v3" id="ex-card-${idx}">${head}${sgHtml}${timer}<div class="stab ${cols}">${rows}</div>${ajuste}<div class="mais-chips">${chips.join('')}</div>${await buildMorePanel(idx)}<div class="sheet-cta">${fin}${cta}</div></div>`;
}
function buildCardioBody(idx){
  const ex=sessionExercises[idx];
  const label=s=>{const p=[];if(s.cardioMin)p.push(`${s.cardioMin} min`);if(s.cardioKm)p.push(`${s.cardioKm} km`);if(s.cardioKcal)p.push(`${s.cardioKcal} kcal`);return p.join(' · ')||'registro';};
  const list=ex.sets.length?`<div class="stab stab-r">${ex.sets.map((s,i)=>`<div class="rw f"><span class="sn">${i+1}</span><span class="ant" style="grid-column:span 2">${label(s)}</span><span class="ck">✓</span></div>`).join('')}</div>`:'';
  return `<div class="cardio-input-row">
      <div><label for="cardio-min-${idx}">Minutos</label><input type="number" inputmode="decimal" id="cardio-min-${idx}" placeholder="20"></div>
      <div><label for="cardio-km-${idx}">km</label><input type="number" inputmode="decimal" step="0.1" id="cardio-km-${idx}" placeholder="3"></div>
      <div><label for="cardio-kcal-${idx}">kcal</label><input type="number" inputmode="decimal" id="cardio-kcal-${idx}" placeholder="150"></div>
    </div>${list}
    <div class="sheet-cta">${ex.sets.length?`<button type="button" class="link-fin" onclick="ForjaGymUI.finishExercise(${idx})">Finalizar exercício</button>`:''}<button type="button" class="cta" onclick="ForjaGymUI.logCardioSetForCard(${idx})">✓ Registrar cardio</button></div>`;
}
async function buildMorePanel(idx){
  const t=T();const ex=sessionExercises[idx];
  const open=moreOpenSet.has(idx)||progressionOpenSet.has(idx)||libraryOpenSet.has(idx)||cardTipEditingIdx===idx;
  const btn=`<button type="button" class="more-toggle" aria-expanded="${open}" onclick="ForjaGymUI.toggleMoreOpen(${idx})">${open?'Menos detalhes ▴':'Mais detalhes ▾'}</button>`;
  if(!open)return btn;
  const analysisOpen=progressionOpenSet.has(idx),libraryOpen=libraryOpenSet.has(idx);
  const m=segMode(ex.weightMode);
  const rir=m==='normal'?`<div class="more-row"><span>Quantas ainda dava para fazer?</span><div class="rir3">${['0','1','2','3+'].map(v=>`<button type="button" class="${ex.pendingRir===v?'on':''}" onclick="ForjaGymUI.setCardRir(${idx},'${v}')">${v}</button>`).join('')}</div></div>`:'';
  const fine=m==='normal'?`<div class="more-row"><span>Ajuste fino da carga</span><div class="rir3"><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},-5)">−5</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},-0.1)">−0,1</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},0.1)">+0,1</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},5)">+5</button></div></div>`:'';
  return `${btn}<div class="more-panel v3">${rir}${fine}${buildDicaHtml(idx,ex.name)}
    <div class="more-links"><button type="button" onclick="ForjaGymUI.pickExercisePhoto(${idx})">📷 Foto</button><a href="${t.youtubeSearchUrl(dn(ex.name))}" target="_blank" rel="noopener">▶ Vídeo</a><button type="button" onclick="ForjaGymUI.toggleLibraryOpen(${idx})">📚 Execução</button><button type="button" onclick="ForjaGymUI.toggleProgressionAnalysis(${idx})">📊 Progressão</button></div>
    ${libraryOpen?buildLibraryHtml(idx,ex.name):''}
    ${await buildWeightHistoryHtml(ex.name)}
    ${analysisOpen?await buildProgressionAnalysisHtml(idx,ex.name):''}
    ${await buildSparkHtml(ex.name)}</div>`;
}

// ---------- registrar ----------
let sessionRecordList=[];
async function logSetForCard(idx,repsArg){
  const t=T();const ex=sessionExercises[idx];if(!ex)return;tapFeedback();
  const m=segMode(ex.weightMode);
  const reps=Math.round(repsArg!=null?repsArg:(ex.pendingReps||0));if(!(reps>0)){showToast(m==='time'?'Ajuste o tempo antes de registrar.':'Ajuste as repetições antes de registrar.');return;}
  const isWarmup=!!ex.warmupMode,rir=ex.pendingRir||'';
  let prevBest=0;
  if(!isWarmup){
    if(m==='normal')prevBest=await t.bestHistoricalRM(ex.name);
    else{const arr=await t.loadWorkouts();arr.filter(e=>e.name.trim()===ex.name&&e.id!==ex.workoutId).forEach(e=>t.parseRepsList(e.reps).forEach(r=>{if(r>prevBest)prevBest=r;}));ex.sets.filter(x=>!x.warmup).forEach(x=>{if(x.reps>prevBest)prevBest=x.reps;});}
  }
  ex.sets.push({weight:ex.weight,reps,warmup:isWarmup,rir});ex.pendingRir=null;ex.warmupMode=false;ex.timerStart=null;stopTimeTick(ex);
  const k=workDone(ex);
  ex.pendingReps=m==='time'?(ex.targetReps||ex.pendingReps):(ex.targetReps||lastWork(ex)[k]?.reps||reps);
  await persistCardSets(idx);await renderCard(idx);await renderMuscleOverview();await renderTodayList();renderHeroStats();
  const val=fmtSetValue({weight:ex.weight,reps},ex.weightMode);
  const score=m==='normal'?t.epley1RM(ex.weight,reps):reps;
  if(isWarmup)showToast(`Aquecimento registrado: ${val}`,{label:'Desfazer',onClick:()=>undoLastSetForCard(idx)});
  else if(prevBest>0&&score>prevBest){sessionRecords++;sessionRecordList.push(`${dn(ex.name)} · ${val}`);if(root.navigator?.vibrate)root.navigator.vibrate([40,50,40,50,120]);showToast(`🏆 Recorde em ${dn(ex.name)}: ${val}`,{label:'Desfazer',onClick:()=>undoLastSetForCard(idx)});}
  else showToast(`✓ Série ${k} registrada: ${val}`,{label:'Desfazer',onClick:()=>undoLastSetForCard(idx)});
  if(!isWarmup)startRestTimer();
}
async function undoLastSetForCard(idx){
  const ex=sessionExercises[idx];if(!ex||!ex.sets.length)return;tapFeedback();
  const st=ex.sets.pop();ex.pendingReps=st.reps;if(st.warmup)ex.warmupMode=true;
  if(sessionRecordList.length&&sessionRecordList[sessionRecordList.length-1].startsWith(dn(ex.name)+' ·'))sessionRecordList.pop();
  await persistCardSets(idx);await renderCard(idx);await renderTodayList();renderHeroStats();
  showToast('Série desfeita.');
}
async function finishExercise(idx){
  tapFeedback();const ex=sessionExercises[idx];if(!ex||!ex.sets.length)return;ex.finished=true;stopTimeTick(ex);
  await closeExSheet();renderHeroStats();
  const next=sessionExercises.findIndex(e=>!e.finished);
  showToast(next>=0?`✓ ${dn(ex.name)} feito. Próximo: ${dn(sessionExercises[next].name)}`:`✓ ${dn(ex.name)} feito. Era o último: toque em Finalizar.`);
}

// ---------- tempo ----------
function setTimeTarget(idx,v){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.pendingReps=v;ex.targetReps=v;ex.timeTarget=v;renderCard(idx);}
function startTimeSet(idx){
  tapFeedback();const ex=sessionExercises[idx];if(!ex)return;pularRest(true);
  ex.timerStart=Date.now();ex.timerBeeped=false;renderCard(idx);keepAwake(true);
  clearInterval(timeTickInterval);
  timeTickInterval=setInterval(()=>{
    if(!ex.timerStart){clearInterval(timeTickInterval);return;}
    const el=Math.floor((Date.now()-ex.timerStart)/1000);const target=ex.pendingReps||30;
    const v=$(`time-val-${idx}`);if(v)v.textContent=fmtSecs(el);
    const r=$(`time-ring-${idx}`);if(r)r.style.setProperty('--p',Math.min(100,Math.round(el/target*100)));
    if(el>=target&&!ex.timerBeeped){ex.timerBeeped=true;beep(880,.25);if(root.navigator?.vibrate)root.navigator.vibrate([120,60,120]);if(r)r.classList.add('meta');}
  },250);
}
function stopTimeTick(ex){if(ex)ex.timerStart=ex.timerStart&&false;clearInterval(timeTickInterval);timeTickInterval=null;}
async function stopTimeSet(idx){
  const ex=sessionExercises[idx];if(!ex||!ex.timerStart)return;
  const el=Math.max(1,Math.round((Date.now()-ex.timerStart)/1000));ex.timerStart=null;clearInterval(timeTickInterval);
  const keepTarget=ex.pendingReps;await logSetForCard(idx,el);ex.pendingReps=keepTarget;renderCard(idx);
}

// ---------- descanso em tela cheia ----------
const REST_PRESETS=[45,60,90,120,180];
function syncRestLabel(){root.document.querySelectorAll('[data-rest-label]').forEach(e=>e.textContent=fmtSecs(restDurationSeconds));}
function cycleRestPreset(){tapFeedback();const i=REST_PRESETS.indexOf(restDurationSeconds);restDurationSeconds=REST_PRESETS[(i+1)%REST_PRESETS.length]||60;saveRestPref();syncRestLabel();if(sheetIdx!==null)renderCard(sheetIdx);showToast(`Descanso: ${fmtSecs(restDurationSeconds)}`);}
function saveRestPref(){try{T().storage().set('gym-rest-seconds',String(restDurationSeconds));}catch{}}
async function loadRestPref(){try{const r=await T().storage().get('gym-rest-seconds');const v=parseInt(r?.value,10);if(v>=15)restDurationSeconds=v;}catch{}}
function adjustRestDuration(delta){tapFeedback();if(restInterval){restRemaining=Math.max(5,restRemaining+delta);restTotal=Math.max(restTotal,restRemaining);updateRestDisplay();}restDurationSeconds=Math.max(15,restDurationSeconds+delta);saveRestPref();syncRestLabel();}
let restTotal=60;
function nextUpInfo(){
  const t=T();
  const cur=sheetIdx!==null?sessionExercises[sheetIdx]:null;
  const pick=ex=>{const d=workDone(ex),p=planCount(ex);if(d<p&&!ex.finished)return{nm:`${dn(ex.name)} · série ${d+1} de ${p}`,val:fmtSetValue({weight:ex.weight,reps:ex.pendingReps},ex.weightMode)};return null;};
  let info=cur?pick(cur):null;
  if(!info){const nx=sessionExercises.find(e=>!e.finished&&e!==cur);if(nx)info=pick(nx)||{nm:dn(nx.name),val:''};}
  return info?`<small>Próxima</small><b>${t.escapeHtml(info.nm)}</b><span>${t.escapeHtml(info.val)}</span>`:'<small>Próxima</small><b>Último exercício feito</b><span>Toque em Finalizar treino</span>';
}
function openRestModal(){const ov=$('rest-modal-overlay');if(ov){ov.style.display='flex';ov.classList.add('rest-full');}const mini=$('rest-mini');if(mini)mini.hidden=true;}
function closeRestModal(){tapFeedback();const ov=$('rest-modal-overlay');if(ov)ov.style.display='none';const mini=$('rest-mini');if(mini)mini.hidden=!restInterval;}
function toggleRestPop(){openRestModal();}
function startRestTimer(){
  restRemaining=restDurationSeconds;restTotal=restDurationSeconds;restWarned=false;
  const ov=$('rest-modal-overlay');if(!ov)return;
  ov.innerHTML=`<div class="rest-screen" role="timer" aria-live="off">
    <span class="rest-lb">Descanso</span>
    <div class="anel rest-anel" id="rest-ring" style="--p:100"><div><b id="rest-countdown">${fmtSecs(restRemaining)}</b><small>de ${fmtSecs(restTotal)}</small></div></div>
    <div class="prox" id="rest-next">${nextUpInfo()}</div>
    <div class="rest-bts"><button type="button" onclick="ForjaGymUI.adjustRestDuration(-15)">−15s</button><button type="button" onclick="ForjaGymUI.adjustRestDuration(15)">+15s</button><button type="button" class="pl" onclick="ForjaGymUI.pularRest()">Pular</button></div>
    <button type="button" class="rest-min" onclick="ForjaGymUI.closeRestModal()">Minimizar</button>
    <span class="rest-hint">A tela fica acesa · vibra 3 s antes do fim</span></div>`;
  openRestModal();keepAwake(true);
  let mini=$('rest-mini');
  if(!mini){mini=root.document.createElement('div');mini.id='rest-mini';mini.innerHTML=`<button type="button" class="rm-open" onclick="ForjaGymUI.openRestModal()"><span class="rm-rg" id="rest-mini-ring"></span><span><b id="rest-mini-val"></b><small>descanso</small></span></button><button type="button" class="rm-skip" onclick="ForjaGymUI.pularRest()">Pular</button>`;root.document.body.appendChild(mini);}
  mini.hidden=true;
  updateRestDisplay();clearInterval(restInterval);
  restInterval=setInterval(()=>{
    restRemaining--;
    if(restRemaining<=3&&!restWarned){restWarned=true;if(root.navigator?.vibrate)root.navigator.vibrate(300);}
    if(restRemaining<=0){pularRest(true);beep(990,.3);if(root.navigator?.vibrate)root.navigator.vibrate([100,80,100]);showToast('Descanso acabou. Próxima série!');return;}
    updateRestDisplay();
  },1000);
}
function updateRestDisplay(){
  const v=fmtSecs(restRemaining);const el=$('rest-countdown');if(el)el.textContent=v;const mv=$('rest-mini-val');if(mv)mv.textContent=v;
  const pct=restTotal?Math.round(restRemaining/restTotal*100):0;const r=$('rest-ring');if(r)r.style.setProperty('--p',pct);const mr=$('rest-mini-ring');if(mr)mr.style.setProperty('--p',pct);
}
function adiarRest(){adjustRestDuration(15);}
function pularRest(silent){if(!silent)tapFeedback();clearInterval(restInterval);restInterval=null;const ov=$('rest-modal-overlay');if(ov)ov.style.display='none';const mini=$('rest-mini');if(mini)mini.hidden=true;if(!activeSessionStartTs)keepAwake(false);}
let audioCtx=null;
function beep(f,d){try{audioCtx=audioCtx||new (root.AudioContext||root.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=f||880;o.connect(g);g.connect(audioCtx.destination);g.gain.setValueAtTime(.15,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+(d||.2));o.start();o.stop(audioCtx.currentTime+(d||.2));}catch{}}
async function keepAwake(on){
  try{
    if(on&&!wakeLockRef&&root.navigator?.wakeLock){wakeLockRef=await root.navigator.wakeLock.request('screen');wakeLockRef.addEventListener?.('release',()=>{wakeLockRef=null;});}
    else if(!on&&wakeLockRef){await wakeLockRef.release();wakeLockRef=null;}
  }catch{wakeLockRef=null;}
}
if(root.document)root.document.addEventListener('visibilitychange',()=>{if(root.document.visibilityState==='visible'&&(activeSessionStartTs||restInterval))keepAwake(true);});

// ---------- tela final ----------
async function showSummary(){
  const d=pendingSummary;pendingSummary=null;if(!d)return;
  const t=T();const doc=root.document;
  let ov=doc.getElementById('summary-overlay');if(ov)ov.remove();
  ov=doc.createElement('div');ov.id='summary-overlay';ov.className='rpe-modal-overlay sum-v3';
  const status=await t.computeWeeklyGoal();
  const ng=await nextGroup();
  const dt=new Date();const sub=`${DIAS_CURTOS[dt.getDay()]} · ${status.done}º treino da semana${status.done>=status.target?' · meta batida':''}`;
  const phrase=COMPLETION_PHRASES[Math.floor(Math.random()*COMPLETION_PHRASES.length)];
  ov.innerHTML=`<div class="rpe-sheet sum-sheet v3" role="dialog" aria-label="Treino concluído">
    <div class="sum-check"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></div>
    <h2>${t.escapeHtml(d.group||'Treino')} concluído</h2><div class="sub">${t.escapeHtml(sub)}</div>
    <div class="sum-grid"><div><b data-n="${d.durationMin}">0</b><span>minutos</span></div><div><b data-n="${d.sets}">0</b><span>séries</span></div><div><b data-n="${d.volume}">0</b><span>kg levantados</span></div><div><b data-n="${d.kcal}" data-pre="~">0</b><span>kcal estimadas</span></div></div>
    ${d.records.length?`<div class="sum-rec"><span class="md"></span><span><b>${d.records.length} recorde${d.records.length>1?'s':''}</b><small>${d.records.map(r=>t.escapeHtml(r)).join(' · ')}</small></span></div>`:''}
    <div class="esf"><small>Esforço (opcional)</small><div class="seg10">${RPE_LEVELS.map(l=>`<button type="button" data-v="${l.v}" onclick="ForjaGymUI.selectSummaryRpe('${d.sessionId}',${l.v})">${l.v}</button>`).join('')}</div><span class="esf-l" id="sum-rpe-label"></span></div>
    ${ng?`<div class="nx">Próximo: <b>${t.escapeHtml(ng.g.name)}</b></div>`:''}
    <p class="sum-phrase">${t.escapeHtml(phrase)}</p>
    <button class="primary" type="button" onclick="document.getElementById('summary-overlay').remove()">Fechar</button>
    <div class="sum-note">Calorias são uma estimativa (MET × seu peso × tempo).</div></div>`;
  doc.body.appendChild(ov);ov.style.display='flex';
  const reduce=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  ov.querySelectorAll('[data-n]').forEach(el=>{const fim=+el.dataset.n,pre=el.dataset.pre||'';const fmt=v=>pre+(v>=1000?v.toLocaleString('pt-BR'):v);if(reduce){el.textContent=fmt(fim);return;}const t0=performance.now();(function f(n){const p=Math.min(1,(n-t0)/900);el.textContent=fmt(Math.round(fim*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(f);})(t0);});
}
async function selectSummaryRpe(sessionId,v){
  tapFeedback();const t=T();const sessions=await t.loadSessionsCache();const s=sessions.find(x=>x.id===sessionId);if(s){s.rpe=v;await t.persistSessionsCache();}
  root.document.querySelectorAll('#summary-overlay .seg10 button').forEach(b=>b.classList.toggle('on',+b.dataset.v===v));
  const l=RPE_LEVELS.find(x=>x.v===v);const lb=$('sum-rpe-label');if(lb)lb.textContent=l?l.label:'';
}

// ---------- painel "Hoje" ----------
async function groupLastInfo(g){
  const t=T();const arr=await t.loadWorkouts();const today=t.todayKey();
  const names=new Set(g.exercises);const byDate={};
  arr.forEach(e=>{if(e.date===today||!names.has(e.name.trim()))return;(byDate[e.date]=byDate[e.date]||[]).push(e);});
  const dates=Object.keys(byDate).filter(d=>new Set(byDate[d].map(e=>e.name.trim())).size>=Math.max(1,Math.ceil(g.exercises.length/2))).sort();
  if(!dates.length)return null;
  const d=dates[dates.length-1];let sets=0,vol=0;
  byDate[d].forEach(e=>{const mode=segMode(t.getWeightModeSync(e.name.trim()));entrySets(e).forEach(x=>{if(x.warmup)return;sets++;if(mode==='normal')vol+=(x.weight||0)*(x.reps||0);});});
  return{date:d,sets,vol:Math.round(vol)};
}
async function nextGroup(){
  const t=T();const groups=await t.loadWorkoutGroups();if(!groups.length)return null;
  let explicit=null;try{const r=await t.storage().get(K_LAST_GROUP);explicit=r?.value?JSON.parse(r.value):null;}catch{}
  const infos=await Promise.all(groups.map(groupLastInfo));
  let bestI=-1,bestD='';
  infos.forEach((inf,i)=>{if(inf&&inf.date>bestD){bestD=inf.date;bestI=i;}});
  if(explicit){const ei=groups.findIndex(g=>g.id===explicit.id);if(ei>=0&&explicit.date>=bestD){bestI=ei;bestD=explicit.date;}}
  const i=bestI<0?0:(bestI+1)%groups.length;
  return{g:groups[i],info:infos[i],groups,infos};
}
async function renderHoje(){
  const host=$('ac-hoje');if(!host)return;const t=T();
  await t.loadMuscleCache();await t.loadWeightModeCache();
  const dt=new Date();const dstr=`${['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][dt.getDay()]} · ${dt.getDate()} ${MESES_CURTOS[dt.getMonth()]}`;
  const ng=await nextGroup();
  let html;
  if(!ng){
    html=`<div class="hj"><div class="hj-d">${dstr}</div><div class="hj-t">Monte seu treino</div><div class="hj-s">Crie seus treinos A, B, C ou use um pronto. Depois o app sugere qual é o da vez.</div>
      <button type="button" class="hj-go" onclick="ForjaGymUI.openGroupsCard('ready-workouts-card')">Ver treinos prontos<i>▶</i></button>
      <div class="hj-trocar"><button type="button" onclick="ForjaGymUI.startFreeWorkout()">Treino livre</button><button type="button" onclick="ForjaGymUI.openGroupsCard('workout-groups-card',true)">+ Criar treino</button></div></div>`;
  }else{
    const g=ng.g;const muscles=[...new Set(g.exercises.map(n=>t.getMuscleSync(n)).filter(Boolean))].slice(0,3);
    const sessions=await t.loadSessionsCache();const gs=sessions.filter(s=>s.groupId===g.id&&s.durationMin);
    const dur=gs.length?Math.round(gs.reduce((a,s)=>a+s.durationMin,0)/gs.length):Math.max(20,g.exercises.length*8);
    const inf=ng.info;
    const ult=inf?`<div class="hj-ult"><div><b>${diaCurto(inf.date)}</b><span>última vez</span></div><div><b>${inf.sets}</b><span>séries</span></div><div><b>${inf.vol?inf.vol.toLocaleString('pt-BR'):'—'}</b><span>kg no total</span></div></div>`:`<div class="hj-ult one"><div><b>Primeira vez</b><span>com este treino</span></div></div>`;
    const others=ng.groups.filter(x=>x.id!==g.id);
    html=`<div class="hj"><div class="hj-d">${dstr}</div><div class="hj-t">Hoje: ${t.escapeHtml(g.name)}</div>
      <div class="hj-s">${t.escapeHtml(muscles.join(', ')||'Treino')} · ${g.exercises.length} exercício${g.exercises.length===1?'':'s'} · ~${dur} min</div>${ult}
      <button type="button" class="hj-go" onclick="ForjaGymUI.loadWorkoutGroupToSession('${g.id}')">Começar ${t.escapeHtml(g.name)}<i>▶</i></button>
      <div class="hj-trocar"><span>Trocar:</span>${others.slice(0,4).map(x=>`<button type="button" onclick="ForjaGymUI.loadWorkoutGroupToSession('${x.id}')">${t.escapeHtml(x.name)}</button>`).join('')}<button type="button" onclick="ForjaGymUI.startFreeWorkout()">Livre</button></div></div>`;
  }
  // semana
  const status=await t.computeWeeklyGoal();
  const mon=t.getMonday(new Date());const arr=await t.loadWorkouts();const sessions=await t.loadSessionsCache();
  const trained=new Set([...arr.map(e=>e.date),...sessions.map(s=>s.date)]);
  const today=t.todayKey();
  const days=['S','T','Q','Q','S','S','D'].map((l,i)=>{const d=t.addDays(mon,i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return `<i class="${trained.has(k)?'f':''}${k===today?' h':''}" title="${k}">${l}</i>`;}).join('');
  const sub=status.compensating?`${status.baseGoal} da meta + ${status.shortfall} da semana passada`:'treinos na semana';
  html+=`<div class="semana"><div class="dias">${days}</div><div><b>${status.done} de ${status.target}</b><small>${sub}</small></div></div>
    <div class="bento b3"><button type="button" onclick="ForjaGymUI.openGroupsCard('workout-groups-card')"><span class="ic">☰</span><b>Meus treinos</b><small>${ng?ng.groups.map(x=>t.escapeHtml(x.name.replace(/^Treino\s+/i,''))).slice(0,4).join(' · '):'criar'}</small></button>
    <button type="button" onclick="switchTab('biblioteca')"><span class="ic">⌕</span><b>Exercícios</b><small>900+</small></button>
    <button type="button" onclick="ForjaGymUI.openGroupsCard('gym-sessions-chart-card')"><span class="ic">↗</span><b>Evolução</b><small>carga e tempo</small></button></div>`;
  host.innerHTML=html;
}
function openGroupsCard(id,newForm){
  tapFeedback();const el=$(id);if(!el)return;
  const d=el.closest('details')||el.querySelector('details');if(d)d.open=true;
  el.classList.remove('cc-closed','collapsed');el.querySelector('.cc-head[aria-expanded="false"]')?.click();
  if(newForm)showNewGroupForm();
  el.scrollIntoView({behavior:'smooth',block:'start'});
}

// ---------- números do treino em andamento ----------
async function renderHeroStats(){
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
  const st=computeSessionStats();
  let done=0,plan=0;sessionExercises.forEach(ex=>{if(segMode(ex.weightMode)==='cardio'){plan+=1;done+=ex.sets.length?1:0;return;}const d=workDone(ex);done+=d;plan+=ex.finished?d:planCount(ex);});
  set('session-live',plan?`${done} de ${plan} séries`:'escolha os exercícios');
  set('tr-vol',st.vol?`${Math.round(st.vol).toLocaleString('pt-BR')} kg`:'');
  const f=$('tr-prog-fill');if(f)f.style.width=(plan?Math.round(done/plan*100):0)+'%';
}
function computeSessionStats(){
  let sets=0,vol=0,cardioKcal=0,exs=0;const names=[];
  (sessionExercises||[]).forEach(ex=>{let any=false;const m=segMode(ex.weightMode);(ex.sets||[]).forEach(x=>{if(m==='cardio'){cardioKcal+=x.cardioKcal||0;any=true;return;}if(x.warmup)return;sets++;any=true;if(m==='normal'||ex.weightMode==='bodyweight')vol+=(x.weight||0)*(x.reps||0);else if(m==='none')vol+=(x.weight||0)*(x.reps||0);});if(any){exs++;names.push(ex.name);}});
  return{sets,vol,cardioKcal,exs,names};
}

// ---------- treino de hoje (histórico do dia) ----------
async function renderTodayList(){
  try{renderHeroStats();}catch{}
  const t=T();const el=$('today-list');if(!el)return;
  await t.loadWeightModeCache();
  const arr=await t.loadWorkouts();const todays=arr.filter(e=>e.date===t.todayKey());
  if(todays.length===0){el.innerHTML='<div class="empty">Nada registrado hoje ainda.</div>';return;}
  el.innerHTML=todays.map(e=>{
    const cmin=t.parseCardioList(e.cardioMin),ckm=t.parseCardioList(e.cardioKm),ckcal=t.parseCardioList(e.cardioKcal);
    const isCardio=cmin.some(v=>v)||ckm.some(v=>v)||ckcal.some(v=>v);
    let txt;
    if(isCardio){const tm=cmin.reduce((s,v)=>s+(v||0),0),tk=ckm.reduce((s,v)=>s+(v||0),0),tc=ckcal.reduce((s,v)=>s+(v||0),0);const p=[];if(tm)p.push(`${tm} min`);if(tk)p.push(`${String(tk).replace('.',',')} km`);if(tc)p.push(`${tc} kcal`);txt=p.join(' · ');}
    else txt=fmtSetsShort(entrySets(e),t.getWeightModeSync(e.name.trim()));
    return `<div class="today-row"><b>${t.escapeHtml(dn(e.name.trim()))}</b><span>${t.escapeHtml(txt)}</span></div>`;
  }).join('');
}
