/* Forja — "O que você comeu?": escreve, dita, grava áudio ou tira foto, e a IA (Gemini, com a
   chave do próprio usuário) devolve os itens com calorias e macros. Confere, tira o que não quer
   e lança na refeição. Só na versão completa. */
(function(root){
'use strict';
const doc=root.document,$=id=>doc.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
const g1=n=>n==null||isNaN(n)?null:Math.round(Number(n)*10)/10;
const tap=()=>{try{navigator.vibrate?.(8);}catch{}};
const toast=(m,a)=>root.showToast?.(m,a);
const GV=()=>root.ForjaGeminiVision;
const REFS=[['cafe','☕ Café'],['almoco','🍛 Almoço'],['lanche','🍪 Lanche'],['janta','🍲 Janta'],['ceia','🌙 Ceia']];

let st={foto:null,res:null,ref:null,busy:false,ouvindo:null,gravando:null,temChave:null};

const PROMPT=`Você é um nutricionista brasileiro. A pessoa vai dizer o que comeu (por texto, áudio e/ou foto).
Separe cada alimento ou bebida e estime: quantidade em medida caseira (qty, ex.: "2 colheres de sopa", "1 unidade média"), gramas ou ml, calorias e macros.
Use valores típicos do Brasil (tabela TACO e rótulos comuns). Se a quantidade não foi dita, use a porção mais comum e deixe isso claro em qty.
Se houver áudio, transcreva fielmente em "transcricao" (português). Se a pessoa disser a refeição (café, almoço, lanche, janta, ceia), preencha "refeicao".
Responda SÓ em JSON neste formato:
{"transcricao":"","refeicao":"cafe|almoco|lanche|janta|ceia|","items":[{"name":"","qty":"","grams":0,"kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}],"note":"observação curta, se precisar"}`;

function totais(items){
  const t={kcal:0,protein_g:0,carbs_g:0,fat_g:0};
  items.forEach(i=>{t.kcal+=Number(i.kcal)||0;t.protein_g+=Number(i.protein_g)||0;t.carbs_g+=Number(i.carbs_g)||0;t.fat_g+=Number(i.fat_g)||0;});
  return {kcal:Math.round(t.kcal),protein_g:g1(t.protein_g),carbs_g:g1(t.carbs_g),fat_g:g1(t.fat_g)};
}
function refPadrao(){try{return root.Forja3.mealDaHora();}catch{return 'lanche';}}

async function montar(){
  const host=$('ia3');if(!host)return;
  if(!host.dataset.ok){
    host.dataset.ok='1';
    host.innerHTML=`<div class="f3-card ia-card">
      <div class="f3-t">O que você comeu?</div>
      <div id="ia-chave"></div>
      <div class="ia-foto" id="ia-foto" hidden></div>
      <textarea id="ia-texto" rows="3" placeholder="Ex.: 2 ovos mexidos, 1 pão francês com requeijão e café com leite" aria-label="O que você comeu"></textarea>
      <div class="ia-acoes">
        <button type="button" id="ia-ditar" onclick="ForjaIA.ditar()"><span>🎤</span>Ditar</button>
        <button type="button" id="ia-gravar" onclick="ForjaIA.gravar()"><span>🎙️</span>Áudio</button>
        <button type="button" onclick="document.getElementById('ia-foto-in').click()"><span>📷</span>Foto</button>
      </div>
      <input type="file" id="ia-foto-in" accept="image/*" capture="environment" hidden onchange="ForjaIA.escolherFoto(event)">
      <button type="button" class="f3-cta" id="ia-calc" onclick="ForjaIA.calcular()">✨ Calcular com IA</button>
      <p class="f3-nota" id="ia-status" role="status" aria-live="polite"></p>
      <div id="ia-res"></div>
      <div id="ia-atalhos"></div>
    </div>`;
    // os atalhos que já existiam passam a morar aqui
    const sc=$('quick-shortcuts');if(sc)$('ia-atalhos').appendChild(sc);
  }
  await chave();
}
async function chave(){
  const box=$('ia-chave');if(!box)return;
  const k=await GV()?.getApiKey?.();st.temChave=!!k;
  box.innerHTML=k?'':`<div class="ia-liga"><b>Ligar a IA (uma vez só)</b>
    <ol><li>Abra <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> com sua conta Google.</li><li>Toque em <b>Criar chave de API</b> e copie.</li><li>Cole aqui e salve.</li></ol>
    <div class="ia-liga-row"><input id="ia-chave-in" placeholder="Cole a chave aqui" autocomplete="off" spellcheck="false"><button type="button" onclick="ForjaIA.salvarChave()">Salvar</button></div>
    <small>A chave fica só neste aparelho. O texto, o áudio e a foto vão direto do celular para o Gemini.</small></div>`;
}
async function salvarChave(){
  const v=($('ia-chave-in')?.value||'').trim();if(v.length<20){toast('Essa chave parece incompleta.');return;}
  await GV().setApiKey(v);try{await GV().renderKeyStatus?.();}catch{}toast('Chave salva. IA ligada ✓');await chave();
}
function status(t){const e=$('ia-status');if(e)e.textContent=t||'';}
function ocupado(on,t){st.busy=on;const b=$('ia-calc');if(b){b.disabled=on;b.textContent=on?'⏳ Calculando…':'✨ Calcular com IA';}status(t||'');}

// ---------- foto ----------
function escolherFoto(ev){
  const f=ev.target.files&&ev.target.files[0];ev.target.value='';if(!f)return;
  const r=new FileReader();
  r.onload=()=>{const url=String(r.result);st.foto={base64:url.split(',')[1],mime:f.type||'image/jpeg'};
    const box=$('ia-foto');box.hidden=false;box.innerHTML=`<img src="${url}" alt="Foto da refeição"><button type="button" aria-label="Tirar a foto" onclick="ForjaIA.tirarFoto()">✕</button>`;
    status('Foto pronta. Se quiser, conte o que a foto não mostra e toque em Calcular.');};
  r.readAsDataURL(f);
}
function tirarFoto(){st.foto=null;const b=$('ia-foto');if(b){b.hidden=true;b.innerHTML='';}}

// ---------- ditado (transcrição ao vivo no campo) ----------
function ditar(){
  tap();const R=root.SpeechRecognition||root.webkitSpeechRecognition;const btn=$('ia-ditar');const ta=$('ia-texto');
  if(st.ouvindo){st.ouvindo.stop();return;}
  const nat=root.Capacitor&&root.Capacitor.isNativePlatform&&root.Capacitor.isNativePlatform()?root.Capacitor.Plugins?.ForjaSaude:null;
  if(nat){ // dentro do app Android: o ditado do navegador não existe, usa o do Android
    const base=ta.value.trim();let h=null;
    st.ouvindo={stop:()=>nat.parar()};btn.classList.add('on');btn.innerHTML='<span>🔴</span>Parar';status('Ouvindo… fale o que comeu.');
    nat.addListener('parcial',e=>{ta.value=[base,e.texto].filter(Boolean).join(' ');}).then(x=>h=x);
    nat.ouvir().then(r=>{if(r&&r.texto)ta.value=[base,r.texto].filter(Boolean).join(' ');})
      .catch(e=>toast(e.message||'Não consegui ouvir.'))
      .finally(()=>{try{h&&h.remove();}catch{}btn.classList.remove('on');btn.innerHTML='<span>🎤</span>Ditar';st.ouvindo=null;status(ta.value.trim()?'Confira o texto e toque em Calcular com IA.':'');});
    return;
  }
  if(!R){toast('Ditado não disponível neste navegador. Use o 🎤 do teclado ou o botão Áudio.');return;}
  const rec=new R();rec.lang='pt-BR';rec.interimResults=true;rec.continuous=true;
  const base=ta.value.trim();let final='';
  rec.onstart=()=>{btn.classList.add('on');btn.innerHTML='<span>🔴</span>Parar';status('Ouvindo… fale o que comeu.');};
  rec.onresult=e=>{let inter='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)final+=(final?' ':'')+t.trim();else inter+=t;}
    ta.value=[base,final,inter.trim()].filter(Boolean).join(' ');};
  rec.onerror=e=>{if(e.error==='not-allowed')toast('Permita o microfone para ditar.');else if(e.error!=='no-speech'&&e.error!=='aborted')toast('Não consegui ouvir. Tente de novo.');};
  rec.onend=()=>{btn.classList.remove('on');btn.innerHTML='<span>🎤</span>Ditar';st.ouvindo=null;status(ta.value.trim()?'Confira o texto e toque em Calcular com IA.':'');};
  st.ouvindo=rec;try{rec.start();}catch{st.ouvindo=null;}
}

// ---------- áudio (grava, a IA transcreve e calcula de uma vez) ----------
async function gravar(){
  tap();const btn=$('ia-gravar');
  if(st.gravando){st.gravando.rec.stop();return;}
  if(!navigator.mediaDevices?.getUserMedia||!root.MediaRecorder){toast('Gravação não disponível neste navegador. Use o Ditar.');return;}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch{toast('Permita o microfone para gravar.');return;}
  const rec=new MediaRecorder(stream);const parts=[];const t0=Date.now();
  rec.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data);};
  const tick=setInterval(()=>{const s=Math.floor((Date.now()-t0)/1000);btn.innerHTML=`<span>⏹</span>${s}s`;if(s>=90)rec.stop();},250);
  rec.onstop=async()=>{clearInterval(tick);stream.getTracks().forEach(t=>t.stop());st.gravando=null;btn.classList.remove('on');btn.innerHTML='<span>🎙️</span>Áudio';
    const blob=new Blob(parts,{type:rec.mimeType||'audio/webm'});if(blob.size<1500){status('Áudio muito curto.');return;}
    try{ocupado(true,'Preparando o áudio…');const wav=await paraWav(blob);await calcular({audio:wav});}
    catch(e){ocupado(false,'Não consegui usar esse áudio: '+(e.message||'erro')+'. Tente o Ditar.');}};
  st.gravando={rec};rec.start(250);btn.classList.add('on');status('Gravando… fale o que comeu e toque em ⏹ para terminar.');
}
// converte o que o celular gravou (webm/mp4) para WAV 16 kHz mono, formato que o Gemini aceita
async function paraWav(blob){
  const buf=await blob.arrayBuffer();const AC=root.AudioContext||root.webkitAudioContext;const ac=new AC();
  const audio=await new Promise((ok,er)=>{const p=ac.decodeAudioData(buf,ok,er);if(p&&p.then)p.then(ok,er);});
  try{ac.close();}catch{}
  const sr=16000,len=Math.ceil(audio.duration*sr);const off=new OfflineAudioContext(1,len,sr);
  const src=off.createBufferSource();src.buffer=audio;src.connect(off.destination);src.start();
  const out=await off.startRendering();const pcm=out.getChannelData(0);
  const ab=new ArrayBuffer(44+pcm.length*2);const v=new DataView(ab);const w=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  w(0,'RIFF');v.setUint32(4,36+pcm.length*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,pcm.length*2,true);
  for(let i=0;i<pcm.length;i++){const x=Math.max(-1,Math.min(1,pcm[i]));v.setInt16(44+i*2,x<0?x*0x8000:x*0x7fff,true);}
  let bin='';const u=new Uint8Array(ab);for(let i=0;i<u.length;i+=0x8000)bin+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));
  return btoa(bin);
}

// ---------- IA ----------
async function calcular(extra={}){
  tap();if(st.busy&&!extra.audio)return;
  if(!st.temChave){await chave();if(!st.temChave){toast('Ligue a IA primeiro: cole sua chave do Gemini.');$('ia-chave-in')?.focus();ocupado(false);return;}}
  const texto=($('ia-texto')?.value||'').trim();
  if(!texto&&!st.foto&&!extra.audio){toast('Escreva, dite, grave ou tire uma foto do que comeu.');return;}
  const parts=[{text:PROMPT}];
  if(texto)parts.push({text:'O que a pessoa escreveu: '+texto});
  if(st.foto)parts.push({inline_data:{mime_type:st.foto.mime,data:st.foto.base64}});
  if(extra.audio)parts.push({inline_data:{mime_type:'audio/wav',data:extra.audio}});
  ocupado(true,extra.audio?'Ouvindo o áudio e calculando…':'Calculando…');
  try{
    const r=await GV().generate(parts);
    const items=(Array.isArray(r.items)?r.items:[]).filter(i=>i&&i.name&&Number(i.kcal)>=0).map(i=>({name:String(i.name),qty:String(i.qty||''),grams:Number(i.grams)||null,kcal:Math.round(Number(i.kcal)||0),protein_g:g1(i.protein_g),carbs_g:g1(i.carbs_g),fat_g:g1(i.fat_g)}));
    if(r.transcricao&&extra.audio){const ta=$('ia-texto');ta.value=[ta.value.trim(),String(r.transcricao).trim()].filter(Boolean).join(' ');}
    if(!items.length)throw new Error('A IA não encontrou alimentos nisso. Descreva com mais detalhes.');
    st.res={items,note:r.note||''};
    if(!st.ref)st.ref=REFS.some(([k])=>k===r.refeicao)?r.refeicao:refPadrao();
    ocupado(false,'Confira e toque em Lançar. Se algo estiver errado, corrija o texto e calcule de novo.');
    mostrar();
  }catch(e){ocupado(false,e.message||'Não consegui calcular. Tente de novo.');}
}
function mostrar(){
  const box=$('ia-res');if(!box)return;const r=st.res;if(!r){box.innerHTML='';return;}
  const t=totais(r.items);
  box.innerHTML=`<div class="ia-itens">${r.items.map((i,n)=>`<div class="ia-it"><div><b>${esc(i.name)}</b><small>${esc(i.qty||(i.grams?i.grams+' g':''))}</small></div><span>${nf(i.kcal)} kcal${i.protein_g!=null?`<small>P ${String(i.protein_g).replace('.',',')} g</small>`:''}</span><button type="button" aria-label="Tirar ${esc(i.name)}" onclick="ForjaIA.tirarItem(${n})">✕</button></div>`).join('')}</div>
    <div class="ia-tot"><div><small>Total</small><b>${nf(t.kcal)} kcal</b></div><div><small>Proteína</small><b>${nf(t.protein_g)} g</b></div><div><small>Carbo</small><b>${nf(t.carbs_g)} g</b></div><div><small>Gordura</small><b>${nf(t.fat_g)} g</b></div></div>
    ${r.note?`<p class="f3-nota">💡 ${esc(r.note)}</p>`:''}
    <div class="f3-lbl">Lançar em</div>
    <div class="chips-min ia-refs">${REFS.map(([k,l])=>{const [ic,...nm]=l.split(' ');return `<button type="button" class="${st.ref===k?'on':''}" aria-pressed="${st.ref===k}" onclick="ForjaIA.setRef('${k}')"><span>${ic}</span>${nm.join(' ')}</button>`;}).join('')}</div>
    <button type="button" class="f3-cta" onclick="ForjaIA.lancar()">✓ Lançar ${nf(t.kcal)} kcal</button>
    <button type="button" class="ia-limpar" onclick="ForjaIA.limpar()">Descartar</button>`;
}
function tirarItem(n){tap();if(!st.res)return;st.res.items.splice(n,1);if(!st.res.items.length){limpar();return;}mostrar();}
function setRef(k){tap();st.ref=k;mostrar();}
function limpar(){st.res=null;st.ref=null;tirarFoto();const ta=$('ia-texto');if(ta)ta.value='';mostrar();status('');}
async function lancar(){
  if(!st.res)return;tap();
  const items=st.res.items,t=totais(items);
  const value={description:items.map(i=>i.name+(i.qty?` (${i.qty})`:'')).join(', ').slice(0,500),kcal:t.kcal,protein_g:t.protein_g,carbs_g:t.carbs_g,fat_g:t.fat_g,items,note:'IA'};
  try{
    root.ForjaNutrition?.validate?.(value);
    await root.Forja3.lancarComida(value,st.ref||refPadrao());
    try{await root.ForjaQuickDiet?.autoSaveShortcuts?.(items);}catch{}
    const lbl=(REFS.find(([k])=>k===st.ref)||['',''])[1];
    limpar();status(`✅ Lançado no ${lbl.replace(/^\S+\s/,'')}.`);
  }catch(e){toast(e.message||'Não consegui lançar. Tente de novo.');}
}

function focar(ref){if(REFS.some(([k])=>k===ref))st.ref=ref;const ta=$('ia-texto');$('ia3')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>ta?.focus(),350);if(st.res)mostrar();}
root.ForjaIA={focar,montar,salvarChave,escolherFoto,tirarFoto,ditar,gravar,calcular,tirarItem,setRef,limpar,lancar,_st:()=>st};
})(window);
