import {STRUCTURE_PRICES} from '../../config/precos.mjs';
// Estruturas físicas; regras puras, sem DOM, HTTP ou efeitos de solo.
// Catálogo funcional inicial escolhido dentre as 31 opções do GDD v0.4.
export const FIELD_WIDTH=10;
export const FIELD_HEIGHT=5;
const makeStructure=(id,name,rarity,size,type,stat,bonus,points,regen=false)=>
  Object.freeze({id,name,rarity,size,price:STRUCTURE_PRICES[rarity],type,stat,bonus,points,regen});
export const STRUCTURES=Object.freeze([
  makeStructure('planta','Planta','comum',1,'Grama','regen',.0005,{Grama:2,Inseto:1},true),
  makeStructure('flores','Flores','comum',1,'Fada','spd',.01,{Fada:2,Inseto:1}),
  makeStructure('pedra','Pedra','comum',1,'Pedra','def',.01,{Pedra:2,Terrestre:1}),
  makeStructure('arvorezinha','Arvorezinha','comum',2,'Grama','vida',.01,{Grama:3,Voador:1}),
  makeStructure('cacto','Cacto','comum',1,'Terrestre','atk',.01,{Terrestre:2,Grama:1}),
  makeStructure('antena','Antena','rara',1,'Elétrico','spa',.03,{Elétrico:3,Aço:1}),
  makeStructure('fonte','Fonte','rara',2,'Água','regen',.0015,{Água:4,Fada:2},true),
  makeStructure('colmeia','Colmeia','rara',1,'Inseto','attackSpeed',.03,{Inseto:3,Grama:1}),
  makeStructure('cristal-gelo','Cristal de gelo','rara',1,'Gelo','spa',.03,{Gelo:3,Pedra:1}),
  makeStructure('braseiro','Braseiro','rara',1,'Fogo','atk',.03,{Fogo:3,Dragão:1}),
  makeStructure('arvore-ancestral','Árvore Ancestral','lendaria',2,'Grama','vida',.06,{Grama:7,Fada:3}),
  makeStructure('obelisco','Obelisco Elétrico','lendaria',2,'Elétrico','spa',.06,{Elétrico:7,Aço:3}),
  makeStructure('templo-mares','Templo das Marés','lendaria',2,'Água','regen',.003,{Água:7,Gelo:3},true),
  makeStructure('santuario-glacial','Santuário Glacial','lendaria',2,'Gelo','defenses',.06,{Gelo:7,Fada:3})
]);
export const STRUCTURE_BY_ID=Object.freeze(Object.fromEntries(STRUCTURES.map(s=>[s.id,s])));
export const STRUCTURE_CAPACITY=8;
export const structurePoints=p=>(p.structures||[]).reduce((sum,s)=>sum+(STRUCTURE_BY_ID[s.id]?.size===2?2:1),0);
const editing=(match,player)=>match?.phase==='preparation'&&!!player&&!player.eliminated;
const validCell=(col,row)=>Number.isInteger(col)&&col>=0&&col<FIELD_WIDTH&&Number.isInteger(row)&&row>=0&&row<FIELD_HEIGHT;
export function buyStructure(match,player,index) {
  if(!['preparation','intro','combat'].includes(match?.phase)||!player||player.eliminated||!Number.isInteger(index)||index<0||index>=2||player.shopKinds[index]!=='estrutura')return false;
  const id=player.shop[index];
  const item=STRUCTURE_BY_ID[id];
  const slot=player.bench.findIndex(u=>!u);
  if(!item||player.gold<item.price||slot<0)return false;
  const instance={kind:'structure',id,instanceId:`${match.id}-structure-${++match.nextUnitId}`,purchaseCost:item.price,col:slot,row:11};
  player.bench[slot]=instance;
  player.gold-=item.price;
  player.shop[index]=null;
  player.shopKinds[index]=null;
  player.reservedOffers[index]=null;
  match.revision++;
  return instance;
}
export function placeStructure(match,player,instance,col,row) {
  if(!editing(match,player)||!validCell(col,row))return false;
  const type=STRUCTURE_BY_ID[instance?.id];
  const slot=player.bench.indexOf(instance);
  if(!type||slot<0||structurePoints(player)+(type.size===2?2:1)>STRUCTURE_CAPACITY)return false;
  if(col+type.size>FIELD_WIDTH||row+type.size>FIELD_HEIGHT)return false;
  const occupied=(player.structures||[]).some(s=>{
    const size=STRUCTURE_BY_ID[s.id]?.size||1;
    return col<s.col+size&&col+type.size>s.col&&row<s.row+size&&row+type.size>s.row;
  });
  if(occupied)return false;
  instance.col=col;instance.row=row;
  player.structures.push(instance);
  player.bench[slot]=null;
  match.revision++;
  return true;
}
// Reposicionamento de uma estrutura já instalada: mantém a mesma instância e
// capacidade, sem passar pelo inventário e sem cobrar ouro novamente.
export function movePlacedStructure(match,player,structure,col,row) {
  if(!editing(match,player)||!structure||!validCell(col,row))return false;
  if(!player.structures?.includes(structure))return false;
  const size=STRUCTURE_BY_ID[structure.id]?.size||1;
  if(col+size>FIELD_WIDTH||row+size>FIELD_HEIGHT)return false;
  if(player.structures.some(other=>{
    if(other===structure)return false;
    const otherSize=STRUCTURE_BY_ID[other.id]?.size||1;
    return col<other.col+otherSize&&col+size>other.col&&row<other.row+otherSize&&row+size>other.row;
  }))return false;
  if(structure.col===col&&structure.row===row)return true;
  structure.col=col;
  structure.row=row;
  match.revision++;
  return true;
}
export function bankStructure(match,player,instance,slot) {
  if(!editing(match,player)||!Number.isInteger(slot)||slot<0||slot>=player.bench.length||player.bench[slot])return false;
  const index=player.structures.indexOf(instance);
  if(index<0)return false;
  player.structures.splice(index,1);player.bench[slot]=instance;instance.col=slot;instance.row=11;
  match.revision++;return true;
}
export function sellStructure(match,player,instance) {
  if(!['preparation','intro','combat'].includes(match?.phase)||!player||player.eliminated||instance?.kind!=='structure')return false;
  const bench=player.bench.indexOf(instance),field=player.structures.indexOf(instance);
  if(bench<0&&field<0)return false;
  if(bench>=0)player.bench[bench]=null;else player.structures.splice(field,1);
  player.gold+=instance.purchaseCost;match.revision++;return true;
}
export function structureInfluence(player) {
  const result={};
  const seen={};
  for(const instance of player.structures||[]) {
    const def=STRUCTURE_BY_ID[instance.id];
    if(!def)continue;
    const repeats=seen[instance.id]||0;
    seen[instance.id]=repeats+1;
    const weight=repeats?0.5:1; // Retorno decrescente (provisório) de cópias idênticas.
    for(const [type,points] of Object.entries(def.points))result[type]=(result[type]||0)+points*weight;
  }
  return result;
}
function edgeDistanceTiles(first,second){
  const sizeA=STRUCTURE_BY_ID[first.id]?.size||1;
  const sizeB=STRUCTURE_BY_ID[second.id]?.size||1;
  const dx=Math.max(0,second.col-first.col-sizeA,first.col-second.col-sizeB);
  const dy=Math.max(0,second.row-first.row-sizeA,first.row-second.row-sizeB);
  return Math.hypot(dx,dy);
}
const STRUCTURE_RECIPES=[
  ['flores','colmeia',{Inseto:3,Fada:1}],
  ['fonte','templo-mares',{Água:3,Fada:2}]
];
export function recipeInfluence(player) {
  const results={};
  const add=points=>{for(const [type,n] of Object.entries(points))results[type]=(results[type]||0)+n;};
  for(const [a,b,points] of STRUCTURE_RECIPES) {
    const first=(player.structures||[]).filter(s=>s.id===a);
    const second=(player.structures||[]).filter(s=>s.id===b);
    if(first.some(s=>second.some(t=>edgeDistanceTiles(s,t)<=3)))add(points);
  }
  for(const type of Object.keys(results))results[type]=Math.min(10,results[type]);
  return results;
}
export function structureModifiers(environment,unit) {
  const mods={};
  for(let side=0;side<(environment?.length||0);side++)for(const s of environment[side].structures||[]) {
    const def=STRUCTURE_BY_ID[s.id];
    if(!def||!unit.type.types.includes(def.type))continue;
    const sourceCol=s.col+(def.size-1)/2;
    const sourceRow=side===0?6+s.row+(def.size-1)/2:5-s.row-(def.size-1)/2;
    const tileX=s.combatX??210+(sourceCol+.5)*58;
    const tileY=s.combatY??58+(sourceRow+.5)*58;
    const nearest=Math.hypot(unit.x-tileX,unit.y-tileY)/58;
    const bonus=def.bonus*(nearest<=def.size?1.5:1);
    const names=def.stat==='defenses'?['def','spd']:[def.stat];
    for(const stat of names)mods[stat]=(mods[stat]||0)+bonus;
  }
  for(const [key,val] of Object.entries(mods))mods[key]=Math.min(key==='regen' ? .012 : .12,val);
  return mods;
}
export function fieldEffects(player) {
  const effects={};
  for(const s of player.structures||[]) {
    const d=STRUCTURE_BY_ID[s.id];
    if(!d)continue;
    const key=`${d.type}:${d.stat}`;
    const e=effects[key]||{type:d.type,stat:d.stat,bonus:0,sources:[]};
    e.bonus+=d.bonus;e.sources.push(d.name);effects[key]=e;
  }
  return Object.values(effects).map(e=>({...e,bonus:Math.min(e.stat==='regen' ? .012 : .12,e.bonus)}));
}
