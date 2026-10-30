/* Forja — equipamento de cada exercício (halteres, barra, máquina…) e "GIF" de graça.
   O free-exercise-db tem 2 fotos por exercício (início e fim do movimento: 0.jpg e 1.jpg);
   alternando as duas, o exercício "mexe" como um GIF, sem chave de API. */
(function(root){
'use strict';
const GRUPOS=[
  {k:'halteres',l:'Halteres',de:['Halteres']},
  {k:'barra',l:'Barra',de:['Barra','Barra W']},
  {k:'maquina',l:'Máquina',de:['Máquina']},
  {k:'polia',l:'Polia / cabo',de:['Polia']},
  {k:'corpo',l:'Peso do corpo',de:['Peso corporal']},
  {k:'kettlebell',l:'Kettlebell',de:['Kettlebell']},
  {k:'elastico',l:'Elástico',de:['Elástico']},
  {k:'outros',l:'Outros',de:['Outro','Bola medicinal','Bola suíça','Rolo de espuma','']},
];
const PARA={};GRUPOS.forEach(g=>g.de.forEach(e=>{PARA[e]=g.k;}));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
let idx=null;
function indice(){
  if(idx)return idx;idx=new Map();
  (root.ForjaFreeExerciseLibrary||[]).forEach(r=>{if(r[4])idx.set(norm(r[1]),r[4]);});
  (root.ForjaGymCatalog||[]).forEach(r=>{if(r[3]&&!idx.has(norm(r[0])))idx.set(norm(r[0]),r[3]);});
  return idx;
}
/** chave do grupo a partir do texto de equipamento da base (ex.: "Halteres" → 'halteres') */
function grupoDe(equip){return PARA[equip??'']||'outros';}
/** grupo pelo nome do exercício (inglês da base). Para exercícios próprios tenta adivinhar pelo nome. */
function grupoPorNome(nome){
  const e=indice().get(norm(nome));if(e!=null)return grupoDe(e);
  const n=norm(nome);
  if(/halter|dumbbell/.test(n))return 'halteres';
  if(/barra|barbell|supino reto|terra|smith/.test(n))return 'barra';
  if(/maquina|machine|leg press|cadeira|mesa|peck|voador|hack/.test(n))return 'maquina';
  if(/polia|cabo|cable|crossover|pulley|puxada/.test(n))return 'polia';
  if(/flexao|barra fixa|paralela|prancha|abdominal|push up|pull up|dip|burpee/.test(n))return 'corpo';
  if(/kettlebell/.test(n))return 'kettlebell';
  if(/elastico|band/.test(n))return 'elastico';
  return null;
}
function nomeGrupo(k){return (GRUPOS.find(g=>g.k===k)||{l:'Outros'}).l;}
/** chips de equipamento com contagem. contagens = {halteres:12,...} */
function chips(contagens,sel,fn){
  const total=Object.values(contagens).reduce((a,b)=>a+b,0);
  const b=(k,l,n)=>`<button type="button" class="filter-chip eq-chip${sel===k?' active':''}" aria-pressed="${sel===k}" onclick="${fn}('${k}')">${l}${n!=null?` <span>${n}</span>`:''}</button>`;
  return `<div class="eq-row" role="group" aria-label="Equipamento">${b('todos','Todos',total)}${GRUPOS.filter(g=>contagens[g.k]).map(g=>b(g.k,g.l,contagens[g.k])).join('')}</div>`;
}
/** foto animada: se a URL for do free-exercise-db (…/0.jpg), alterna com …/1.jpg */
function mov(url,cls){
  if(!url)return '';
  const m=/^(https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/main\/exercises\/[^/]+\/)0\.jpg$/.exec(url);
  if(!m)return `<img class="${cls||''}" src="${url}" alt="" draggable="false">`;
  return `<span class="mov ${cls||''}" role="img" aria-label="Movimento do exercício"><img src="${m[1]}0.jpg" alt="" draggable="false"><img class="f2" src="${m[1]}1.jpg" alt="" draggable="false" onerror="this.remove()"></span>`;
}
root.ForjaEquip={GRUPOS,grupoDe,grupoPorNome,nomeGrupo,chips,mov,ordem:k=>GRUPOS.findIndex(g=>g.k===k)};
})(window);
