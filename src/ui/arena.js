// UI exclusiva da partida local. Toda regra competitiva é aplicada em server/game/.
import { createLocalMatchState, purchaseLocalOffer, refreshLocalShop, sellLocalUnit, toggleLocalShopLock, changeLocalMove, saleValueLocal } from '../../server/game/roster.mjs';
import { createCamera } from './camera.mjs';
import { createSpriteCache } from './sprites.mjs';
import { createSpriteRenderer } from './renderer.mjs';
import { BY_ID } from '../../server/game/pokemon.mjs';
import { MOVES_BY_ID } from '../../server/game/moves.mjs';
import { fieldLimitForBattle, shopOddsForBattle, RULES } from '../../server/game/rules.mjs';
import { aliveCount, combatForPlayer, phaseRemainingSeconds, startLocalMatchCycle, updateLocalMatchCycle } from '../../server/game/match-cycle.mjs';
import { BOARD, TAU, cellAtWorld, tilePosition, validCellForTeam, effectiveUnitStats } from '../../server/game/battle.mjs';
import {calculateCompass,ALL_TYPES} from '../../server/game/compass.mjs';
import {TERRAIN,STRUCTURE_BY_ID,STRUCTURE_CAPACITY,terrainInfluence,structureInfluence,recipeInfluence,paintTerrain,buyStructure,placeStructure,movePlacedStructure,removeStructure,discardStructure,structurePoints,fieldEffects} from '../../server/game/terrain.mjs';

const $ = id => document.getElementById(id);
const canvas = $('arena');
const ctx = canvas.getContext('2d',{alpha:false});
const base = (canvas.dataset.base || '/').replace(/\/?$/, '/');
const keys = ['vida','atk','def','spa','spd','vel'];
const stageName = {1:'Base',2:'Evoluído',3:'Final'};
const RARITY_COLORS = {comum:'#9ca3af',incomum:'#4ad779',raro:'#5aa5ff',epico:'#b87afa',mitico:'#ff575d',lendario:'#ffda52'};
const RARITY_LABELS = {comum:'Comum',incomum:'Incomum',raro:'Raro',epico:'Épico',mitico:'Mítico',lendario:'Lendário'};
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

let localMatch=null;
let observedId=null;
let selectedId=null;
let lastFrame=0;
let visualTime=0;
let hudTick=-1;
let announced=false;
let hovered=null;
let drag=null;
let shopPointer=null;
let suppressShopClick=false;
let pan=null;
let spaceDown=false;
let toastTimer=0;
let shopSignature='';
let terrainSignature='';
let activeTab='pokemon';
let terrainTool='grama';
let selectedStructure=null;
let terrainPainting=null;
let structurePointer=null;
let compassSignature='';
let dpr=1;
let screen={w:1000,h:760};
const evolutionEffects=[];
let returnAnimation=null;
let lastReturnedBattle=null;
const TYPE_ASSETS={Normal:'normal',Lutador:'fighting',Voador:'flying',Venenoso:'poison',Terrestre:'ground',Pedra:'rock',Inseto:'bug',Fantasma:'ghost',Aço:'steel',Fogo:'fire',Água:'water',Grama:'grass',Elétrico:'electric',Psíquico:'psychic',Gelo:'ice',Dragão:'dragon',Sombrio:'dark',Fada:'fairy'};
const typeIcon=type=>`<img class="type-icon" src="${base}assets/tipos/${TYPE_ASSETS[type]}.svg" alt="${type}" title="${type}" />`;

function humanParticipant() { return localMatch?.players.find(p=>p.id===localMatch.ownerId)||null; }
function observedParticipant() { return localMatch?.players.find(p=>p.id===observedId)||humanParticipant(); }
function canEdit() { return !!localMatch && localMatch.phase==='preparation' &&
  observedId===localMatch.ownerId && !humanParticipant()?.eliminated; }
function observedCombat() { return combatForPlayer(localMatch,observedId); }
function displayedBattle() { return ['intro','combat'].includes(localMatch?.phase) ? observedCombat()?.battle||null : null; }
function currentShop() { return humanParticipant()?.shop||[]; }
function allUnits() {
  const p=observedParticipant();
  return p?[...p.board,...p.bench.filter(Boolean)]:[];
}
function selectedMon() { return allUnits().find(mon=>mon.instanceId===selectedId)||null; }
function benchIndex(mon) {
  const index=observedParticipant()?.bench.indexOf(mon)??-1;
  return index>=0?index:null;
}
function monWorld(mon) {
  if(drag?.kind==='unit'&&drag.mon===mon&&drag.world)return drag.world;
  const slot=benchIndex(mon);
  return tilePosition(slot===null?mon.col:slot,slot===null?mon.row:BOARD.playerBenchRow);
}
function showToast(message) {
  const toast=$('toast');
  toast.textContent=message;
  toast.hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{toast.hidden=true;},1900);
}
function startMatch() {
  const count=Number($('player-count').value);
  const sessionId=`local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  localMatch=startLocalMatchCycle(createLocalMatchState(count,sessionId),performance.now()/1000);
  observedId=localMatch.ownerId;
  selectedId=null;
  hovered=null;
  drag=null;
  shopPointer=null;
  structurePointer=null;
  compassSignature='';
  announced=false;
  evolutionEffects.length=0;
  returnAnimation=null;
  lastReturnedBattle=null;
  $('entry-screen').hidden=true;
  $('outcome').hidden=true;
  document.querySelector('.game-shell').dataset.mode='local';
  shopSignature='';
  terrainSignature='';
  activeTab='pokemon';
  terrainTool='grama';
  selectedStructure=null;
  sizeCanvas();
  renderHud();
}
function openMenu() {
  localMatch=null;
  observedId=null;
  selectedId=null;
  hovered=null;
  drag=null;
  shopPointer=null;
  structurePointer=null;
  pan=null;
  $('entry-screen').hidden=false;
  $('outcome').hidden=true;
  $('toast').hidden=true;
  document.querySelector('.game-shell').dataset.mode='menu';
  setShopSellMode(false);
  terrainPainting=null;
  activeTab='pokemon';
  shopSignature='';
  terrainSignature='';
  renderHud();
}
function observePlayer(id) {
  if(!localMatch?.players.some(p=>p.id===id))return;
  observedId=id;
  selectedId=null;
  drag=null;
  hovered=null;
  shopPointer=null;
  structurePointer=null;
  compassSignature='';
  fitCamera();
  renderHud();
}
function recordEvolution(before,previousId,unit) {
  if(!unit||unit.speciesId===previousId)return;
  const originals=before.filter(entry=>entry.speciesId===previousId);
  const pos=monWorld(unit);
  evolutionEffects.push({
    from:originals.map(entry=>({x:entry.x,y:entry.y,speciesId:entry.speciesId,team:0})),
    to:{x:pos.x,y:pos.y},newSpeciesId:unit.speciesId,time:0,total:.95
  });
  warmPokemon(BY_ID[unit.speciesId]);
  showToast(`${BY_ID[previousId].name} evoluiu para ${BY_ID[unit.speciesId].name}!`);
}
function purchase(index,dropCell=null) {
  if(!canEdit())return false;
  const player=humanParticipant();
  const id=player.shop[index];
  if(!id)return false;
  if(player.shopKinds[index]==='estrutura') {
    const def=STRUCTURE_BY_ID[id];
    if(dropCell){
      if(!validCellForTeam(0,dropCell))return false;
      const col=dropCell.col,row=dropCell.row-BOARD.playerFieldStart;
      if(col+def.size>10||row+def.size>5||
        player.structures.some(s=>{
          const size=STRUCTURE_BY_ID[s.id]?.size||1;
          return col<s.col+size&&col+def.size>s.col&&row<s.row+size&&row+def.size>s.row;
        })||structurePoints(player)+(def.size===2?2:1)>STRUCTURE_CAPACITY)return false;
    }
    if(!buyStructure(localMatch,player,index)) {showToast('Sem ouro ou inventário de estruturas cheio.');return false;}
    if(dropCell)placeStructure(localMatch,player,id,dropCell.col,dropCell.row-BOARD.playerFieldStart);
    shopSignature='';terrainSignature='';renderHud();
    if(!dropCell)showToast('Estrutura no inventário.');
    return true;
  }
  if(!BY_ID[id])return false;
  if(dropCell) {
    const valid=dropCell.row===BOARD.playerBenchRow||validCellForTeam(0,dropCell);
    if(!valid)return false;
    if(dropCell.row===BOARD.playerBenchRow&&player.bench[dropCell.col])return false;
    if(dropCell.row!==BOARD.playerBenchRow&&player.board.some(u=>u.col===dropCell.col&&u.row===dropCell.row))return false;
    if(dropCell.row!==BOARD.playerBenchRow&&player.board.length>=fieldLimitForBattle(localMatch.round))return false;
  }
  const before=allUnits().map(u=>({instanceId:u.instanceId,speciesId:u.speciesId,...monWorld(u)}));
  const priorIds=new Set(before.map(u=>u.instanceId));
  const bought=purchaseLocalOffer(localMatch,player,index);
  if(!bought) {
    showToast('Compra indisponível: confira ouro, banco e estoque.');
    return false;
  }
  if(dropCell&&!priorIds.has(bought.instanceId))moveUnit(bought,dropCell,false);
  selectedId=bought.instanceId;
  recordEvolution(before,id,bought);
  warmPokemon(BY_ID[bought.speciesId]);
  if(id==='0718')showToast(`Zygarde ${bought.zygardeProgress}%`);
  renderHud();
  return true;
}
function sell(mon) {
  if(!canEdit()||!mon)return;
  if(sellLocalUnit(localMatch,humanParticipant(),mon)) {
    if(selectedId===mon.instanceId)selectedId=null;
    renderHud();
    showToast(`${BY_ID[mon.speciesId].name} vendido por ${saleValueLocal(mon)} ouro.`);
  }
}
function moveUnit(mon,target,swap=true) {
  if(!canEdit()||!mon||!target)return false;
  const player=humanParticipant();
  const benchTarget=target.row===BOARD.playerBenchRow;
  if(!benchTarget&&!validCellForTeam(0,target))return false;
  const fromBench=player.bench.indexOf(mon);
  const fromBoard=player.board.indexOf(mon);
  if(fromBench<0&&fromBoard<0)return false;
  const other=benchTarget?player.bench[target.col]:player.board.find(u=>u.col===target.col&&u.row===target.row);
  if(other===mon)return true;
  if(other&&!swap)return false;
  if(!benchTarget&&fromBench>=0&&!other&&player.board.length>=fieldLimitForBattle(localMatch.round)) {
    showToast('Limite de Pokémon no campo atingido.');
    return false;
  }
  if(fromBench>=0)player.bench[fromBench]=null;
  else player.board.splice(fromBoard,1);
  if(other) {
    const otherBench=player.bench.indexOf(other);
    if(otherBench>=0)player.bench[otherBench]=null;
    else player.board.splice(player.board.indexOf(other),1);
    if(fromBench>=0)player.bench[fromBench]=other;
    else {other.col=mon.col;other.row=mon.row;player.board.push(other);}
  }
  if(benchTarget) {
    player.bench[target.col]=mon;
    mon.row=BOARD.playerBenchRow;
    mon.col=target.col;
  } else {
    mon.col=target.col;
    mon.row=target.row;
    player.board.push(mon);
  }
  localMatch.revision++;
  player.compass=calculateCompass(player);
  renderHud();
  return true;
}
const {camera,screenPoint,screenToWorld,clientToWorld,fitCamera,zoomAt,updateCamera}=createCamera(
  canvas,BOARD,()=>screen,()=>({
    top:Math.max(82,$('phase-label').closest('.top-hud').getBoundingClientRect().height+22),
    bottom:Math.max(155,$('shop-slots').closest('.bottom-hud').getBoundingClientRect().height+24)
  }),()=>!!pan
);
function cellAtClient(x,y) {const p=clientToWorld(x,y);return cellAtWorld(p.x,p.y);}
function hitUnit(world) {
  let best=null;
  let nearest=38;
  for(const mon of allUnits()) {
    const p=monWorld(mon);
    const d=Math.hypot(world.x-p.x,world.y-p.y+15);
    if(d<nearest) {best=mon;nearest=d;}
  }
  return best;
}
function hitPlacedStructure(cell) {
  if(!canEdit()||!validCellForTeam(0,cell))return null;
  const row=cell.row-BOARD.playerFieldStart;
  return (humanParticipant().structures||[]).slice().reverse().find(entry=>{
    const size=STRUCTURE_BY_ID[entry.id]?.size||1;
    return cell.col>=entry.col&&cell.col<entry.col+size&&row>=entry.row&&row<entry.row+size;
  })||null;
}
function setShopSellMode(selling) {
  const hud=$('shop-slots').closest('.bottom-hud');
  hud.classList.toggle('selling',!!selling);
  if(!selling)hud.querySelectorAll('.sell-hover').forEach(c=>c.classList.remove('sell-hover'));
}
function updateSellHover(x,y) {
  const slots=$('shop-slots');
  const target=document.elementFromPoint(x,y)?.closest?.('.shop-card');
  slots.querySelectorAll('.sell-hover').forEach(card=>card.classList.remove('sell-hover'));
  if(target&&slots.contains(target))target.classList.add('sell-hover');
}
function applyTerrainBrush(cell,large=false) {
  if(!canEdit()||!cell||!validCellForTeam(0,cell))return false;
  const player=humanParticipant(),col=cell.col,row=cell.row-BOARD.playerFieldStart;
  if(terrainTool==='remove')return removeStructure(localMatch,player,col,row);
  if(terrainTool==='structure')return selectedStructure ? placeStructure(localMatch,player,selectedStructure,col,row) : false;
  let changed=false;
  const spread=large?1:0;
  for(let dr=-spread;dr<=spread;dr++)for(let dc=-spread;dc<=spread;dc++)
    changed=paintTerrain(localMatch,player,col+dc,row+dr,terrainTool)||changed;
  return changed;
}
function terrainActionAt(e) {
  const cell=cellAtClient(e.clientX,e.clientY);
  const changed=applyTerrainBrush(cell,e.shiftKey);
  if(changed) {terrainSignature='';renderHud();}
  return changed;
}
canvas.addEventListener('pointerdown',e=>{
  if(!localMatch)return;
  const p=screenPoint(e.clientX,e.clientY);
  if(e.button===1||e.button===2||(spaceDown&&e.button===0)) {
    pan={pointer:e.pointerId,start:p,x:camera.x,y:camera.y};
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if(e.button!==0||!canEdit())return;
  const worldCell=cellAtClient(e.clientX,e.clientY);
  const clickedMon=activeTab==='pokemon'?hitUnit(screenToWorld(p)):null;
  const placed=clickedMon?null:hitPlacedStructure(worldCell);
  if(placed&&terrainTool!=='remove') {
    const item=STRUCTURE_BY_ID[placed.id],world=screenToWorld(p);
    const center={x:BOARD.x+(placed.col+item.size/2)*BOARD.tile,
      y:BOARD.y+(BOARD.playerFieldStart+placed.row+item.size/2)*BOARD.tile};
    drag={kind:'placed-structure',pointer:e.pointerId,structure:placed,id:placed.id,
      grab:{col:worldCell.col-placed.col,row:worldCell.row-BOARD.playerFieldStart-placed.row},
      offset:{x:world.x-center.x,y:world.y-center.y},world:center};
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if(activeTab==='terrain'){
    terrainActionAt(e);
    if(terrainTool!=='structure'&&terrainTool!=='remove'){
      terrainPainting=e.pointerId;canvas.setPointerCapture(e.pointerId);
    }
    return;
  }
  const world=screenToWorld(p);
  const mon=hitUnit(world);
  selectedId=mon?.instanceId||null;
  renderDetails();
  if(mon) {
    const at=monWorld(mon);
    drag={kind:'unit',pointer:e.pointerId,mon,world:at,offset:{x:world.x-at.x,y:world.y-at.y}};
    canvas.setPointerCapture(e.pointerId);
    setShopSellMode(true);
  }
});
canvas.addEventListener('pointermove',e=>{
  if(terrainPainting===e.pointerId&&activeTab==='terrain'){terrainActionAt(e);return;}
  const pt=screenPoint(e.clientX,e.clientY);
  const world=screenToWorld(pt);
  hovered=canEdit()?cellAtWorld(world.x,world.y):null;
  if(pan?.pointer===e.pointerId) {
    camera.x=pan.x+pt.x-pan.start.x;
    camera.y=pan.y+pt.y-pan.start.y;
    camera.targetX=camera.x;
    camera.targetY=camera.y;
    return;
  }
  if(drag?.kind==='placed-structure'&&drag.pointer===e.pointerId){
    drag.world={x:world.x-drag.offset.x,y:world.y-drag.offset.y};
    return;
  }
  if(drag?.kind==='unit'&&drag.pointer===e.pointerId) {
    drag.world={x:world.x-drag.offset.x,y:world.y-drag.offset.y};
    updateSellHover(e.clientX,e.clientY);
  }
});
canvas.addEventListener('pointerup',e=>{
  if(terrainPainting===e.pointerId){terrainPainting=null;return;}
  if(pan?.pointer===e.pointerId) {pan=null;return;}
  if(drag?.kind==='placed-structure'&&drag.pointer===e.pointerId){
    const active=drag;drag=null;
    const target=document.elementFromPoint(e.clientX,e.clientY);
    if(target?.closest?.('#terrain-pane')){
      if(!removeStructure(localMatch,humanParticipant(),active.structure.col,active.structure.row))showToast('Inventário de estruturas cheio.');
    }else{
      const cell=cellAtClient(e.clientX,e.clientY);
      const col=cell?.col-active.grab.col,row=cell?.row-BOARD.playerFieldStart-active.grab.row;
      if(!movePlacedStructure(localMatch,humanParticipant(),active.structure,col,row))showToast('Posição indisponível.');
    }
    terrainSignature='';renderHud();return;
  }
  if(drag?.kind!=='unit'||drag.pointer!==e.pointerId)return;
  const active=drag;
  drag=null;
  const overShop=!!document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.shop-card');
  setShopSellMode(false);
  if(overShop)sell(active.mon);
  else moveUnit(active.mon,cellAtClient(e.clientX,e.clientY));
});
canvas.addEventListener('pointercancel',()=>{drag=null;pan=null;terrainPainting=null;setShopSellMode(false);});
document.addEventListener('pointermove',e=>{
  if(!shopPointer||shopPointer.pointer!==e.pointerId)return;
  if(!shopPointer.dragging&&Math.hypot(e.clientX-shopPointer.start.x,e.clientY-shopPointer.start.y)>5){
    shopPointer.dragging=true;
    suppressShopClick=true;
    drag={kind:'shop',index:shopPointer.index,speciesId:shopPointer.speciesId,world:clientToWorld(e.clientX,e.clientY)};
  }
  if(shopPointer.dragging) {
    drag.world=clientToWorld(e.clientX,e.clientY);
    hovered=canEdit()?cellAtClient(e.clientX,e.clientY):null;
  }
});
document.addEventListener('pointerup',e=>{
  if(!shopPointer||shopPointer.pointer!==e.pointerId)return;
  const prior=shopPointer;
  shopPointer=null;
  if(!prior.dragging)return;
  drag=null;
  if(!document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.bottom-hud')) {
    if(!purchase(prior.index,cellAtClient(e.clientX,e.clientY)))showToast('Solte em um campo ou banco livre.');
  }
  setTimeout(()=>{suppressShopClick=false;},0);
});
document.addEventListener('pointercancel',()=>{
  shopPointer=null;structurePointer=null;
  if(drag?.kind==='shop'||drag?.kind==='inventory-structure')drag=null;
  suppressShopClick=false;
});
// Mesmo ciclo de arraste dos Pokémon: clique seleciona, arraste instala estrutura.
document.addEventListener('pointermove',e=>{
  if(!structurePointer||structurePointer.pointer!==e.pointerId)return;
  if(!structurePointer.dragging&&Math.hypot(e.clientX-structurePointer.start.x,e.clientY-structurePointer.start.y)>5){
    structurePointer.dragging=true;suppressShopClick=true;
    drag={kind:'inventory-structure',id:structurePointer.id,world:clientToWorld(e.clientX,e.clientY)};
  }
  if(structurePointer.dragging&&drag?.kind==='inventory-structure'){
    drag.world=clientToWorld(e.clientX,e.clientY);
    hovered=cellAtClient(e.clientX,e.clientY);
  }
});
document.addEventListener('pointerup',e=>{
  if(!structurePointer||structurePointer.pointer!==e.pointerId)return;
  const prior=structurePointer;structurePointer=null;
  if(!prior.dragging)return;
  drag=null;
  const cell=cellAtClient(e.clientX,e.clientY);
  if(!cell||!validCellForTeam(0,cell)||!placeStructure(localMatch,humanParticipant(),prior.id,cell.col,cell.row-BOARD.playerFieldStart)){
    showToast('Solte a estrutura em uma área livre do campo.');
  }
  terrainSignature='';renderHud();
  setTimeout(()=>{suppressShopClick=false;},0);
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(screenPoint(e.clientX,e.clientY),e.deltaY<0?1.12:.89);},{passive:false});
window.addEventListener('keydown',e=>{
  if(e.code==='Space')spaceDown=true;
  if(canEdit()&&(e.key==='Delete'||e.key==='Backspace'))sell(selectedMon());
});
window.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false;});

function renderHud() {
  const player=humanParticipant();
  const observed=observedParticipant();
  const editing=canEdit();
  $('match-panel').hidden=!localMatch;
  $('environment-panel').hidden=!localMatch;
  const terrainMode=activeTab==='terrain';
  const footer=$('shop-slots').closest('.bottom-hud');
  footer.classList.toggle('terrain-active',terrainMode);
  $('terrain-pane').hidden=!terrainMode;
  $('shop-slots').hidden=terrainMode;
  $('shop-rarity-odds').hidden=!localMatch||terrainMode;
  $('compass-widget').hidden=!localMatch;
  $('tab-pokemon').classList.toggle('selected',!terrainMode);
  $('tab-pokemon').setAttribute('aria-selected',String(!terrainMode));
  $('tab-terrain').classList.toggle('selected',terrainMode);
  $('tab-terrain').setAttribute('aria-selected',String(terrainMode));
  $('reroll-shop').hidden=terrainMode;
  $('lock-shop').hidden=terrainMode||!localMatch;
  $('discard-structure').hidden=!terrainMode;
  $('remove-placed').hidden=!terrainMode;
  $('remove-placed').disabled=!editing;
  $('remove-placed').classList.toggle('selected',terrainTool==='remove');
  $('discard-structure').disabled=!editing||!selectedStructure||!(player?.structureInventory||[]).some(s=>s.id===selectedStructure);
  $('hp-stat').hidden=!localMatch;
  $('alive-stat').hidden=!localMatch;
  $('timer-stat').hidden=!localMatch;
  $('round-label').textContent=localMatch?.round??1;
  $('limit-label').textContent=`${observed?.board.length||0}/${fieldLimitForBattle(localMatch?.round||1)}`;
  $('gold-label').textContent=player?.gold??9;
  $('shop-gold-value').textContent=player?.gold??9;
  $('hp-label').textContent=observed?.hp??100;
  $('alive-label').textContent=localMatch?`${aliveCount(localMatch)}/${localMatch.players.length}`:'—';
  $('timer-label').textContent=localMatch?`${phaseRemainingSeconds(localMatch,performance.now()/1000)}s`:'30s';
  $('phase-label').textContent=localMatch?.phase==='intro'?'Entrada · Local':localMatch?.phase==='combat'?'Combate · Local':localMatch?.phase==='finished'?'Fim de partida':'Preparação · Local';
  $('reroll-shop').disabled=!editing||player.shopLocked||player.gold<RULES.rerollCostGold;
  $('lock-shop').disabled=!editing;
  $('lock-shop').setAttribute('aria-label',player?.shopLocked?'Destravar loja':'Travar loja');
  $('lock-shop').title=player?.shopLocked?'Destravar loja':'Travar loja';
  $('lock-shop').querySelector('path').setAttribute('d',player?.shopLocked?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 7-2');
  $('lock-shop').setAttribute('aria-pressed',String(!!player?.shopLocked));
  renderEnvironment();
  renderTerrainTools();
  $('match-players').replaceChildren();
  if(localMatch) {
    $('match-id-label').textContent=`${aliveCount(localMatch)}/${localMatch.players.length} vivos`;
    const combat=observedCombat();
    $('match-panel-note').textContent=localMatch.phase==='intro'?'Entrada dos adversários · 3 segundos.':localMatch.phase==='combat'?
      combat?.status==='bye'?'Folga temporária nesta rodada.':
      combat?.status==='running'?'Combate local em andamento.':'Confronto encerrado.':
      localMatch.phase==='finished'?'Partida local encerrada.':'Monte sua equipe durante a preparação.';
    $('back-own-arena').hidden=observedId===localMatch.ownerId;
    $('observed-label').textContent=observed?.isBot?`Visitando ${observed.name}`:'Sua arena';
    for(const participant of localMatch.players) {
      const button=document.createElement('button');
      button.type='button';
      button.className=`match-player${participant.isBot?'':' human'}${participant.id===observedId?' observed':''}${participant.eliminated?' eliminated':''}`;
      button.setAttribute('aria-pressed',String(participant.id===observedId));
      const name=document.createElement('b');
      name.textContent=participant.isBot?participant.name:'Você';
      const meta=document.createElement('span');
      meta.className='match-player-meta';
      const hp=document.createElement('small');
      hp.textContent=`${participant.hp} HP`;
      const bar=document.createElement('span');
      bar.className='match-hp-bar';
      const fill=document.createElement('i');
      fill.style.width=`${clamp(participant.hp,0,100)}%`;
      bar.append(fill);
      meta.append(hp,bar);
      button.append(name,meta);
      button.addEventListener('click',()=>observePlayer(participant.id));
      $('match-players').append(button);
    }
  }
  renderDetails();
  renderShop();
}
let compassPieSlices=[];
let compassTypeSources=null;
let compassFirstType=null;
const TYPE_COLORS={Normal:'#a7a794',Lutador:'#d17e57',Voador:'#aabde4',Venenoso:'#b783bf',Terrestre:'#c59c62',Pedra:'#a69c87',Inseto:'#a9c46a',Fantasma:'#8575be',Aço:'#a5bac2',Fogo:'#f28a54',Água:'#60b5e3',Grama:'#80ca73',Elétrico:'#f2d868',Psíquico:'#e894be',Gelo:'#a4e3ee',Dragão:'#7881d6',Sombrio:'#7c8195',Fada:'#f1a5cf'};
function renderCompass(player,compass) {
  const signature=`${player.id}:${ALL_TYPES.map(type=>compass[type].toFixed(3)).join(':')}`;
  if(signature===compassSignature)return;
  compassSignature=signature;
  const ranked=ALL_TYPES.map(type=>({type,score:compass[type]||0})).sort((a,b)=>b.score-a.score);
  const leaders=ranked.filter(entry=>entry.score>0).slice(0,5);
  const total=leaders.reduce((sum,entry)=>sum+entry.score,0);
  let angle=0;
  compassPieSlices=[];
  const segments=leaders.map((entry,i)=>{
    const from=angle;
    angle=i===leaders.length-1?360:angle+entry.score/total*360;
    compassPieSlices.push({type:entry.type,from,to:angle});
    return `${TYPE_COLORS[entry.type]} ${from.toFixed(2)}deg ${angle.toFixed(2)}deg`;
  });
  $('compass-ring').style.background=segments.length?`conic-gradient(${segments.join(',')})`:'conic-gradient(#667b72 0deg 360deg)';
  $('compass-lead').innerHTML=leaders[0]?typeIcon(leaders[0].type):'Neutra';
  $('compass-widget').setAttribute('aria-label',leaders.length?`Bússola: ${leaders.map(x=>`${x.type} ${x.score.toFixed(1)} pontos`).join(', ')}`:'Bússola neutra, nenhuma influência');
  $('compass-breakdown').innerHTML=ranked.map(({type,score})=>
    `<div class="compass-entry" data-type="${type}" style="--type-color:${TYPE_COLORS[type]}">${typeIcon(type)}<b>${+score.toFixed(1)}</b></div>`).join('');
  const direct=(units,points)=>{
    const out={};
    for(const mon of units||[]) {
      const types=BY_ID[mon?.speciesId]?.types||[];
      for(const type of types)out[type]=(out[type]||0)+points/types.length;
    }
    return out;
  };
  compassTypeSources=[
    ['Pokémon no campo',direct(player.board,5)],
    ['Pokémon no banco',direct(player.bench.filter(Boolean),2)],
    ['Terrenos',terrainInfluence(player)],
    ['Estruturas',structureInfluence(player)],
    ['Combinações',recipeInfluence(player)]
  ];
  compassFirstType=leaders[0]?.type||null;
  showCompassType(compassFirstType);
}
function showCompassType(type){
  const selected=type||compassFirstType;
  $('compass-lead').innerHTML=selected?typeIcon(selected):'Neutra';
  $('compass-breakdown').querySelectorAll('.compass-entry').forEach(row=>{
    row.classList.toggle('highlighted',row.dataset.type===selected);
  });
  $('compass-sources').innerHTML=(compassTypeSources||[]).map(([label,scores])=>
    `<div><span>${label}</span><b>${+((scores[selected]||0).toFixed(1))} pts</b></div>`).join('');
}
function renderEnvironment() {
  const player=observedParticipant();
  if(!player||!localMatch)return;
  const compass=calculateCompass(player);
  player.compass=compass; // Snapshot local recalculado ao consultar; nunca altera chances de raridade.
  renderCompass(player,compass);
  $('capacity-label').textContent=`${structurePoints(player)}/${STRUCTURE_CAPACITY}`;
  const effects=fieldEffects(player);
  $('environment-effects').innerHTML=effects.length ? effects.map(e=>`<div>${typeIcon(e.type)} · ${e.stat==='regen'?`${(e.bonus*100).toFixed(2)}% HP/s`:`+${(e.bonus*100).toFixed(1)}% ${e.stat}`}<small>${e.sources.join(', ')} · 1,5× perto</small></div>`).join('') : '<div>Nenhuma estrutura posicionada</div>';
}
function renderTerrainTools() {
  if(!localMatch||activeTab!=='terrain')return;
  const player=humanParticipant();
  const signature=`${canEdit()}:${terrainTool}:${selectedStructure}:${player?.structureInventory?.map(s=>`${s.id}-${s.count}`).join(',')}:${structurePoints(player)}`;
  if(signature===terrainSignature)return;
  terrainSignature=signature;
  $('terrain-tools').innerHTML=Object.entries(TERRAIN).filter(([id])=>id!=='neutro').map(([id,t])=>
    `<button class="terrain-tool${terrainTool===id?' selected':''}" type="button" data-id="${id}" title="Pintar terreno: ${t.name}" ${canEdit()?'':'disabled'}><canvas width="116" height="58" aria-hidden="true"></canvas><small>${t.name}</small></button>`).join('');
  $('terrain-tools').querySelectorAll('button').forEach(button=>{
    const preview=button.querySelector('canvas');
    paintTilePreview(preview,button.dataset.id);
    button.addEventListener('click',()=>{terrainTool=button.dataset.id;selectedStructure=null;terrainSignature='';renderHud();});
  });
  const inventory=player?.structureInventory||[];
  $('structure-inventory').innerHTML=Array.from({length:6},(_,i)=>{
    const stack=inventory[i],item=STRUCTURE_BY_ID[stack?.id];
    return `<button type="button" class="structure-slot${item?'':' empty'}${selectedStructure===stack?.id&&terrainTool==='structure'?' selected':''}" data-index="${i}" ${!item||!canEdit()?'disabled':''} title="${item?.name||'Espaço para estrutura'}"><canvas width="116" height="58" aria-hidden="true"></canvas><small>${item?.name||' '}</small>${stack?`<span class="stack-count">×${stack.count}</span>`:''}</button>`;
  }).join('');
  $('structure-inventory').querySelectorAll('button').forEach(button=>{
    const index=Number(button.dataset.index),item=STRUCTURE_BY_ID[inventory[index]?.id];
    if(item)drawStructurePreview(button.querySelector('canvas'),item);
    button.addEventListener('click',()=>{
      if(suppressShopClick)return;
      selectedStructure=inventory[index]?.id||null;
      terrainTool='structure';terrainSignature='';renderHud();
    });
    button.addEventListener('pointerdown',e=>{
      if(e.button!==0||!canEdit()||!item)return;
      structurePointer={pointer:e.pointerId,id:item.id,start:{x:e.clientX,y:e.clientY},dragging:false};
    });
  });
}
function renderDetails() {
  const mon=selectedMon();
  $('detail-panel').classList.toggle('collapsed',!mon);
  if(!mon)return;
  const p=BY_ID[mon.speciesId];
  if(!p)return;
  const stats=effectiveUnitStats(p,mon);
  const slot=benchIndex(mon);
  $('selected-number').textContent=`#${String(p.number).padStart(3,'0')}`;
  $('selected-name').textContent=p.name;
  $('selected-type').innerHTML=`${p.types.map(typeIcon).join('')} · ${RARITY_LABELS[p.rarity]} · ${mon.evolutionSteps?`Evolução ${mon.evolutionSteps}`:stageName[p.stage]}`;
  $('selected-type').style.color=p.color;
  $('selected-place').textContent=slot!==null?`Banco ${slot+1}`:`Campo ${mon.col+1},${mon.row+1}`;
  $('selected-iv').textContent=`IV geral ${mon.iv}%${mon.zygardeProgress?` · Zygarde ${mon.zygardeProgress}%`:''}${mon.babyPerfect?' · Baby perfeito':''}`;
  $('sell-value').textContent=`Venda: ${saleValueLocal(mon)} ouro`;
  drawPortrait($('selected-avatar'),p);
  $('stats-list').innerHTML=keys.map(k=>`<div class="stat"><span>${k.toUpperCase()}</span><div><b>${stats[k]}</b><small>base ${p.stats[k]} · IV ${mon.iv}%</small></div></div>`).join('');
  $('moves-active').innerHTML=mon.activeMoves.slice(0,2).map((id,i)=>{
    const move=MOVES_BY_ID[id];
    return `<div class="move-row"><button type="button" class="move-card" tabindex="-1"><b>${move.name}</b><small>${move.category==='atk'?'Físico':'Especial'} · ${move.damage} · ${move.range.toFixed(1)}</small></button><button type="button" class="move-reroll" data-slot="${i}" title="Trocar golpe por 2 de ouro" aria-label="Trocar golpe por 2 de ouro">↻ 2</button></div>`;
  }).join('');
  $('moves-active').querySelectorAll('.move-reroll').forEach(btn=>{
    btn.disabled=!canEdit()||humanParticipant().gold<RULES.moveChangeCostGold;
    btn.addEventListener('click',()=>{
      if(changeLocalMove(localMatch,humanParticipant(),mon,Number(btn.dataset.slot))) {
        renderHud();showToast('Golpe trocado por 2 de ouro.');
      }
    });
  });
  $('sell-selected').disabled=!canEdit();
}
const coinSvg='<svg class="coin-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#e1a62d" stroke="#fff1a2" stroke-width="1.3"/><circle cx="10" cy="10" r="6.4" fill="#ffdb68" stroke="#b47717" stroke-width=".8"/><path d="M12.8 6.8c-.7-.7-4.7-1-4.7 1.2 0 2 4.5 1.2 4.5 3.3 0 2.2-3.8-5.2 1" fill="none" stroke="#935e12" stroke-width="1.5" stroke-linecap="round"/></svg>';
function renderShop() {
  const player=humanParticipant();
  const offers=currentShop();
  const editable=canEdit();
  const kinds=player?.shopKinds||[];
  if(localMatch) {
    const odds=shopOddsForBattle(localMatch.round);
    $('shop-rarity-odds').innerHTML=Object.keys(RARITY_COLORS).map((rarity,i)=>`<span class="rarity-odd" style="--rarity:${RARITY_COLORS[rarity]}" title="${RARITY_LABELS[rarity]}"><i class="rarity-dot"></i>${RARITY_LABELS[rarity]} <b>${odds[i]}%</b></span>`).join('');
  }
  const signature=`${editable}:${offers.join(',')}:${kinds.join(',')}:${player?.gold}:${player?.structureInventory?.map(s=>s.id).join(',')}`;
  if(signature===shopSignature)return;
  shopSignature=signature;
  $('shop-slots').innerHTML=Array.from({length:6},(_,i)=>{
    const id=offers[i];
    if(kinds[i]==='estrutura' && STRUCTURE_BY_ID[id]) {
      const def=STRUCTURE_BY_ID[id];
      const inventory=player.structureInventory||[];
      const fullStacks=inventory.length>=6&&!inventory.some(stack=>stack.id===id);
      return `<button type="button" class="shop-card structure-offer rarity-${def.rarity}" style="--rarity:${def.rarity==='lendaria'?'#ffda52':def.rarity==='rara'?'#5aa5ff':'#9ca3af'}" data-index="${i}" ${!editable||player.gold<def.price||fullStacks?'disabled':''} title="${def.name}, ${def.size}×${def.size}"><span class="shop-portrait"><canvas class="structure-preview" width="100" height="92" aria-hidden="true"></canvas></span><span class="shop-footer"><b>${def.name}</b><span class="shop-price">${coinSvg}<span>${def.price}</span></span></span></button>`;
    }
    if(!id) {
      const waiting=kinds[i]==='item'?'Item · etapa 10':kinds[i]==='estrutura'?'Estrutura · etapa 9':'Vazio';
      return `<button type="button" class="shop-card empty" data-index="${i}" disabled><span class="shop-portrait"><span class="empty-mark">＋</span></span><span class="shop-footer"><b>${waiting}</b></span></button>`;
    }
    const p=BY_ID[id];
    const disabled=!editable||player.gold<p.price;
    return `<button type="button" class="shop-card rarity-${p.rarity}" data-index="${i}" style="--rarity:${RARITY_COLORS[p.rarity]}" ${disabled?'disabled':''} aria-label="Comprar ${p.name} por ${p.price} ouro"><span class="shop-portrait"><canvas class="portrait-fallback visible" width="70" height="70" aria-hidden="true"></canvas></span><span class="shop-footer"><b>${p.name}</b><span class="shop-price">${coinSvg}<span>${p.price}</span></span></span></button>`;
  }).join('');
  $('shop-slots').querySelectorAll('.shop-card').forEach(card=>{
    const index=Number(card.dataset.index);
    const id=offers[index];
    if(!id)return;
    if(BY_ID[id])drawPortrait(card.querySelector('canvas'),BY_ID[id]);
    else if(STRUCTURE_BY_ID[id])drawStructurePreview(card.querySelector('canvas'),STRUCTURE_BY_ID[id]);
    card.addEventListener('click',()=>{if(!suppressShopClick)purchase(index);});
    card.addEventListener('pointerdown',e=>{
      if(e.button!==0||!canEdit())return;
      shopPointer={pointer:e.pointerId,index,speciesId:id,start:{x:e.clientX,y:e.clientY},dragging:false};
    });
  });
}
const {prepareSprites:loadSprites,getImageMeta,drawPortrait,warmPokemon}=createSpriteCache(base,()=>{
  if(localMatch){shopSignature='';renderDetails();renderShop();}
});
async function prepareSprites() {await loadSprites(()=>renderHud());}
function ellipse(x,y,rx,ry,color) {ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
function line(x,y,toX,toY,color,width=1) {ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(toX,toY);ctx.stroke();}
// Somente imagens locais de public: nenhuma textura ou estrutura procedural.
const sceneryImages=new Map();
const sceneryPreviews=new Map();
function sceneryImage(kind,id) {
  const key=`${kind}/${id}`;
  if(sceneryImages.has(key))return sceneryImages.get(key);
  const image=new Image();
  sceneryImages.set(key,image);
  image.onload=()=>{for(const redraw of sceneryPreviews.get(key)||[])redraw();};
  image.src=`${base}assets/${kind}/${id}.png`;
  return image;
}
function tileArt(id){return sceneryImage('terrenos',TERRAIN[id]?id:'neutro');}
function drawTile(c,id,x,y,w=BOARD.tile,h=BOARD.tile){
  const image=tileArt(id);
  if(image.naturalWidth){c.imageSmoothingEnabled=false;c.drawImage(image,x,y,w,h);}
}
function registerPreview(kind,id,redraw){
  const key=`${kind}/${id}`;
  const previews=sceneryPreviews.get(key)||new Set();
  // Elementos removidos da loja não permanecem no cache.
  for(const callback of previews)if(!callback.canvas.isConnected)previews.delete(callback);
  previews.add(redraw);sceneryPreviews.set(key,previews);
  redraw();
}
function paintTilePreview(canvas,id){
  if(!canvas)return;
  const redraw=()=>{
    const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
    drawTile(c,id,0,0,canvas.width/2,canvas.height);
    drawTile(c,id,canvas.width/2,0,canvas.width/2,canvas.height);
  };
  redraw.canvas=canvas;registerPreview('terrenos',id,redraw);
}
function drawStructureArt(c,item,x,y,w,h){
  if(!item)return;
  const image=sceneryImage('estruturas',item.id);
  if(!image.naturalWidth)return;
  const scale=Math.min(w/image.naturalWidth,h/image.naturalHeight);
  const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  c.imageSmoothingEnabled=false;
  c.drawImage(image,x+(w-width)/2,y+(h-height)/2,width,height);
}
function drawStructurePreview(canvas,item){
  if(!canvas||!item)return;
  const redraw=()=>{
    const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
    drawStructureArt(c,item,0,0,canvas.width,canvas.height);
  };
  redraw.canvas=canvas;registerPreview('estruturas',item.id,redraw);
}
function drawArenaFloor(){
  ctx.fillStyle='#182e22';ctx.fillRect(0,0,BOARD.width,BOARD.height);
  ctx.fillStyle='#566b5b';
  ctx.fillRect(BOARD.x-12,BOARD.y-12,BOARD.columns*BOARD.tile+24,BOARD.rows*BOARD.tile+24);
  for(let row=0;row<BOARD.rows;row++)for(let col=0;col<BOARD.columns;col++){
    drawTile(ctx,'neutro',BOARD.x+col*BOARD.tile,BOARD.y+row*BOARD.tile);
  }
}
function drawBoard(t) {
  drawArenaFloor();
  if(localMatch){
    const watched=observedParticipant();
    const combat=observedCombat();
    const shown=displayedBattle();
    const running=shown?.phase==='finished'?null:shown;
    const bottomPlayer=running ? localMatch.players.find(p=>p.id===combat.playerIds[0]) : watched;
    const topPlayer=running ? localMatch.players.find(p=>p.id===combat.playerIds[1]) : null;
    for(const [player,isTop] of [[bottomPlayer,false],[topPlayer,true]]){
      if(!player)continue;
      const field=player.terrain||[];
      for(let r=0;r<5;r++)for(let col=0;col<10;col++){
        const tile=TERRAIN[field[r*10+col]];
        if(!tile||field[r*10+col]==='neutro')continue;
        const row=isTop?5-r:BOARD.playerFieldStart+r;
        const x=BOARD.x+col*BOARD.tile,y=BOARD.y+row*BOARD.tile;
        drawTile(ctx,field[r*10+col],x,y);
      }
      for(const structure of player.structures||[]){
        if(drag?.kind==='placed-structure'&&drag.structure===structure)continue;
        const item=STRUCTURE_BY_ID[structure.id];if(!item)continue;
        const row=isTop?5-structure.row-(item.size-1):BOARD.playerFieldStart+structure.row;
        const x=BOARD.x+structure.col*BOARD.tile,y=BOARD.y+row*BOARD.tile;
        drawStructureArt(ctx,item,x+1,y+1,BOARD.tile*item.size-2,BOARD.tile*item.size-2);
      }
    }
  }
  if (localMatch) {
    const watching = displayedBattle()&&observedCombat()?.playerIds?.length===2
      ? localMatch.players.find(p=>p.id===observedCombat().playerIds[0]) : observedParticipant();
    if (watching) {
      ctx.save();
      ctx.fillStyle = 'rgba(11,36,22,.78)';
      ctx.fillRect(BOARD.x+BOARD.tile*2,BOARD.y+BOARD.tile*.39,BOARD.tile*6,25);
      ctx.fillStyle = watching.isBot ? '#fee197' : '#d3f6cf';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px system-ui';
      ctx.fillText(`CAMPO ${watching.isBot ? watching.name.toUpperCase() : 'DO JOGADOR'}`,BOARD.x+BOARD.tile*5,BOARD.y+BOARD.tile*.61);
      ctx.restore();
    }
  }
  ctx.save();
  ctx.fillStyle = 'rgba(43,112,174,.10)';
  ctx.fillRect(BOARD.x, BOARD.y + BOARD.playerFieldStart * BOARD.tile, BOARD.columns * BOARD.tile, BOARD.enemyRows * BOARD.tile);
  ctx.fillStyle = 'rgba(185,75,94,.10)';
  ctx.fillRect(BOARD.x, BOARD.y + BOARD.enemyFieldStart * BOARD.tile, BOARD.columns * BOARD.tile, BOARD.enemyRows * BOARD.tile);
  const showGrid = canEdit() && (drag || hovered || activeTab==='terrain');
  ctx.strokeStyle = showGrid ? 'rgba(238,255,214,.45)' : 'rgba(238,255,214,.18)';
  ctx.lineWidth = 1;
  for (let col = 0; col <= BOARD.columns; col++) line(BOARD.x + col * BOARD.tile, BOARD.y, BOARD.x + col * BOARD.tile, BOARD.y + BOARD.rows * BOARD.tile, ctx.strokeStyle);
  for (let row = 0; row <= BOARD.rows; row++) line(BOARD.x, BOARD.y + row * BOARD.tile, BOARD.x + BOARD.columns * BOARD.tile, BOARD.y + row * BOARD.tile, ctx.strokeStyle);
  if (hovered && canEdit()) {
    const isValid = hovered.row === BOARD.playerBenchRow || validCellForTeam(0, hovered);
    ctx.fillStyle = isValid ? 'rgba(255,245,171,.24)' : 'rgba(255,90,105,.24)';
    ctx.fillRect(BOARD.x + hovered.col * BOARD.tile, BOARD.y + hovered.row * BOARD.tile, BOARD.tile, BOARD.tile);
  }
  ctx.restore();

}
const {unitScale,groundShadow,drawUnitSprite} = createSpriteRenderer(ctx,getImageMeta);

function drawSetupUnit(mon) {
  const p = BY_ID[mon.speciesId];
  const pos = {...monWorld(mon)};
  const returning=returnAnimation?.playerId===observedId ? returnAnimation : null;
  const prior=returning?.units.find(u=>u.uid===mon.instanceId);
  const progress=returning?clamp((visualTime-returning.time)/.9,0,1):1;
  let facing=0;
  ctx.save();
  if(prior&&!prior.dead&&progress<1){
    pos.x=prior.x+(pos.x-prior.x)*progress;
    pos.y=prior.y+(pos.y-prior.y)*progress;
    facing=(prior.facing+Math.round(((8-prior.facing)%8)*progress))%8;
  } else if(prior?.dead&&progress<1){ctx.globalAlpha=progress;pos.y-=18*(1-progress);}
  groundShadow(p, pos.x, pos.y, selectedId === mon.instanceId ? '#ffe177' : null);
  drawUnitSprite(p, pos.x, pos.y, 'Idle', facing, visualTime);
  ctx.restore();
}
function drawShopGhost(activeDrag) {
  const p = BY_ID[currentShop()[activeDrag.index] || activeDrag.speciesId];
  if (!activeDrag.world) return;
  const structure=STRUCTURE_BY_ID[activeDrag.id||currentShop()[activeDrag.index]];
  if(structure){
    ctx.save();ctx.globalAlpha=.78;
    const size=BOARD.tile*structure.size;
    drawStructureArt(ctx,structure,activeDrag.world.x-size/2,activeDrag.world.y-size/2,size,size);
    ctx.restore();return;
  }
  if(!p)return;
  ctx.save();
  ctx.globalAlpha = .8;
  groundShadow(p, activeDrag.world.x, activeDrag.world.y);
  drawUnitSprite(p, activeDrag.world.x, activeDrag.world.y, 'Idle', 0, visualTime);
  ctx.restore();
}
function drawBattleUnit(u) {
  if (u.dead) return;
  const intro=localMatch.phase==='intro';
  const progress=intro?clamp((performance.now()/1000-localMatch.phaseStartedAt)/RULES.battleIntroSeconds,0,1):1;
  ctx.save();
  if(intro&&u.team===1){ctx.globalAlpha=progress;ctx.translate(0,-28*(1-progress));}
  groundShadow(u.type, u.x, u.y, selectedId === u.uid ? (u.team === 0 ? '#70cfff' : '#ffaaa0') : null);
  if (u.hitFlash > 0) ellipse(u.x, u.y - 16, 32, 28, `rgba(255,250,210,${u.hitFlash * 1.9})`);
  drawUnitSprite(u.type, u.x, u.y, intro?'Idle':u.state, intro?(u.team===0?Math.round(progress*4):0):u.facing, u.stateTime, u.cast?.elapsed ?? 0, u.cast);
  const bw = clamp(32 + unitScale(u.type) * 4, 38, 50);
  const bh = 6;
  const py = u.y - ([0, 48, 64, 79][u.type.stage]);
  const health = clamp(u.health / u.maxHealth, 0, 1);
  ctx.fillStyle = '#142b1cdd';
  ctx.fillRect(u.x - bw / 2, py, bw, bh);
  ctx.fillStyle = health > .35 ? '#87e26f' : '#ffbd66';
  ctx.fillRect(u.x - bw / 2 + 1, py + 1, (bw - 2) * health, bh - 2);
  ctx.restore();
}

function drawEffects(activeBattle) {
  for (const p of activeBattle.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.globalAlpha = .24;
    ellipse(-13, 0, 20, 8, p.color);
    ctx.globalAlpha = 1;
    const move = MOVES_BY_ID[p.moveId];
    ellipse(0, 0, 15, 7, move?.color || '#fff');
    ellipse(4, 0, 7, 4, '#f8fdff');
    ctx.restore();
  }
  for (const e of activeBattle.effects) {
    const a = 1 - e.time / e.total;
    ctx.save();
    ctx.globalAlpha = 1 - a;
    for (let j = 0; j < 7; j++) {
      const angle = TAU * j / 7;
      const r = 8 + a * 33;
      line(e.x + Math.cos(angle) * r * .4, e.y + Math.sin(angle) * r * .4, e.x + Math.cos(angle) * r, e.y + Math.sin(angle) * r, e.color, 3);
    }
    ctx.restore();
  }
  for (const f of activeBattle.floaters) {
    const a = 1 - f.time / f.total;
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.time * 4);
    ctx.font = '900 18px system-ui';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#17371f';
    ctx.shadowBlur = 4;
    ctx.fillStyle = f.kind === 'atk' ? '#fff0aa' : '#e4f7ff';
    ctx.fillText(f.text, f.x, f.y - a * 34);
    ctx.restore();
  }
}
function updateEvolutionEffects(dt) {
  for (let i = evolutionEffects.length - 1; i >= 0; i--) {
    evolutionEffects[i].time += dt;
    if (evolutionEffects[i].time >= evolutionEffects[i].total) evolutionEffects.splice(i, 1);
  }
}
function drawEvolutionEffects() {
  for (const e of evolutionEffects) {
    const a = clamp(e.time / e.total, 0, 1);
    const pull = 1 - Math.pow(1 - a, 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .18 + Math.sin(a * Math.PI) * .34;
    ellipse(e.to.x, e.to.y - 12, 48 + a * 26, 36 + a * 18, '#fff0a8');
    ctx.restore();
    for (const item of e.from) {
      const p = BY_ID[item.speciesId];
      const x = item.x + (e.to.x - item.x) * pull;
      const y = item.y + (e.to.y - item.y) * pull - Math.sin(a * Math.PI) * 20;
      ctx.save();
      ctx.globalAlpha = 1 - a * .55;
      drawUnitSprite(p, x, y, 'Idle', 0, visualTime);
      ctx.restore();
    }
    if (a > .68) {
      const p = BY_ID[e.newSpeciesId];
      ctx.save();
      ctx.globalAlpha = clamp((a - .68) / .32, 0, 1);
      drawUnitSprite(p, e.to.x, e.to.y - Math.sin(a * Math.PI) * 10, 'Idle', 0, visualTime);
      ctx.restore();
    }
  }
}
function draw() {
  const activeBattle = displayedBattle();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, screen.w, screen.h);
  ctx.fillStyle = '#16351e';
  ctx.fillRect(0, 0, screen.w, screen.h);
  ctx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, dpr * camera.x, dpr * camera.y);
  drawBoard(visualTime);
  if (!activeBattle || activeBattle.phase === 'finished') {
    allUnits().slice().sort((a, b) => monWorld(a).y - monWorld(b).y).forEach(drawSetupUnit);
    if (drag?.kind === 'shop'||drag?.kind === 'inventory-structure'||drag?.kind === 'placed-structure') drawShopGhost(drag);
    drawEvolutionEffects();
  } else {
    activeBattle.units.filter(u => !u.dead).slice().sort((a, b) => a.y - b.y).forEach(drawBattleUnit);
    drawEffects(activeBattle);
    observedParticipant()?.bench.filter(Boolean).forEach(drawSetupUnit);
  }
}
function frame(timestamp) {
  if(!lastFrame)lastFrame=timestamp;
  const dt=Math.min(.05,(timestamp-lastFrame)/1000);
  lastFrame=timestamp;
  visualTime+=dt;
  updateCamera(dt);
  updateEvolutionEffects(dt);
  if(localMatch) {
    const previousBattle=displayedBattle();
    const previousCombat=observedCombat();
    const previousPhase=localMatch.phase;
    const previousRound=localMatch.round;
    updateLocalMatchCycle(localMatch,dt,timestamp/1000);
    if(previousBattle?.phase==='finished'&&lastReturnedBattle!==previousBattle){
      lastReturnedBattle=previousBattle;
      const team=previousCombat.playerIds.indexOf(observedId);
      returnAnimation={playerId:observedId,time:visualTime,units:previousBattle.units.filter(u=>u.team===team).map(u=>({...u}))};
    }
    if(previousPhase!==localMatch.phase||previousRound!==localMatch.round) {
      selectedId=null;
      drag=null;
      shopSignature='';
      renderHud();
    }
    if(localMatch.phase==='finished'&&!announced) {
      announced=true;
      const champion=localMatch.players.find(p=>p.id===localMatch.championId);
      $('result-title').textContent=champion?`${champion.isBot?champion.name:'Você'} venceu`:'Sem vencedor';
      $('result-note').textContent='Partida local concluída. Inicie outra partida para jogar novamente.';
      $('outcome').hidden=false;
      renderHud();
    }
    if(Math.floor(timestamp/250)!==hudTick) {
      hudTick=Math.floor(timestamp/250);
      renderHud();
    }
  }
  draw();
  requestAnimationFrame(frame);
}
function sizeCanvas() {
  const rect=canvas.getBoundingClientRect();
  screen={w:Math.max(320,rect.width),h:Math.max(320,rect.height)};
  dpr=clamp(window.devicePixelRatio||1,1,2);
  canvas.width=Math.round(screen.w*dpr);
  canvas.height=Math.round(screen.h*dpr);
  fitCamera();
}
$('compass-ring').addEventListener('pointermove',e=>{
  const box=$('compass-ring').getBoundingClientRect();
  const x=e.clientX-(box.left+box.width/2),y=e.clientY-(box.top+box.height/2);
  const degrees=(Math.atan2(x,-y)*180/Math.PI+360)%360;
  const slice=compassPieSlices.find(segment=>degrees>=segment.from&&degrees<segment.to);
  if(slice)showCompassType(slice.type);
});
$('compass-widget').addEventListener('pointerleave',()=>showCompassType(compassFirstType));
$('remove-placed').addEventListener('click',()=>{terrainTool='remove';selectedStructure=null;terrainSignature='';renderHud();});
$('tab-pokemon').addEventListener('click',()=>{activeTab='pokemon';terrainPainting=null;renderHud();});
$('tab-terrain').addEventListener('click',()=>{activeTab='terrain';drag=null;shopPointer=null;terrainSignature='';renderHud();});
$('discard-structure').addEventListener('click',()=>{
  if(canEdit()&&selectedStructure&&window.confirm('Descartar uma estrutura sem reembolso?')){
    if(discardStructure(localMatch,humanParticipant(),selectedStructure)){
      if(!humanParticipant().structureInventory.some(s=>s.id===selectedStructure)){selectedStructure=null;terrainTool='grama';}
      terrainSignature='';renderHud();showToast('Uma estrutura descartada.');
    }
  }
});
$('confirm-match').addEventListener('click',startMatch);
$('return-menu').addEventListener('click',openMenu);
$('again').addEventListener('click',openMenu);
$('back-own-arena').addEventListener('click',()=>observePlayer(localMatch?.ownerId));
$('zoom-in').addEventListener('click',()=>zoomAt({x:screen.w/2,y:screen.h/2},1.15));
$('zoom-out').addEventListener('click',()=>zoomAt({x:screen.w/2,y:screen.h/2},.87));
$('camera-reset').addEventListener('click',fitCamera);
$('reroll-shop').addEventListener('click',()=>{
  if(!canEdit())return;
  if(!refreshLocalShop(localMatch,humanParticipant(),Math.random,true))showToast('Reroll indisponível.');
  shopSignature='';
  renderHud();
});
$('lock-shop').addEventListener('click',()=>{
  if(canEdit()) {toggleLocalShopLock(localMatch,humanParticipant());shopSignature='';renderHud();}
});
$('sell-selected').addEventListener('click',()=>sell(selectedMon()));
window.addEventListener('resize',sizeCanvas);
sizeCanvas();
renderHud();
prepareSprites();
requestAnimationFrame(frame);
