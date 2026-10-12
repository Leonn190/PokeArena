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
const hash = (x,y,z=0) => {
  let v=Math.imul(x*374761393 ^ y*668265263 ^ z*1274126177,1597334677);
  v^=v>>>13;
  v=Math.imul(v,1274126177);
  return ((v^(v>>>16))>>>0)/4294967295;
};
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

function humanParticipant() { return localMatch?.players.find(p=>p.id===localMatch.ownerId)||null; }
function observedParticipant() { return localMatch?.players.find(p=>p.id===observedId)||humanParticipant(); }
function canEdit() { return !!localMatch && localMatch.phase==='preparation' &&
  observedId===localMatch.ownerId && !humanParticipant()?.eliminated; }
function observedCombat() { return combatForPlayer(localMatch,observedId); }
function displayedBattle() { return localMatch?.phase==='combat' ? observedCombat()?.battle||null : null; }
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
  $('timer-label').textContent=localMatch?`${phaseRemainingSeconds(localMatch,performance.now()/1000)}s`:'45s';
  $('phase-label').textContent=localMatch?.phase==='combat'?'Combate · Local':localMatch?.phase==='finished'?'Fim de partida':'Preparação · Local';
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
    $('match-panel-note').textContent=localMatch.phase==='combat'?
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
  $('compass-lead').textContent=leaders[0]?.type||'Neutra';
  $('compass-widget').setAttribute('aria-label',leaders.length?`Bússola: ${leaders.map(x=>`${x.type} ${x.score.toFixed(1)} pontos`).join(', ')}`:'Bússola neutra, nenhuma influência');
  $('compass-breakdown').innerHTML=ranked.map(({type,score})=>
    `<div class="compass-entry" data-type="${type}" style="--type-color:${TYPE_COLORS[type]}"><i class="type-color"></i><span>${type}</span><b>${+score.toFixed(1)}</b></div>`).join('');
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
  $('compass-lead').textContent=selected||'Neutra';
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
  $('environment-effects').innerHTML=effects.length ? effects.map(e=>`<div><b>${e.type}</b> · ${e.stat==='regen'?`${(e.bonus*100).toFixed(2)}% HP/s`:`+${(e.bonus*100).toFixed(1)}% ${e.stat}`}<small>${e.sources.join(', ')} · 1,5× perto</small></div>`).join('') : '<div>Nenhuma estrutura posicionada</div>';
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
  $('selected-type').textContent=`${p.types.join('/')} · ${RARITY_LABELS[p.rarity]} · ${mon.evolutionSteps?`Evolução ${mon.evolutionSteps}`:stageName[p.stage]}`;
  $('selected-type').style.color=p.color;
  $('selected-place').textContent=slot!==null?`Banco ${slot+1}`:`Campo ${mon.col+1},${mon.row+1}`;
  $('selected-iv').textContent=`IV geral ${mon.iv}%${mon.zygardeProgress?` · Zygarde ${mon.zygardeProgress}%`:''}${mon.babyPerfect?' · Baby perfeito':''}`;
  $('sell-value').textContent=`Venda: ${saleValueLocal(mon)} ouro`;
  drawSmallSprite($('selected-avatar'),p,4);
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
    if(BY_ID[id])drawSmallSprite(card.querySelector('canvas'),BY_ID[id],0);
    else if(STRUCTURE_BY_ID[id])drawStructurePreview(card.querySelector('canvas'),STRUCTURE_BY_ID[id]);
    card.addEventListener('click',()=>{if(!suppressShopClick)purchase(index);});
    card.addEventListener('pointerdown',e=>{
      if(e.button!==0||!canEdit())return;
      shopPointer={pointer:e.pointerId,index,speciesId:id,start:{x:e.clientX,y:e.clientY},dragging:false};
    });
  });
}
const {prepareSprites:loadSprites,getImageMeta,drawSmallSprite,warmPokemon}=createSpriteCache(base,()=>{
  if(localMatch){shopSignature='';renderDetails();renderShop();}
});
async function prepareSprites() {await loadSprites(()=>renderHud());}
function ellipse(x,y,rx,ry,color) {ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
function line(x,y,toX,toY,color,width=1) {ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(toX,toY);ctx.stroke();}
// Texturas em pixel art geradas uma única vez e compartilhadas pelo campo e pelas miniaturas.
function makeTileArt(id,variant=0) {
  const tile=document.createElement('canvas');tile.width=58;tile.height=58;
  const c=tile.getContext('2d');c.imageSmoothingEnabled=false;
  const rand=(n,s=0)=>hash(n+variant*31,s+variant*11,id.length*19);
  const bases={neutro:['#e2e6db','#dfe4d9','#e8e9df'],grama:['#7db44e','#83ba55','#76ab49'],rosa:['#b7769a','#cc8eaa','#bf7ea3'],terra:['#a98154','#b08a5e','#987247'],lama:['#645b4e','#736554','#5c544c'],areia:['#dac189','#d2b779','#e5cd97'],neve:['#e3f2ef','#f0f5f2','#d8eae9'],rochoso:['#85877d','#93958a','#797e75'],metalico:['#778e93','#91a7ac','#809ca2'],rasa:['#6cbbba','#74c9c6','#5eafb6'],funda:['#35718b','#3b8098','#2c6788']};
  const palette=bases[id]||bases.neutro;
  c.fillStyle=palette[variant%3];c.fillRect(0,0,58,58);
  const dot=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
  const stroke=(x,y,x2,y2,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();};
  const arc=(x,y,r,color,start=0,end=Math.PI*2)=>{c.strokeStyle=color;c.lineWidth=1.4;c.beginPath();c.arc(x,y,r,start,end);c.stroke();};
  for(let i=0;i<36;i++){
    const x=rand(i,1)*57,y=rand(i,2)*57;
    dot(x,y,1+(rand(i,3)>.8?2:0),1,rand(i,4)>.48?'#ffffff24':'#172b2822');
  }
  if(id==='neutro'){
    // Piso neutro: arenito marfim claro, com juntas finas e pequenos seixos.
    for(let i=0;i<7;i++){
      const x=rand(i,6)*51,y=rand(i,7)*51;
      stroke(x,y,x+5+rand(i,8)*5,y+(rand(i,9)-.5)*2,'#bdc8bc',1);
      if(i%2===0)dot(x+3,y+4,3,2,'#f8f8ee');
    }
    stroke(2,55,56,55,'#cad7cc77');
  } else if(id==='grama'||id==='rosa'){
    for(let j=0;j<17;j++){
      const x=4+rand(j,9)*50,y=4+rand(j,10)*47;
      const dark=id==='grama'?'#5b9540':'#9b5b86',light=id==='grama'?'#add376':'#f5bbd5';
      stroke(x,y+4,x-2,y,dark);stroke(x+1,y+4,x+3,y-2,light);
      if(id==='rosa'&&j%3===0){
        dot(x-2,y-2,3,3,'#ffd6e6');dot(x+1,y-4,3,3,'#ffb5d8');dot(x+1,y,3,2,'#e99fc5');dot(x,y-1,2,2,'#ffe5a0');
      }
    }
  } else if(id==='terra'){
    for(let i=0;i<10;i++){
      const x=rand(i,15)*53,y=rand(i,16)*54;
      dot(x,y,4+rand(i,17)*5,3,'#795637');dot(x+1,y,3,1,'#d7b184');
      if(i%3===0){stroke(x+11,y+3,x+17,y+6,'#d9bb8a');stroke(x+14,y+5,x+12,y+9,'#826040');}
    }
  } else if(id==='lama'){
    for(let i=0;i<8;i++){
      const x=6+rand(i,18)*44,y=5+rand(i,19)*47;
      c.fillStyle=i%2?'#4a473f':'#8f7960';c.beginPath();c.ellipse(x,y,5+rand(i,20)*6,2+rand(i,21)*3,0,0,Math.PI*2);c.fill();
      stroke(x-3,y-1,x+2,y-1,'#b19c7b');
      if(i%3===0)arc(x+8,y+4,3,'#a2917d',0,Math.PI);
    }
  } else if(id==='areia'){
    for(let i=0;i<7;i++){
      const x=rand(i,22)*50,y=rand(i,23)*51;
      c.strokeStyle=i%2?'#f9e3ae':'#bda36e';c.lineWidth=1.7;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+7,y-5,x+13,y-2);c.stroke();
      dot(x+3,y+6,2,2,'#b99a62');
    }
  } else if(id==='neve'){
    for(let i=0;i<7;i++){
      const x=6+rand(i,24)*46,y=5+rand(i,25)*45;
      stroke(x-5,y,x+5,y,'#b7d7df');stroke(x,y-5,x,y+5,'#c1dee1');
      stroke(x-3,y-3,x+3,y+3,'#faffff');stroke(x+3,y-3,x-3,y+3,'#faffff');
      dot(x-1,y-1,3,3,'#ffffff');
    }
  } else if(id==='rochoso'){
    for(let i=0;i<10;i++){
      const x=rand(i,26)*53,y=rand(i,27)*52,w=4+rand(i,28)*9;
      c.fillStyle=i%2?'#5d6b64':'#aeb1a0';c.beginPath();c.moveTo(x,y+5);c.lineTo(x+3,y-1);c.lineTo(x+w,y+1);c.lineTo(x+w-2,y+7);c.closePath();c.fill();
      stroke(x+2,y,x+w-2,y+1,'#d0d1bc');
    }
  } else if(id==='metalico'){
    c.fillStyle='#6c878f';c.fillRect(0,0,58,3);c.fillRect(0,55,58,3);
    stroke(29,0,29,58,'#526d77',2);stroke(0,29,58,29,'#b7c8c4',1.5);
    for(const x of [7,24,35,52])for(const y of [6,23,36,52]){
      c.fillStyle='#c5d4d1';c.beginPath();c.arc(x,y,1.8,0,Math.PI*2);c.fill();dot(x,y,1,1,'#526e74');
    }
    stroke(4,4,22,4,'#bed4d0');stroke(34,34,51,34,'#c0d8d2');
  } else if(id==='rasa'||id==='funda'){
    for(let i=0;i<9;i++){
      const x=rand(i,29)*47+3,y=rand(i,30)*47+3;
      c.strokeStyle=id==='rasa'?'#c6f8df':'#7ac2d6';c.lineWidth=1.5;c.beginPath();c.moveTo(x,y+3);c.quadraticCurveTo(x+5,y-2,x+11,y+2);c.stroke();
      if(i%3===0){arc(x+2,y+9,2,id==='rasa'?'#e5fae1':'#a3d5dc');}
      if(id==='rasa'&&i%4===0){stroke(x+12,y+8,x+10,y+1,'#4f9680',2);stroke(x+11,y+5,x+15,y+2,'#a7d9a0');}
    }
  }
  c.strokeStyle='#ffffff17';c.strokeRect(.5,.5,57,57);
  return tile;
}
const TILE_ART=Object.fromEntries(Object.keys(TERRAIN).map(id=>[id,Array.from({length:4},(_,n)=>makeTileArt(id,n))]));
function tileArt(id,col,row){return (TILE_ART[id]||TILE_ART.neutro)[(col*7+row*11+16)%4];}
function paintTilePreview(canvas,id){
  if(!canvas)return;
  const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  c.drawImage(tileArt(id,0,0),0,0,58,58);c.drawImage(tileArt(id,1,0),58,0,58,58);
}
function drawStructureArt(c,item,x,y,w,h){
  if(!item)return;
  c.save();c.translate(x+w/2,y+h/2);c.scale(w/76,h/76);
  c.shadowColor='#0008';c.shadowBlur=3;
  c.fillStyle='#16251caf';c.beginPath();c.ellipse(0,22,30,9,0,0,Math.PI*2);c.fill();c.shadowBlur=0;
  const shape=(fill,pts)=>{c.fillStyle=fill;c.beginPath();pts.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.closePath();c.fill();};
  const line=(stroke,pts,width=3)=>{c.strokeStyle=stroke;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.stroke();};
  const oval=(fill,a,b,rx,ry)=>{c.fillStyle=fill;c.beginPath();c.ellipse(a,b,rx,ry,0,0,Math.PI*2);c.fill();};
  const rock=()=>{shape('#586b70',[[-22,15],[-25,-7],[-7,-22],[15,-17],[25,10],[15,20]]);shape('#a7aaa0',[[-25,-7],[-7,-22],[5,-7],[-9,8]]);shape('#758b86',[[5,-7],[15,-17],[25,10],[2,15]]);};
  const tree=(ancient=false)=>{
    shape(ancient?'#6a492c':'#845431',[[-10,19],[-6,-9],[4,-11],[11,19]]);
    line('#b3804f',[[-1,16],[-1,-7]],4);
    for(const [xx,yy,rr] of [[-16,-8,16],[9,-11,17],[-2,-23,20],[17,-23,13]]){
      oval(ancient?'#397e55':'#4d9455',xx,yy,rr,rr*.8);
      oval(ancient?'#8abc66':'#a5cf75',xx-5,yy-6,rr*.5,rr*.37);
    }
    if(ancient){oval('#ffe6a5',4,-32,4,6);oval('#d0f4b3',19,-9,3,4);}
  };
  const water=()=>{
    oval('#50777e',0,19,27,7);oval('#79b8b8',0,15,23,6);
    c.strokeStyle='#b5f7ea';c.lineWidth=3;c.beginPath();c.moveTo(-14,13);c.quadraticCurveTo(-10,-27,0,-21);c.quadraticCurveTo(12,-29,13,13);c.stroke();
    oval('#d9f4ee',0,-25,4,7);
  };
  switch(item.id){
    case 'planta':
      line('#396e43',[[0,20],[0,-16]],5);
      for(const [a,b,r] of [[-11,3,-.5],[13,-4,.45],[-9,-14,-.7],[9,-23,.7]]){
        c.save();c.translate(a,b);c.rotate(r);oval('#81c66e',0,0,11,5);oval('#c1e998',-3,-1,4,2);c.restore();
      }break;
    case 'flores':
      for(const [xx,yy,color] of [[-12,0,'#ef9bc5'],[7,-15,'#e3c0f3'],[15,8,'#ffdb84']]){
        line('#539262',[[xx,19],[xx,yy]],3);
        for(let j=0;j<5;j++){const a=j*Math.PI*2/5;oval(color,xx+Math.cos(a)*7,yy+Math.sin(a)*7,5,5);}
        oval('#ffed9a',xx,yy,4,4);
      }break;
    case 'pedra':rock();break;
    case 'arvorezinha':tree();break;
    case 'cacto':
      line('#448659',[[0,22],[0,-22]],10);line('#448659',[[0,4],[-15,4],[-15,-8]],7);line('#448659',[[0,-6],[13,-6],[13,-17]],7);
      line('#b9d27b',[[3,13],[3,-20]],2);oval('#f1a5a9',0,-23,6,4);break;
    case 'antena':
      shape('#697e8a',[[-18,19],[-5,-24],[5,-24],[18,19]]);line('#d0e5e6',[[-13,15],[12,15]],2);
      line('#d5dce2',[[0,-23],[0,-31]],3);oval('#fee47c',0,-32,5,5);
      for(const [a,b] of [[-22,-4],[22,-4]])line('#89c8de',[[0,-21],[a,b]],2);break;
    case 'fonte':water();break;
    case 'colmeia':
      shape('#b8833e',[[-15,18],[-22,-5],[-10,-22],[13,-22],[23,-4],[13,18]]);
      for(const [x,y] of [[-9,-13],[6,-13],[-15,0],[0,0],[14,0],[-8,13],[7,13]]){
        shape('#f5c96e',[[x-6,y],[x-3,y-5],[x+3,y-5],[x+6,y],[x+3,y+5],[x-3,y+5]]);
        oval('#946533',x,y,3,3);
      }break;
    case 'cristal-gelo':
      shape('#9adae9',[[-20,14],[-13,-20],[-1,-34],[11,-18],[21,17],[3,25]]);
      shape('#d7f8ff',[[-13,-20],[-1,-34],[4,-6],[3,25],[-8,12]]);
      shape('#5da9cf',[[4,-6],[11,-18],[21,17],[3,25]]);break;
    case 'braseiro':
      shape('#7a6352',[[-21,9],[21,9],[13,20],[-14,20]]);
      line('#d0ab7b',[[-20,9],[20,9]],4);
      shape('#f7b53a',[[-12,8],[-16,-10],[-7,-2],[-3,-29],[6,-15],[14,-21],[13,8]]);
      shape('#ffe99d',[[-5,8],[-7,-4],[0,-18],[5,0],[9,8]]);break;
    case 'arvore-ancestral':tree(true);break;
    case 'obelisco':
      shape('#535d81',[[-20,20],[-14,-7],[0,-36],[15,-7],[20,20]]);
      shape('#9dabc2',[[-14,-7],[0,-36],[1,19],[-20,20]]);
      line('#ffdf74',[[0,-29],[0,14]],4);oval('#fff5bf',0,-3,5,7);break;
    case 'templo-mares':
      shape('#acc6bd',[[-29,-7],[0,-28],[29,-7]]);
      for(const xx of [-19,0,19]){
        c.fillStyle='#709ba7';c.fillRect(xx-5,-6,10,23);c.fillStyle='#c5e3de';c.fillRect(xx-5,-6,4,23);
      }
      c.fillStyle='#66899e';c.fillRect(-28,17,56,6);water();break;
    case 'santuario-glacial':
      shape('#b7d6df',[[-28,19],[-27,-8],[0,-32],[28,-8],[28,19]]);
      shape('#ecfaff',[[-27,-8],[0,-32],[6,19],[-28,19]]);
      shape('#649ab3',[[-8,19],[-8,2],[0,-8],[8,2],[8,19]]);
      for(const xx of [-20,20])oval('#ffffff',xx,-9,3,8);break;
  }
  c.restore();
}
function drawStructurePreview(canvas,item){
  if(!canvas||!item)return;
  const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
  const bg=c.createLinearGradient(0,0,0,canvas.height);
  bg.addColorStop(0,item.rarity==='lendaria'?'#52503a':item.rarity==='rara'?'#294650':'#35503c');bg.addColorStop(1,'#1b2b28');
  c.fillStyle=bg;c.fillRect(0,0,canvas.width,canvas.height);
  c.fillStyle='#aabf8d55';c.beginPath();c.ellipse(canvas.width/2,canvas.height*.78,35,6,0,0,Math.PI*2);c.fill();
  drawStructureArt(c,item,canvas.width/2-30,canvas.height/2-31,60,60);
}
function makeTerrain(){
  const temp=document.createElement('canvas');temp.width=BOARD.width;temp.height=BOARD.height;
  const c=temp.getContext('2d');c.imageSmoothingEnabled=false;
  c.fillStyle='#182e22';c.fillRect(0,0,BOARD.width,BOARD.height);
  for(let y=0;y<BOARD.height;y+=28)for(let x=0;x<BOARD.width;x+=28){
    c.fillStyle=hash(x,y)>.5?'#294632':'#243d2f';c.fillRect(x,y,28,28);
  }
  c.fillStyle='#566b5b';c.fillRect(BOARD.x-12,BOARD.y-12,BOARD.columns*BOARD.tile+24,BOARD.rows*BOARD.tile+24);
  for(let row=0;row<BOARD.rows;row++)for(let col=0;col<BOARD.columns;col++){
    const x=BOARD.x+col*BOARD.tile,y=BOARD.y+row*BOARD.tile;
    c.drawImage(tileArt('neutro',col,row),x,y);
    if(row===BOARD.enemyBenchRow||row===BOARD.playerBenchRow){
      c.fillStyle='#6c7e80aa';c.fillRect(x+1,y+48,BOARD.tile-2,8);
      c.fillStyle='#71848944';c.fillRect(x+4,y+4,50,1);
    }
  }
  c.fillStyle='#d6c68f';c.fillRect(BOARD.x-6,BOARD.y+BOARD.playerFieldStart*BOARD.tile-3,BOARD.columns*BOARD.tile+12,5);
  c.fillStyle='#485d57';c.fillRect(BOARD.x-6,BOARD.y+BOARD.enemyFieldStart*BOARD.tile-5,BOARD.columns*BOARD.tile+12,6);
  c.fillRect(BOARD.x-6,BOARD.y+BOARD.playerBenchRow*BOARD.tile-5,BOARD.columns*BOARD.tile+12,6);
  c.strokeStyle='#e9e3bd';c.lineWidth=2;c.strokeRect(BOARD.x-1,BOARD.y-1,BOARD.columns*BOARD.tile+2,BOARD.rows*BOARD.tile+2);
  return temp;
}
const terrain = makeTerrain();
function drawBoard(t) {
  ctx.drawImage(terrain, 0, 0);
  if(localMatch){
    const watched=observedParticipant();
    const combat=observedCombat();
    const running=combat?.battle;
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
        ctx.drawImage(tileArt(field[r*10+col],col,row),x,y);
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
  for (let i = 0; i < 18; i++) {
    ellipse(BOARD.x + 20 + hash(i, 9) * (BOARD.columns * BOARD.tile - 40), BOARD.y + 20 + hash(9, i) * (BOARD.rows * BOARD.tile - 40), 1.3, 1.3, `rgba(255,247,183,${.18 + .16 * Math.sin(t + i)})`);
  }
}
const {unitScale,groundShadow,drawUnitSprite} = createSpriteRenderer(ctx,getImageMeta);

function drawSetupUnit(mon) {
  const p = BY_ID[mon.speciesId];
  const pos = monWorld(mon);
  groundShadow(p, pos.x, pos.y, selectedId === mon.instanceId ? '#ffe177' : null);
  drawUnitSprite(p, pos.x, pos.y, 'Idle', mon.team ? 0 : 4, visualTime);
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
  drawUnitSprite(p, activeDrag.world.x, activeDrag.world.y, 'Idle', 4, visualTime);
  ctx.restore();
}
function drawBattleUnit(u) {
  if (u.dead) return;
  groundShadow(u.type, u.x, u.y, selectedId === u.uid ? (u.team === 0 ? '#70cfff' : '#ffaaa0') : null);
  if (u.hitFlash > 0) ellipse(u.x, u.y - 16, 32, 28, `rgba(255,250,210,${u.hitFlash * 1.9})`);
  drawUnitSprite(u.type, u.x, u.y, u.state, u.facing, u.stateTime, u.cast?.elapsed ?? 0, u.cast);
  const bw = clamp(32 + unitScale(u.type) * 4, 38, 50);
  const bh = 6;
  const py = u.y - ([0, 48, 64, 79][u.type.stage]);
  const health = clamp(u.health / u.maxHealth, 0, 1);
  ctx.fillStyle = '#142b1cdd';
  ctx.fillRect(u.x - bw / 2, py, bw, bh);
  ctx.fillStyle = health > .35 ? '#87e26f' : '#ffbd66';
  ctx.fillRect(u.x - bw / 2 + 1, py + 1, (bw - 2) * health, bh - 2);
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
      drawUnitSprite(p, x, y, 'Idle', item.team ? 0 : 4, visualTime);
      ctx.restore();
    }
    if (a > .68) {
      const p = BY_ID[e.newSpeciesId];
      ctx.save();
      ctx.globalAlpha = clamp((a - .68) / .32, 0, 1);
      drawUnitSprite(p, e.to.x, e.to.y - Math.sin(a * Math.PI) * 10, 'Idle', 4, visualTime);
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
  if (!activeBattle || activeBattle.phase === 'setup') {
    allUnits().slice().sort((a, b) => monWorld(a).y - monWorld(b).y).forEach(drawSetupUnit);
    if (drag?.kind === 'shop'||drag?.kind === 'inventory-structure'||drag?.kind === 'placed-structure') drawShopGhost(drag);
    drawEvolutionEffects();
  } else {
    activeBattle.units.filter(u => !u.dead).slice().sort((a, b) => a.y - b.y).forEach(drawBattleUnit);
    drawEffects(activeBattle);
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
    const previousPhase=localMatch.phase;
    const previousRound=localMatch.round;
    updateLocalMatchCycle(localMatch,dt,timestamp/1000);
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
