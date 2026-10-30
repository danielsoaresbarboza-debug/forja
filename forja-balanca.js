/* Forja — Balança OKOK no Corpo.
   • No app Android: "Pesar pelo Bluetooth" escuta o anúncio da balança (sem parear, sem o app OKOK)
     e salva o peso (e a impedância bruta) sozinho.
   • Em qualquer lugar: "Prints do OKOK" lê as telas com a IA (gordura, músculo, água, visceral...). */
(function(root){
'use strict';
const doc=root.document,$=id=>doc.getElementById(id);
const toast=m=>root.showToast?.(m);
const kgTxt=v=>String(Math.round(v*10)/10).replace('.',',');
function plugin(){const C=root.Capacitor;return C&&C.isNativePlatform&&C.isNativePlatform()?C.Plugins?.ForjaSaude:null;}
let ouvinte=null,lendo=false;

function folha(){
  const nativo=!!plugin();
  root.Forja3.abrirFolha(`<div class="f3-t">⚖️ Balança OKOK</div>
    ${nativo?`<div class="bal-bt">
      <button type="button" class="f3-cta" id="bal-bt-btn" onclick="ForjaBalanca.pesar()">📶 Pesar pelo Bluetooth</button>
      <div class="bal-vivo" id="bal-vivo" hidden><b id="bal-kg">--,-</b><small>kg</small><p id="bal-msg">Suba na balança descalço…</p></div>
      <p class="f3-nota">Ligue o Bluetooth, toque no botão e suba na balança. O peso entra sozinho quando o número parar de piscar. Não precisa abrir o app OKOK.</p></div>`
    :`<p class="f3-nota">Pesar pelo Bluetooth funciona no <b>app Android do Forja</b>. Aqui, mande os prints do OKOK.</p>`}
    <div class="bal-sep">Gordura, músculo, água e visceral</div>
    <p class="f3-nota">Esses números a balança calcula no app OKOK. Tire print das telas de detalhes e mande aqui (pode escolher várias de uma vez).</p>
    <label for="bal-file" class="f3-cta sec bal-print">🖼️ Escolher prints do OKOK</label>
    <input type="file" id="bal-file" accept="image/*" multiple hidden onchange="ForjaGymUI.handleScaleOcrFile(event,'bal')">
    <div id="bal-status"></div><div id="bal-review"></div>`);
}

async function pesar(){
  const p=plugin();if(!p||lendo)return;lendo=true;
  const btn=$('bal-bt-btn'),vivo=$('bal-vivo'),kg=$('bal-kg'),msg=$('bal-msg');
  if(btn){btn.disabled=true;btn.textContent='Procurando a balança…';}
  if(vivo)vivo.hidden=false;
  try{
    ouvinte=await p.addListener('balanca',r=>{if(kg&&r&&r.kg)kg.textContent=kgTxt(r.kg);if(msg&&!r.final)msg.textContent='Fique parado…';});
    const r=await p.balanca({segundos:45});
    const t=root.ForjaGymTraining;
    const dados={date:t.todayKey(),time:t.nowTime(),weightKg:Math.round(r.kg*10)/10};
    if(r.impedancia>0)dados.impedancia=r.impedancia;
    await root.ForjaGymUI.saveScaleEntry(dados,{fonte:'balanca-bt'});
    if(kg)kg.textContent=kgTxt(r.kg);if(msg)msg.textContent='✅ Peso salvo no Corpo.';
    toast(`⚖️ ${kgTxt(r.kg)} kg salvo.`);
    try{await root.renderBody?.();await root.Forja3?.renderBody?.();await root.renderDashboard?.();await root.ForjaGymUI.renderScaleOcrHistory?.();}catch{}
  }catch(e){
    if(msg)msg.textContent=e&&e.message?e.message:'Não consegui ler a balança.';
    if(kg)kg.textContent='--,-';
  }finally{
    lendo=false;try{await ouvinte?.remove?.();}catch{}ouvinte=null;
    if(btn){btn.disabled=false;btn.textContent='📶 Pesar de novo';}
  }
}

function montar(){
  if(doc.body.dataset.forjaVariant==='essencial'||$('bal3'))return;
  const card=$('weight-pending-display')?.closest('.card');if(!card)return;
  const b=doc.createElement('button');b.type='button';b.id='bal3';b.className='f3-cta sec bal3';
  b.textContent=plugin()?'⚖️ Pesar pela balança (Bluetooth) ou print':'⚖️ Prints da balança OKOK';
  b.onclick=folha;card.appendChild(b);
}
// para a busca se a folha for fechada no meio
root.addEventListener('popstate',()=>{if(lendo){try{plugin()?.pararBalanca();}catch{}}});

root.ForjaBalanca={folha,pesar,montar};
const ini=()=>setTimeout(montar,1200);
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',ini);else ini();
})(window);
