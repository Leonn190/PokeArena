// Terrenos e estruturas da etapa 09. Regras puras, sem DOM, HTTP ou arquivos.
// Catálogo funcional inicial escolhido dentre as 31 opções do GDD v0.4.
export const FIELD_WIDTH=10;
export const FIELD_HEIGHT=5;
export const TERRAIN=Object.freeze({
  neutro:{name:'Neutro',color:'#e3e6dd',points:{}},
  grama:{name:'Grama',color:'#4e9745',points:{Grama:3,Inseto:2,Venenoso:1},effect:'grass'},
  rosa:{name:'Grama rosa',color:'#b97891',points:{Fada:3,Grama:2,Psíquico:1}},
  terra:{name:'Terra',color:'#9b7649',points:{Terrestre:3,Normal:2,Lutador:1}},
  lama:{name:'Lama',color:'#665a43',points:{Venenoso:3,Terrestre:2,Água:1},effect:'mud'},
  areia:{name:'Areia',color:'#c7b16d',points:{Terrestre:3,Pedra:2,Fogo:1},effect:'sand'},
  neve:{name:'Neve',color:'#d1e8eb',points:{Gelo:3,Água:1,Fada:1},effect:'snow'},
  rochoso:{name:'Rochoso',color:'#818376',points:{Pedra:3,Fogo:2,Dragão:2,Terrestre:1},effect:'rock'},
  metalico:{name:'Metálico',color:'#8ca6ac',points:{Aço:3,Elétrico:2,Psíquico:1}},
  rasa:{name:'Água rasa',color:'#59adc0',points:{Água:3,Grama:2,Inseto:1},effect:'shallow'},
  funda:{name:'Água funda',color:'#34708f',points:{Água:3,Dragão:2,Sombrio:1},effect:'deep'}
});
const makeStructure=(id,name,rarity,size,type,stat,bonus,points,regen=false)=>
  Object.freeze({id,name,rarity,size,price:{comum:2,rara:5,lendaria:8}[rarity],type,stat,bonus,points,regen});
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
export const STRUCTURE_STACKS=6;
export const newTerrain=()=>Array(FIELD_WIDTH*FIELD_HEIGHT).fill('neutro');
export const structurePoints=p=>(p.structures||[]).reduce((sum,s)=>sum+(STRUCTURE_BY_ID[s.id]?.size===2?2:1),0);
const editing=(match,player)=>match?.phase==='preparation'&&!player?.eliminated;
const validCell=(col,row)=>Number.isInteger(col)&&col>=0&&col<FIELD_WIDTH&&Number.isInteger(row)&&row>=0&&row<FIELD_HEIGHT;
export function paintTerrain(match,player,col,row,terrainId) {
  if(!editing(match,player)||!validCell(col,row)||!TERRAIN[terrainId]||terrainId==='neutro')return false;
  if(!player.terrain||player.terrain.length!==50)player.terrain=newTerrain();
  const index=row*FIELD_WIDTH+col;
  if(player.terrain[index]===terrainId)return false;
  player.terrain[index]=terrainId;
  match.revision++;
  return true;
}
export function addStructureToInventory(player,id) {
  if(!STRUCTURE_BY_ID[id])return false;
  player.structureInventory ||= [];
  const existing=player.structureInventory.find(stack=>stack.id===id);
  if(!existing&&player.structureInventory.length>=STRUCTURE_STACKS)return false;
  if(existing)existing.count++;
  else player.structureInventory.push({id,count:1});
  return true;
}
export function buyStructure(match,player,index) {
  if(!['preparation','intro','combat'].includes(match?.phase)||player.eliminated||index<0||index>=2||player.shopKinds[index]!=='estrutura')return false;
  const id=player.shop[index];
  const item=STRUCTURE_BY_ID[id];
  if(!item||player.gold<item.price||!addStructureToInventory(player,id))return false;
  player.gold-=item.price;
  player.shop[index]=null;
  player.shopKinds[index]=null;
  player.reservedOffers[index]=null;
  match.revision++;
  return true;
}
export function placeStructure(match,player,id,col,row) {
  if(!editing(match,player)||!validCell(col,row))return false;
  const type=STRUCTURE_BY_ID[id];
  const stack=player.structureInventory?.find(s=>s.id===id&&s.count>0);
  if(!type||!stack||structurePoints(player)+(type.size===2?2:1)>STRUCTURE_CAPACITY)return false;
  if(col+type.size>FIELD_WIDTH||row+type.size>FIELD_HEIGHT)return false;
  const occupied=(player.structures||[]).some(s=>{
    const size=STRUCTURE_BY_ID[s.id]?.size||1;
    return col<s.col+size&&col+type.size>s.col&&row<s.row+size&&row+type.size>s.row;
  });
  if(occupied)return false;
  player.structures.push({id,col,row});
  stack.count--;
  if(!stack.count)player.structureInventory.splice(player.structureInventory.indexOf(stack),1);
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
export function removeStructure(match,player,col,row) {
  if(!editing(match,player)||!validCell(col,row))return false;
  const index=(player.structures||[]).findIndex(s=>{
    const size=STRUCTURE_BY_ID[s.id]?.size||1;
    return col>=s.col&&col<s.col+size&&row>=s.row&&row<s.row+size;
  });
  if(index<0)return false;
  const item=player.structures[index];
  if(!addStructureToInventory(player,item.id))return false;
  player.structures.splice(index,1);
  match.revision++;
  return true;
}
export function discardStructure(match,player,id) {
  if(!editing(match,player))return false;
  const pile=player.structureInventory?.find(s=>s.id===id&&s.count>0);
  if(!pile)return false;
  pile.count--;
  if(!pile.count)player.structureInventory.splice(player.structureInventory.indexOf(pile),1);
  match.revision++;
  return true;
}
export function terrainInfluence(player) {
  const result={};
  const counts={};
  for(const tile of player.terrain||[]) if(TERRAIN[tile]&&tile!=='neutro')counts[tile]=(counts[tile]||0)+1;
  for(const [tile,n] of Object.entries(counts)) {
    // Soma dos primeiros cinco tiles integrais, 6–15 pela metade, demais por 1/4.
    const factor=Math.min(5,n)+Math.min(10,Math.max(0,n-5))*.5+Math.max(0,n-15)*.25;
    for(const [type,points] of Object.entries(TERRAIN[tile].points))result[type]=(result[type]||0)+points*factor;
  }
  return result;
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
// Misturas aprovadas só alteram a bússola, jamais geram habilidades/ataques.
const TERRAIN_RECIPES=[
  ['grama','rosa',{Fada:3,Grama:2}],['areia','rochoso',{Terrestre:3,Fogo:2}],
  ['lama','rasa',{Venenoso:3,Água:2}],['neve','rasa',{Gelo:3,Água:1}],
  ['rochoso','funda',{Dragão:3,Água:2}],['terra','metalico',{Aço:3,Terrestre:2}],
  ['grama','rasa',{Grama:3,Inseto:2}],['rosa','neve',{Fada:3,Gelo:2}]
];
function edgeDistanceTiles(first,second){
  const sizeA=STRUCTURE_BY_ID[first.id]?.size||1;
  const sizeB=STRUCTURE_BY_ID[second.id]?.size||1;
  const dx=Math.max(0,second.col-first.col-sizeA,first.col-second.col-sizeB);
  const dy=Math.max(0,second.row-first.row-sizeA,first.row-second.row-sizeB);
  return Math.hypot(dx,dy);
}
function connectedMetalArea(field,start){
  if(field[start]!=='metalico')return 0;
  const queue=[start],seen=new Set(queue);
  for(let i=0;i<queue.length;i++){
    const index=queue[i];
    for(const adjacent of [index%10?index-1:-1,index%10<9?index+1:-1,index-10,index+10]){
      if(adjacent<0||adjacent>=50||seen.has(adjacent)||field[adjacent]!=='metalico')continue;
      seen.add(adjacent);queue.push(adjacent);
    }
  }
  return queue.length;
}
const STRUCTURE_RECIPES=[
  ['flores','colmeia',{Inseto:3,Fada:1}],
  ['fonte','templo-mares',{Água:3,Fada:2}]
];
export function recipeInfluence(player) {
  const results={};
  const field=player.terrain||[];
  const add=points=>{for(const [type,n] of Object.entries(points))results[type]=(results[type]||0)+n;};
  for(const [a,b,points] of TERRAIN_RECIPES) {
    if(field.filter(x=>x===a).length<4||field.filter(x=>x===b).length<4)continue;
    const touching=field.some((tile,index)=>tile===a&&[
      index%10>0?index-1:-1,index%10<9?index+1:-1,index-10,index+10
    ].some(near=>field[near]===b));
    if(touching)add(points);
  }
  for(const [a,b,points] of STRUCTURE_RECIPES) {
    const first=(player.structures||[]).filter(s=>s.id===a);
    const second=(player.structures||[]).filter(s=>s.id===b);
    if(first.some(s=>second.some(t=>edgeDistanceTiles(s,t)<=3)))add(points);
  }
  if((player.structures||[]).some(s=>s.id==='antena' &&
    connectedMetalArea(field,s.row*10+s.col)>=6)) {
    add({Elétrico:3});
  }
  for(const type of Object.keys(results))results[type]=Math.min(10,results[type]);
  return results;
}
// Battle uses local 10x5 coordinates, independent of image or camera scaling.
export function combatTerrainAt(environment,team,x,y) {
  const side=environment?.[team];
  const col=Math.floor((x-210)/58);
  const worldRow=Math.floor((y-58)/58);
  const row=team===0?worldRow-6:5-worldRow;
  return validCell(col,row) ? (side?.terrain?.[row*10+col]||'neutro') : 'neutro';
}
export function terrainModifiers(tile,types) {
  const has=name=>types.includes(name);
  switch(tile) {
    case 'grama':return {regen:has('Grama') ? .003 : 0};
    case 'lama':return {speed:has('Terrestre')||has('Venenoso')?1:has('Água') ? .9 : .75};
    case 'areia':return {speed:has('Pedra')||has('Terrestre')||has('Aço')?1:.9};
    case 'neve':return {speed:has('Gelo') ? 1.1 : .85};
    case 'rochoso':return {def:has('Pedra') ? .08 : 0};
    case 'rasa':return {speed:has('Água')?1:.8};
    case 'funda':return {speed:has('Água')?1.1:.55};
    default:return {};
  }
}
export function structureModifiers(environment,unit) {
  const mods={};
  for(let side=0;side<2;side++)for(const s of environment?.[side]?.structures||[]) {
    const def=STRUCTURE_BY_ID[s.id];
    if(!def||!unit.type.types.includes(def.type))continue;
    const sourceCol=s.col+(def.size-1)/2;
    const sourceRow=side===0?6+s.row+(def.size-1)/2:5-s.row-(def.size-1)/2;
    const tileX=210+(sourceCol+.5)*58;
    const tileY=58+(sourceRow+.5)*58;
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
