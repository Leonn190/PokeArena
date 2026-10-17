// UI exclusiva da partida local. Toda regra competitiva é aplicada em server/game/.
import { createLocalMatchState, purchaseLocalOffer, refreshLocalShop, sellLocalUnit, toggleLocalShopLock, changeLocalMove, saleValueLocal, canFeedLocalUnit, feedLocalUnit, canManageLocalInventory, confirmLocalBet, selectPveDifficulty, cloneLocalPokemon, BALLS, moveLocalAvatar, moveLocalUnit } from '../../server/game/roster.mjs';
import { createCamera } from './camera.mjs';
import { createSpriteCache } from './sprites.mjs';
import { createSpriteRenderer } from './renderer.mjs';
import { BY_ID, POKEMON, EVOLUTION_OPTIONS, getDirection } from '../../server/game/pokemon.mjs';
import { MOVES_BY_ID, chargedPoolForPokemon, chooseMoveAnimation } from '../../server/game/moves.mjs';
import { fieldLimitForBattle, shopOddsForBattle, RULES, STAGES, STAGE_NAMES, chapterForBattle, stageForBattle, battleKind, interestForGold, streakBonus, PVE_DIFFICULTIES } from '../../server/game/rules.mjs';
import { aliveCount, combatForPlayer, phaseRemainingSeconds, startLocalMatchCycle, updateLocalMatchCycle } from '../../server/game/match-cycle.mjs';
import { BOARD, TAU, cellAtWorld, tilePosition, validCellForTeam, effectiveUnitStats, maxHealth } from '../../server/game/battle.mjs';
import { individualIVs, meanIV, combatPower, applyStructureStats } from '../../server/game/stats.mjs';
import {calculateCompass,ALL_TYPES} from '../../server/game/compass.mjs';
import {STRUCTURE_BY_ID,STRUCTURE_CAPACITY,buyStructure,movePlacedStructure,bankStructure,sellStructure,structurePoints,fieldEffects,structureModifiers} from '../../server/game/structures.mjs';

const $ = id => document.getElementById(id);
const canvas = $('arena');
const ctx = canvas.getContext('2d',{alpha:false});
const base = (canvas.dataset.base || '/').replace(/\/?$/, '/');
const keys = ['vida','atk','def','spa','spd','vel','energia','regeneracao'];
const stageName = {1:'Base',2:'Evoluído',3:'Final'};
const RARITY_COLORS = {comum:'#9ca3af',incomum:'#4ad779',raro:'#5aa5ff',epico:'#b87afa',mitico:'#ff575d',lendario:'#ffda52'};
const RARITY_LABELS = {comum:'Comum',incomum:'Incomum',raro:'Raro',epico:'Épico',mitico:'Mítico',lendario:'Lendário'};
const coinSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>';
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
let ballPointer=null;
let compassSignature='';
let dpr=1;
let screen={w:1000,h:760};
const evolutionEffects=[];
const summonEffects=[];
let returnAnimation=null;
let lastReturnedBattle=null;
let specialDismissedRound=-1;
let rosterRendered=false;
const TYPE_ASSETS={Normal:'normal',Lutador:'fighting',Voador:'flying',Venenoso:'poison',Terrestre:'ground',Pedra:'rock',Inseto:'bug',Fantasma:'ghost',Aço:'steel',Fogo:'fire',Água:'water',Grama:'grass',Elétrico:'electric',Psíquico:'psychic',Gelo:'ice',Dragão:'dragon',Sombrio:'dark',Fada:'fairy'};
const typeIcon=type=>`<img class="type-icon" src="${base}assets/tipos/${TYPE_ASSETS[type]}.png" alt="${type}" />`;
const BALL_ASSETS={pokeball:'poke',greatball:'great',ultraball:'ultra',masterball:'master'};
const ballImages=new Map(Object.entries(BALL_ASSETS).map(([id,file])=>{
  const image=new Image();image.src=`${base}assets/pokebolas/${file}.png`;return [id,image];
}));
const TRAINERS=['red','leaf','brendan','may','wally','steven','archie','maxie'];
const trainerImages=new Map();
const trainerDirections=new Map();

function humanParticipant() { return localMatch?.players.find(p=>p.id===localMatch.ownerId)||null; }
function observedParticipant() { return localMatch?.players.find(p=>p.id===observedId)||humanParticipant(); }
function canEdit() { return !!localMatch && localMatch.phase==='preparation' &&
  observedId===localMatch.ownerId && !humanParticipant()?.eliminated; }
function canManage() { return observedId===localMatch?.ownerId&&canManageLocalInventory(localMatch,humanParticipant()); }
function ownsUnit(mon) { const p=humanParticipant();return !!p&&(p.board.includes(mon)||p.bench.includes(mon)); }
function observedCombat() { return combatForPlayer(localMatch,observedId); }
function displayedBattle() { return ['intro','combat','result'].includes(localMatch?.phase) ? observedCombat()?.battle||null : null; }
function currentShop() { return humanParticipant()?.shop||[]; }
function allUnits() {
  const p=observedParticipant();
  return p?[...p.board,...p.bench.filter(Boolean)]:[];
}
function selectedMon() {
  const battle=displayedBattle();
  const fighter=battle?.phase!=='finished'?battle?.units.find(u=>u.uid===selectedId):null;
  if(fighter) {
    const original=battle.lineups[fighter.team].find(u=>u.instanceId===selectedId);
    return {...original,speciesId:fighter.type.id,health:fighter.health,maxHealth:fighter.maxHealth,level:fighter.level,ivs:fighter.ivs,liveStats:{...fighter.stats},combatUnit:true};
  }
  return allUnits().find(mon=>mon.instanceId===selectedId)||null;
}
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
  ballPointer=null;
  compassSignature='';
  announced=false;
  evolutionEffects.length=0;
  summonEffects.length=0;
  damageSignature='';
  $('damage-content').hidden=true;
  $('toggle-damage').setAttribute('aria-expanded','false');
  $('damage-chevron').textContent='‹';
  returnAnimation=null;
  lastReturnedBattle=null;
  $('entry-screen').hidden=true;
  $('roster-screen').hidden=true;
  specialDismissedRound=-1;
  $('special-overlay').hidden=true;
  $('outcome').hidden=true;
  document.querySelector('.game-shell').dataset.mode='local';
  shopSignature='';
  sizeCanvas();
  renderHud();
}
function openMenu() {
  hideTypeTooltip();
  localMatch=null;
  observedId=null;
  selectedId=null;
  hovered=null;
  drag=null;
  shopPointer=null;
  ballPointer=null;
  pan=null;
  $('entry-screen').hidden=false;
  $('roster-screen').hidden=true;
  $('special-overlay').hidden=true;
  $('outcome').hidden=true;
  $('toast').hidden=true;
  document.querySelector('.game-shell').dataset.mode='menu';
  setShopSellMode(false);
  shopSignature='';
  renderHud();
}
function observePlayer(id) {
  hideTypeTooltip();
  if(!localMatch?.players.some(p=>p.id===id))return;
  observedId=id;
  selectedId=null;
  drag=null;
  hovered=null;
  shopPointer=null;
  ballPointer=null;
  setShopSellMode(false);
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
  if(!canManage())return false;
  const player=humanParticipant();
  const id=player.shop[index];
  if(!id)return false;
  if(player.shopKinds[index]==='estrutura') {
    const def=STRUCTURE_BY_ID[id];
    if(dropCell?.row===BOARD.playerBenchRow&&player.bench[dropCell.col])return false;
    if(dropCell&&dropCell.row!==BOARD.playerBenchRow){
      if(!canEdit()||!validCellForTeam(0,dropCell))return false;
      const col=dropCell.col,row=dropCell.row-BOARD.playerFieldStart;
      if(col+def.size>10||row+def.size>5||
        player.structures.some(s=>{
          const size=STRUCTURE_BY_ID[s.id]?.size||1;
          return col<s.col+size&&col+def.size>s.col&&row<s.row+size&&row+def.size>s.row;
        })||structurePoints(player)+(def.size===2?2:1)>STRUCTURE_CAPACITY)return false;
    }
    const instance=buyStructure(localMatch,player,index);
    if(!instance) {showToast('Sem ouro ou banco cheio.');return false;}
    if(dropCell&&instance)moveUnit(instance,dropCell,false);
    shopSignature='';renderHud();
    if(!dropCell)showToast('Estrutura no banco.');
    return true;
  }
  if(!BY_ID[id])return false;
  if(dropCell) {
    if(!canEdit()&&dropCell.row!==BOARD.playerBenchRow)return false;
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
  if(!priorIds.has(bought.instanceId)&&bought.speciesId===id)summonEffects.push({id:bought.instanceId,time:visualTime});
  warmPokemon(BY_ID[bought.speciesId]);
  if(id==='0718')showToast(`Zygarde ${bought.zygardeProgress}%`);
  renderHud();
  return true;
}
function sell(mon) {
  if(mon?.kind==='structure'){
    if(sellStructure(localMatch,humanParticipant(),mon)){selectedId=null;renderHud();showToast('Estrutura vendida.');}return;
  }
  if(mon?.combatUnit)mon=humanParticipant()?.board.find(u=>u.instanceId===mon.instanceId&&u.speciesId===mon.speciesId)||null;
  if(!canManage()||!mon||!ownsUnit(mon))return;
  if(sellLocalUnit(localMatch,humanParticipant(),mon)) {
    if(selectedId===mon.instanceId)selectedId=null;
    renderHud();
    showToast(`${BY_ID[mon.speciesId].name} vendido por ${saleValueLocal(mon)} ouro.`);
  }
}
function moveUnit(mon,target,swap=true) {
  if(!canManage()||!mon||!target)return false;
  const ok=moveLocalUnit(localMatch,humanParticipant(),mon,target,swap);
  if(!ok)showToast('Posição indisponível ou limite do campo atingido.');
  renderHud();
  return ok;
}
const {camera,screenPoint,screenToWorld,clientToWorld,fitCamera,zoomAt,updateCamera}=createCamera(
  canvas,{...BOARD,get columns(){return displayedBattle()?.columns||10;}},()=>screen,()=>({
    top:$('phase-label').closest('.top-hud').getBoundingClientRect().height+22,
    bottom:$('shop-slots').closest('.bottom-hud').getBoundingClientRect().height+24
  }),()=>!!pan
);
function cellAtClient(x,y) {const p=clientToWorld(x,y);return cellAtWorld(p.x,p.y);}
function hitUnit(world,exclude=null) {
  let best=null;
  let nearest=38;
  const battle=displayedBattle();
  if(battle&&battle.phase!=='finished') {
    for(const unit of battle.units.filter(u=>!u.dead)) {
      const d=Math.hypot(world.x-unit.x,world.y-unit.y+15);
      if(d<nearest) {best={instanceId:unit.uid,combatUnit:true};nearest=d;}
    }
  }
  const inventory=battle&&battle.phase!=='finished'?observedParticipant()?.bench.filter(Boolean)||[]:allUnits();
  for(const mon of inventory) {
    if(mon===exclude)continue;
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
  const area=$('shop-sale-area'),unit=drag?.mon||drag?.structure;
  area.hidden=!selling;
  area.textContent=selling?`VENDER${unit?` · +${unit.kind==='structure'?unit.purchaseCost:saleValueLocal(unit)} ouro`:''}`:'';
  if(!selling)$('shop-offers').classList.remove('sell-hover');
}
function overShopSale(x,y) {
  const rect=$('shop-offers').getBoundingClientRect();
  return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
}
function updateSellHover(x,y) {
  $('shop-offers').classList.toggle('sell-hover',overShopSale(x,y));
}
canvas.addEventListener('pointerdown',e=>{
  if(!localMatch)return;
  const p=screenPoint(e.clientX,e.clientY);
  if(e.button===2&&!spaceDown&&!e.shiftKey){
    const world=screenToWorld(p);
    if(observedId===localMatch.ownerId&&!drag)moveLocalAvatar(localMatch,humanParticipant(),world.x,world.y);
    e.preventDefault();return;
  }
  if(e.button===1||e.button===2||(spaceDown&&e.button===0)) {
    pan={pointer:e.pointerId,start:p,x:camera.x,y:camera.y};
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if(e.button!==0)return;
  const worldCell=cellAtClient(e.clientX,e.clientY);
  const clickedMon=hitUnit(screenToWorld(p));
  if(clickedMon) {
    selectedId=clickedMon.instanceId;renderDetails();
    if(!canManage()||clickedMon.combatUnit||(!canEdit()&&benchIndex(clickedMon)===null))return;
  } else if(!canEdit()) {selectedId=null;renderDetails();return;}
  const placed=clickedMon?null:hitPlacedStructure(worldCell);
  if(placed) {
    const item=STRUCTURE_BY_ID[placed.id],world=screenToWorld(p);
    const center={x:BOARD.x+(placed.col+item.size/2)*BOARD.tile,
      y:BOARD.y+(BOARD.playerFieldStart+placed.row+item.size/2)*BOARD.tile};
    drag={kind:'placed-structure',pointer:e.pointerId,structure:placed,id:placed.id,
      grab:{col:worldCell.col-placed.col,row:worldCell.row-BOARD.playerFieldStart-placed.row},
      offset:{x:world.x-center.x,y:world.y-center.y},world:center};
    canvas.setPointerCapture(e.pointerId);
    setShopSellMode(true);
    return;
  }
  const world=screenToWorld(p);
  const mon=hitUnit(world);
  selectedId=mon?.instanceId||null;
  renderDetails();
  if(mon&&canManage()&&!mon.combatUnit) {
    const at=monWorld(mon);
    drag={kind:'unit',pointer:e.pointerId,mon,world:at,offset:{x:world.x-at.x,y:world.y-at.y}};
    canvas.setPointerCapture(e.pointerId);
    setShopSellMode(true);
  }
});
canvas.addEventListener('pointermove',e=>{
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
    updateSellHover(e.clientX,e.clientY);
    return;
  }
  if(drag?.kind==='unit'&&drag.pointer===e.pointerId) {
    drag.world={x:world.x-drag.offset.x,y:world.y-drag.offset.y};
    const target=hitUnit(world,drag.mon);
    drag.feedTarget=canFeedLocalUnit(localMatch,humanParticipant(),drag.mon,target)?target:null;
    updateSellHover(e.clientX,e.clientY);
  }
});
canvas.addEventListener('pointerup',e=>{
  if(pan?.pointer===e.pointerId) {pan=null;return;}
  if(drag?.kind==='placed-structure'&&drag.pointer===e.pointerId){
    const active=drag;drag=null;
    if(overShopSale(e.clientX,e.clientY)){
      sell(active.structure);
    }else{
      const cell=cellAtClient(e.clientX,e.clientY);
      const col=cell?.col-active.grab.col,row=cell?.row-BOARD.playerFieldStart-active.grab.row;
      const ok=cell?.row===BOARD.playerBenchRow?bankStructure(localMatch,humanParticipant(),active.structure,cell.col):movePlacedStructure(localMatch,humanParticipant(),active.structure,col,row);
      if(!ok)showToast('Posição indisponível.');
    }
    setShopSellMode(false);renderHud();return;
  }
  if(drag?.kind!=='unit'||drag.pointer!==e.pointerId)return;
  const active=drag;
  drag=null;
  const overShop=overShopSale(e.clientX,e.clientY);
  setShopSellMode(false);
  if(overShop)sell(active.mon);
  else {
    const target=hitUnit(clientToWorld(e.clientX,e.clientY),active.mon);
    if(canFeedLocalUnit(localMatch,humanParticipant(),active.mon,target)){
      if(feedLocalUnit(localMatch,humanParticipant(),active.mon,target)){
        selectedId=target.instanceId;
        showToast(`${BY_ID[target.speciesId].name}: +${RULES.niveis.porAlimentacao} níveis!`);
      }
      renderHud();
    }else moveUnit(active.mon,cellAtClient(e.clientX,e.clientY));
  }
});
canvas.addEventListener('pointercancel',()=>{drag=null;pan=null;setShopSellMode(false);});
canvas.addEventListener('lostpointercapture',e=>{
  if(drag?.pointer===e.pointerId){drag=null;setShopSellMode(false);}
  if(pan?.pointer===e.pointerId)pan=null;
});
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
    const cell=cellAtClient(e.clientX,e.clientY);
    if(!cell||!purchase(prior.index,cell))showToast('Solte em um campo ou banco livre.');
  }
  setTimeout(()=>{suppressShopClick=false;},0);
});
document.addEventListener('pointercancel',()=>{
  shopPointer=null;ballPointer=null;
  if(drag?.kind==='shop'||drag?.kind==='ball')drag=null;
  suppressShopClick=false;
});
document.addEventListener('pointermove',e=>{
  if(!ballPointer||ballPointer.pointer!==e.pointerId)return;
  drag={kind:'ball',id:ballPointer.id,world:clientToWorld(e.clientX,e.clientY)};
});
document.addEventListener('pointerup',e=>{
  if(!ballPointer||ballPointer.pointer!==e.pointerId)return;
  const prior=ballPointer;ballPointer=null;
  drag=null;
  const unit=hitUnit(clientToWorld(e.clientX,e.clientY));
  const result=cloneLocalPokemon(localMatch,humanParticipant(),prior.id,unit);
  showToast(result?result.success?'Clonagem bem-sucedida!':'A clonagem falhou.':'Alvo inelegível ou banco cheio. Item preservado.');
  if(result&&unit){const p=monWorld(unit);cloneVisual={...p,success:result.success,until:visualTime+1.2};}
  renderHud();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(screenPoint(e.clientX,e.clientY),e.deltaY<0?1.12:.89);},{passive:false});
window.addEventListener('keydown',e=>{
  if(e.target.closest?.('input,select,textarea'))return;
  if(e.code==='Space')spaceDown=true;
  if(canEdit()&&(e.key==='Delete'||e.key==='Backspace'))sell(selectedMon());
});
window.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false;});

function renderHud() {
  const player=humanParticipant();
  const observed=observedParticipant();
  const managing=canManage();
  $('match-panel').hidden=!localMatch;
  $('environment-panel').hidden=!localMatch;
  $('shop-rarity-odds').hidden=!localMatch;
  $('compass-widget').hidden=!localMatch;
  $('lock-shop').hidden=!localMatch;
  $('hp-stat').hidden=!localMatch;
  $('alive-stat').hidden=!localMatch;
  $('timer-stat').hidden=!localMatch;
  $('round-label').textContent=`${localMatch?.chapter||1}-${localMatch?.stage||1}`;
  $('chapter-name').textContent=`Capítulo ${localMatch?.chapter||1}`;
  $('stage-name').textContent=STAGE_NAMES[battleKind(localMatch?.round||1)];
  $('limit-label').textContent=`${observed?.board.length||0}/${fieldLimitForBattle(localMatch?.round||1)}`;
  $('gold-label').textContent=player?.gold??9;
  $('shop-gold-value').textContent=player?.gold??9;
  $('hp-label').textContent=observed?.hp??100;
  $('alive-label').textContent=localMatch?`${aliveCount(localMatch)}/${localMatch.players.length}`:'—';
  $('timer-label').textContent=localMatch?`${phaseRemainingSeconds(localMatch,performance.now()/1000)}s`:'30s';
  $('phase-label').textContent=localMatch?.phase==='intro'?'Entrada':localMatch?.phase==='combat'?'Combate':localMatch?.phase==='result'?'Resultado':localMatch?.phase==='finished'?'Fim de partida':'Preparação';
  $('reroll-shop').disabled=!managing||player.shopLocked||player.gold<RULES.rerollCostGold;
  $('lock-shop').disabled=!managing;
  $('lock-shop').setAttribute('aria-label',player?.shopLocked?'Destravar loja':'Travar loja');
  $('lock-shop').title=player?.shopLocked?'Destravar loja':'Travar loja';
  $('lock-shop').querySelector('path').setAttribute('d',player?.shopLocked?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 7-2');
  $('lock-shop').setAttribute('aria-pressed',String(!!player?.shopLocked));
  renderEnvironment();
  renderChapterControls();
  $('match-players').replaceChildren();
  if(localMatch) {
    $('match-id-label').textContent=`${aliveCount(localMatch)}/${localMatch.players.length} vivos`;
    const combat=observedCombat();
    $('match-panel-note').textContent=localMatch.phase==='intro'?'Entrada dos adversários · 3 segundos.':localMatch.phase==='combat'?
      combat?.status==='running'?'Combate local em andamento.':'Confronto encerrado.':
      localMatch.phase==='finished'?'Partida local encerrada.':localMatch.phase==='result'?'Clique direito para mover e recolher espólios.':'Monte sua equipe durante a preparação.';
    if(combat){
      const teams=combat.members.map((m,i)=>`E${i+1}: ${m.name||(m.pve?'PvE':'Equipe')}`);
      const ranking=combat.result?.ranking.map((id,i)=>`${i+1}º ${combat.members.find(m=>m.id===id)?.name||'PvE'}`);
      $('match-panel-note').textContent+=` ${ranking?ranking.join(' · '):teams.join(' · ')}`;
    }
    $('back-own-arena').hidden=observedId===localMatch.ownerId;
    $('observed-label').textContent=observed?.isBot?`Visitando ${observed.name}`:'Sua arena';
    for(const participant of localMatch.players.slice().sort((a,b)=>b.hp-a.hp)) {
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
  renderDamageRanking();
}
let synergySignature='';
let cloneVisual=null;
let consumableSignature='';
const stageIcons={normal:'⚔',gold:'◉',pve:'♙',double:'ϟ',quadruple:'⚔',legendary:'♛'};
function renderChapterControls(){
  const player=humanParticipant();
  if(!player)return;
  const chapter=localMatch.chapter;
  $('chapter-progress').innerHTML=STAGES.map((kind,i)=>{
    const round=(chapter-1)*10+i+1,result=player.history.find(h=>h.round===round);
    const state=result?result.result:localMatch.stage===i+1?'current':'future';
    const label=result?({win:'vitória',loss:'derrota',neutral:'neutro'}[result.result])+(result.place?` · ${result.place}º`:''):'aguardando';
    return `<span class="stage-mark ${state} stage-${kind}" title="${chapter}-${i+1}: ${STAGE_NAMES[kind]} · ${label}" aria-label="${chapter}-${i+1}: ${STAGE_NAMES[kind]} · ${label}">${stageIcons[kind]}</span>`;
  }).join('');
  $('economy-bonuses').innerHTML=`<span title="Juros previstos: +${interestForGold(player.gold)}. Um por 10 ouros, máximo 3; saldo antes da renda.">◉ ${interestForGold(player.gold)}</span><span title="Vitória concede +1 ouro, além da renda básica de 5.">⚑ +1</span><span title="Sequência de ${player.streak.result==='win'?'vitórias':player.streak.result==='loss'?'derrotas':'resultados'}: ${player.streak.count}. Bônus a partir do terceiro resultado, máximo 3. Neutros preservam a sequência.">${player.streak.result==='loss'?'↓':'↑'} +${streakBonus(player.streak.count)}</span>`;
  $('next-income').textContent=`+${RULES.baseRoundGold+RULES.victoryBonusGold+interestForGold(player.gold)+streakBonus(player.streak.count)}`;
  const event=battleKind(localMatch.round);
  const showSpecial=localMatch.phase==='preparation'&&observedId===localMatch.ownerId&&!player.eliminated&&specialDismissedRound!==localMatch.round&&((event==='gold'&&!player.bet)||event==='pve');
  $('special-overlay').hidden=!showSpecial;
  $('special-title').textContent=event==='gold'?'Aposte no resultado':event==='pve'?'Escolha seu desafio':'';
  $('special-description').textContent=event==='gold'?'Preveja sua vitória ou derrota e aposte de 1 a 5 ouros. Acertar dobra o valor.':'Defina a dificuldade dos inimigos desta batalha PvE. A recompensa aumenta conforme o desafio.';
  $('bet-controls').hidden=event!=='gold';
  const bet=player.bet,editable=canEdit()&&!bet;
  $('bet-prediction').disabled=!editable;$('bet-amount').disabled=!editable;
  $('bet-amount').max=String(Math.min(5,player.gold));
  $('confirm-bet').disabled=!editable||player.gold<1;
  $('bet-status').textContent=bet?`${bet.amount} ouro · ${bet.prediction==='win'?'vitória':'derrota'}${bet.settled?' · liquidada':''}`:'Aposta opcional: 1–5 ouros';
  $('pve-controls').hidden=battleKind(localMatch.round)!=='pve';
  $('pve-difficulty').disabled=!canEdit();$('pve-difficulty').value=player.pveDifficulty;
  $('pve-budget').textContent=`${chapter+PVE_DIFFICULTIES[player.pveDifficulty].points} pontos de espólio na vitória`;
  $('pve-controls').querySelectorAll('[data-difficulty]').forEach(button=>button.classList.toggle('selected',button.dataset.difficulty===player.pveDifficulty));
  $('pending-rewards').textContent=player.pendingRewards.length?`${player.pendingRewards.length} Pokémon aguardando espaço no banco`:'';
  const signature=`${canEdit()}:${player.consumables.join(',')}`;
  if(signature!==consumableSignature){
    consumableSignature=signature;
    $('consumables').innerHTML=Object.entries(BALLS).map(([id,ball])=>{
      const count=player.consumables.filter(b=>b===id).length;
      return count?`<button class="ball-item ${id}" data-ball="${id}" type="button" ${canEdit()?'':'disabled'} title="${ball.name}: arraste sobre um Pokémon seu. Míticos e lendários são inelegíveis."><img src="${base}assets/pokebolas/${BALL_ASSETS[id]}.png" alt="${ball.name}" /><small>${count}</small></button>`:'';
    }).join('');
    $('consumables').querySelectorAll('button').forEach(button=>button.addEventListener('pointerdown',e=>{
      if(e.button===0&&canEdit()){e.preventDefault();ballPointer={id:button.dataset.ball,pointer:e.pointerId};}
    }));
  }
}
// O dano ao treinador é mostrado como energia, sem deslocar ou atacar fisicamente o treinador.
function damageVisualUnit(unit){return unit;}
function drawBall(id,x,y,size) {
  const image=ballImages.get(id);
  if(!image?.complete||!image.naturalWidth)return;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,x-size/2,y-size/2,size,size);ctx.restore();
}
// GIFs ficam no DOM para manter suas animações nativas, acompanhando a câmera.
function renderTrainers() {
  const layer=$('trainer-layer'),player=observedParticipant();
  layer.hidden=!localMatch||!player||document.querySelector('.game-shell').dataset.mode!=='local';
  if(layer.hidden)return;
  const combat=observedCombat(),visible=new Set();
  const elapsed=performance.now()/1000-localMatch.phaseStartedAt;
  const trainers=[{member:player,position:player.avatar,own:true}];
  if(displayedBattle())combat?.members.forEach((member,team)=>{
    if(member.id===player.id||member.pve)return;
    const position={x:BOARD.x+BOARD.tile*(team>=2?15:5),
      y:BOARD.y+BOARD.tile*((team===0||team===2)?11.5:.5)};
    trainers.push({member,position,own:false});
  });
  for(const {member,position,own} of trainers){
    const key=member.id;visible.add(key);
    let image=trainerImages.get(key);
    if(!image){image=document.createElement('img');image.alt='';image.draggable=false;
      image.className='trainer-sprite';layer.append(image);trainerImages.set(key,image);}
    const index=localMatch.players.findIndex(p=>p.id===(member.sourceId||member.id));
    const trainer=TRAINERS[Math.max(0,index)%TRAINERS.length];
    const dx=own?position.targetX-position.x:0,dy=own?position.targetY-position.y:0;
    const walking=Math.hypot(dx,dy)>.5;
    const direction=walking?(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')):
      trainerDirections.get(key)||(own?'up':'down');
    trainerDirections.set(key,direction);
    const damaged=(combat?.result?.outcomes?.[member.id]?.damage||0)>0;
    const summoning=own&&(summonEffects.some(effect=>visualTime-effect.time<.95)||
      (returnAnimation?.playerId===observedId&&visualTime-returnAnimation.time<.9&&returnAnimation.units.some(unit=>unit.dead)));
    const action=localMatch.phase==='result'&&damaged&&elapsed>=1.52?'hit':
      (localMatch.phase==='intro'&&elapsed<1.5)||summoning?'throw':
      `${walking?'walk':'idle'}_${direction}`;
    const asset=`${trainer}/${action}`;
    if(image.dataset.asset!==asset){image.dataset.asset=asset;
      image.src=`${base}assets/treinadores/${asset}.${action.startsWith('idle')?'png':'gif'}`;}
    const width=(action==='throw'?64:32)*camera.scale,height=64*camera.scale;
    image.style.width=`${width}px`;image.style.height=`${height}px`;
    image.style.left=`${camera.x+position.x*camera.scale-width/2}px`;
    image.style.top=`${camera.y+position.y*camera.scale-height}px`;
  }
  for(const [key,image] of trainerImages)if(!visible.has(key)){
    image.remove();trainerImages.delete(key);trainerDirections.delete(key);
  }
}
function trainerAttackTarget(){
  const combat=observedCombat(),battle=combat?.battle;
  if(!combat?.result||!battle)return null;
  const outcome=combat.result.outcomes?.[observedId];
  const hasDamage=Object.values(combat.result.outcomes||{}).some(o=>o.damage>0);
  if(!hasDamage)return null;
  return (outcome?.damage||0)>0 ? observedParticipant()?.avatar
    : {x:BOARD.x+(battle.columns||10)*BOARD.tile*.5,y:BOARD.y+BOARD.tile*.5};
}
function drawTrainerEnergy(){
  if(localMatch?.phase!=='result')return;
  const battle=observedCombat()?.battle,target=trainerAttackTarget();
  if(!battle||!target||battle.winner===null)return;
  const winners=battle.units.filter(u=>!u.dead&&u.team===battle.winner);
  const elapsed=performance.now()/1000-localMatch.phaseStartedAt;
  // Ataque real contra o treinador: os Pokémon executam a animação de tiro
  // e, em seguida, projéteis individuais percorrem um arco até o alvo.
  winners.forEach((unit,i)=>{
    const start=.52+i*.075,duration=.94;
    const step=clamp((elapsed-start)/duration,0,1);
    if(elapsed<start||elapsed>start+duration+.32)return;
    const attack=MOVES_BY_ID[unit.activeMoves[0]],color=attack?.color||'#e4f9ff';
    const sx=unit.x,sy=unit.y-25,tx=target.x,ty=target.y-25;
    const position=t=>({
      x:sx+(tx-sx)*t,
      y:sy+(ty-sy)*t-Math.sin(t*Math.PI)*52
    });
    if(step<1){
      const head=position(step),tail=position(Math.max(0,step-.085));
      ctx.save();ctx.globalCompositeOperation='lighter';
      const glow=ctx.createRadialGradient(head.x,head.y,1,head.x,head.y,21);
      glow.addColorStop(0,'#ffffffbb');glow.addColorStop(.36,color+'bb');glow.addColorStop(1,'#ffffff00');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(head.x,head.y,21,0,TAU);ctx.fill();
      ctx.strokeStyle=color;ctx.lineWidth=5;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(head.x,head.y);ctx.stroke();
      ellipse(head.x,head.y,7,7,'#ecfcff');ctx.restore();
    }else{
      const fade=clamp((elapsed-start-duration)/.32,0,1);
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-fade;
      ctx.strokeStyle=color;ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(tx,ty,9+28*fade,0,TAU);ctx.stroke();
      ellipse(tx,ty,12*(1-fade)+2,12*(1-fade)+2,'#c4f8ff');ctx.restore();
    }
  });
}
function drawAvatarAndLoot(){
  const player=observedParticipant();if(!player)return;
  for(const loot of player.loot){
    const size={gray:11,blue:14,yellow:18}[loot.color],color={gray:'#dce7f3',blue:'#69b7ff',yellow:'#ffcf54'}[loot.color];
    const pulse=1+Math.sin(visualTime*3+loot.x*.05)*.06;
    ctx.save();ctx.translate(loot.x,loot.y-12+Math.sin(visualTime*2+loot.y)*3);ctx.scale(pulse,pulse);
    ctx.shadowBlur=loot.color==='yellow'?27:19;ctx.shadowColor=color;
    const glow=ctx.createRadialGradient(-size*.35,-size*.5,1,0,0,size);
    glow.addColorStop(0,'#fffef1');glow.addColorStop(.33,color);glow.addColorStop(.8,loot.color==='gray'?'#677c8f':loot.color==='blue'?'#2565ae':'#a16d0f');glow.addColorStop(1,'#172d3c');
    ctx.beginPath();ctx.arc(0,0,size,0,TAU);ctx.fillStyle=glow;ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle='#fff9c4b8';ctx.lineWidth=1.4;ctx.stroke();
    ctx.strokeStyle='#ffffffaa';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(-1,-1,size*.67,3.7,5.65);ctx.stroke();
    ctx.font=`900 ${size*.83}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fffad3';ctx.fillText('✦',0,1);
    ctx.restore();
    ellipse(loot.x,loot.y+size*.55,size*.84,3,'#071b1c66');
  }
  const a=player.avatar;
  ellipse(a.x,a.y+5,16,6,'#102d2266');
  ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff1bd';ctx.fillText(`${player.hp} HP`,a.x,a.y-70);
  const damage=observedCombat()?.result?.outcomes?.[observedId]?.damage;
  if(localMatch.phase==='result'&&damage){
    ctx.fillStyle='#ff7777';ctx.font='bold 22px system-ui';ctx.fillText(`−${damage}`,a.x,a.y-90);
  }
  if(drag?.kind==='ball'){
    drawBall(drag.id,drag.world.x,drag.world.y,32);
  }
  if(cloneVisual&&visualTime<cloneVisual.until){
    ctx.strokeStyle=cloneVisual.success?'#89f8b1':'#ff8282';ctx.lineWidth=4;ctx.beginPath();ctx.arc(cloneVisual.x,cloneVisual.y-15,20+(1.2-cloneVisual.until+visualTime)*28,0,TAU);ctx.stroke();
  }
}
let damageSignature='';
function renderDamageRanking() {
  $('damage-panel').hidden=!localMatch;
  const report=humanParticipant()?.lastRoundDamage;
  const signature=JSON.stringify(report||null);
  if(signature===damageSignature)return;
  damageSignature=signature;
  $('damage-round').textContent=report?`Fase ${chapterForBattle(report.round)}-${stageForBattle(report.round)}`:'Última fase';
  const rows=(report?.units||[]).slice().sort((a,b)=>b.damage-a.damage);
  const peak=Math.max(1,...rows.map(row=>row.damage));
  $('damage-ranking').replaceChildren();
  if(!rows.length){$('damage-ranking').textContent=report?'Sem dano nesta fase.':'Conclua uma fase para ver o dano.';return;}
  for(const [index,row] of rows.entries()) {
    const species=BY_ID[row.speciesId];if(!species)continue;
    const item=document.createElement('div');item.className='damage-row';
    item.innerHTML=`<span class="damage-position">${index+1}</span><canvas width="40" height="40" aria-hidden="true"></canvas><div><div class="damage-name"><b>${species.name}</b><strong>${Math.round(row.damage).toLocaleString('pt-BR')}</strong></div><span class="damage-bar"><i style="width:${row.damage/peak*100}%;background:${RARITY_COLORS[species.rarity]}"></i></span></div>`;
    $('damage-ranking').append(item);drawPortrait(item.querySelector('canvas'),species);
  }
}
function hideTypeTooltip() { $('type-tooltip').hidden=true; }
function showTypeTooltip(row,entry,text) {
  const tooltip=$('type-tooltip');
  tooltip.replaceChildren();tooltip.style.setProperty('--type-color',TYPE_COLORS[entry.type]);
  const heading=document.createElement('div');heading.className='type-tooltip-heading';
  heading.innerHTML=`${typeIcon(entry.type)}<b>${entry.type}</b><strong>${pointsText(entry.score)} <small>pontos</small></strong>`;
  tooltip.append(heading);
  for(const note of [text,...entry.extra]) {const p=document.createElement('p');p.textContent=note;tooltip.append(p);}
  tooltip.hidden=false;
  const rect=row.getBoundingClientRect();
  tooltip.style.left=`${Math.max(8,Math.min(rect.right+12,screen.w-tooltip.offsetWidth-8))}px`;
  tooltip.style.top=`${Math.max(8,Math.min(rect.top,screen.h-tooltip.offsetHeight-8))}px`;
}
const TYPE_COLORS={Normal:'#a7a794',Lutador:'#d17e57',Voador:'#aabde4',Venenoso:'#b783bf',Terrestre:'#c59c62',Pedra:'#a69c87',Inseto:'#a9c46a',Fantasma:'#8575be',Aço:'#a5bac2',Fogo:'#f28a54',Água:'#60b5e3',Grama:'#80ca73',Elétrico:'#f2d868',Psíquico:'#e894be',Gelo:'#a4e3ee',Dragão:'#7881d6',Sombrio:'#7c8195',Fada:'#f1a5cf'};
const pointsText=value=>Number(value.toFixed(1)).toLocaleString('pt-BR');
const percentText=value=>Number(value.toFixed(2)).toLocaleString('pt-BR');
const STAT_LABELS={vida:'vida',atk:'ataque físico',def:'defesa física',spa:'ataque especial',spd:'defesa especial',vel:'velocidade',attackSpeed:'velocidade de ataque',defenses:'defesas física e especial'};
function renderCompass(player,compass) {
  const signature=`${player.id}:${ALL_TYPES.map(type=>compass[type].toFixed(3)).join(':')}`;
  if(signature===compassSignature)return;
  compassSignature=signature;
  const entries=ALL_TYPES.map(type=>({type,score:compass[type]||0})).filter(e=>e.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
  const total=entries.reduce((sum,e)=>sum+e.score,0);
  let angle=0;
  const icons=[];
  const segments=entries.map((entry,i)=>{
    const from=angle;
    angle=i===entries.length-1?360:angle+entry.score/total*360;
    const midpoint=(from+angle)/2*Math.PI/180;
    const x=50+Math.sin(midpoint)*34,y=50-Math.cos(midpoint)*34;
    const size=Math.max(12,Math.min(28,(angle-from)*.5));
    icons.push(`<span class="compass-slice-icon" style="left:${x}%;top:${y}%;width:${size}px;height:${size*.4375}px">${typeIcon(entry.type)}</span>`);
    return `${TYPE_COLORS[entry.type]} ${from}deg ${angle}deg`;
  });
  $('compass-ring').style.background=segments.length?`conic-gradient(${segments.join(',')})`:'#667b72';
  $('compass-icons').innerHTML=icons.join('');
  $('compass-widget').setAttribute('aria-label',entries.length?`Pontos da bússola: ${entries.map(e=>`${e.type} ${pointsText(e.score)}`).join(', ')}`:'Bússola neutra');
}
function renderEnvironment() {
  const player=observedParticipant();
  if(!player||!localMatch)return;
  const compass=calculateCompass(player);
  renderCompass(player,compass);
  const battle=displayedBattle();
  const effects=fieldEffects({structures:battle?battle.environment.flatMap(side=>side.structures||[]):player.structures});
  const signature=JSON.stringify([player.id,compass,effects]);
  if(signature===synergySignature)return;
  synergySignature=signature;
  hideTypeTooltip();
  const entries=ALL_TYPES.map(type=>{
    const score=compass[type]||0;
    const extra=effects.filter(e=>e.type===type).map(e=>{
      const bonus=e.stat==='regen'?`${percentText(e.bonus*100)}% de vida por segundo`:`+${percentText(e.bonus*100)}% de ${STAT_LABELS[e.stat]||e.stat}`;
      return `${e.sources.join(', ')}: ${bonus}. Efeito 1,5× perto da estrutura, respeitando os limites de 12% por atributo e 1,2% de regeneração por segundo.`;
    });
    return {type,score,extra};
  }).filter(e=>e.score>0||e.extra.length).sort((a,b)=>b.score-a.score);
  $('environment-effects').replaceChildren();
  for(const entry of entries){
    const row=document.createElement('button');
    row.type='button';row.className='synergy-row';
    row.style.setProperty('--type-color',TYPE_COLORS[entry.type]);
    const text=`O tipo ${entry.type} tem ${pointsText(entry.score)} pontos de vantagem da bússola.`;
    row.setAttribute('aria-label',[text,...entry.extra].join('\n\n'));
    row.innerHTML=`${typeIcon(entry.type)}<b>${pointsText(entry.score)}</b>${entry.extra.length?'<span class="synergy-bonus" aria-hidden="true">✦</span>':''}`;
    const show=()=>showTypeTooltip(row,entry,text);
    row.addEventListener('pointerenter',show);row.addEventListener('focus',show);
    row.addEventListener('pointerleave',hideTypeTooltip);row.addEventListener('blur',hideTypeTooltip);
    $('environment-effects').append(row);
  }
  if(!entries.length)$('environment-effects').textContent='Nenhum tipo ativo';
}
function previewUnitStats(mon,p){
  if(mon.liveStats)return mon.liveStats;
  const baseStats=effectiveUnitStats(p,mon);
  const member=observedParticipant();
  if(!member||benchIndex(mon)!==null)return baseStats;
  const pos=monWorld(mon);
  const mods=structureModifiers([{structures:member.structures}],{type:p,x:pos.x,y:pos.y});
  return applyStructureStats(baseStats,mods);
}
const STAT_NAMES={vida:'Vida',atk:'Ataque',def:'Defesa',spa:'Ataque especial',spd:'Defesa especial',vel:'Velocidade',energia:'Energia/s',regeneracao:'Regeneração/s'};
// Vetores locais, sem emojis nem URLs remotas. Ícones na ordem dos oito atributos.
const STAT_ICONS={
  vida:'M12 21s-8-5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6-8 11-8 11Z',
  atk:'M5 19 19 5M14 5l5 5M4 16l4 4m0-5 3 3',
  def:'M12 2 4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5Z',
  spa:'M12 2 9 12h-6l-3 10-1-8H3Z',
  spd:'M12 2 4 8v5c0 4 4 7 8 9 4-2 8-5 8-9V8Zm0 5-2 5h4l-2 5',
  vel:'M3 12h10m-6-5h10M3 17h8m5-7 5 2-5 2',
  energia:'M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3m-8 8-3 3M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  regeneracao:'M12 3a9 9 0 1 0 9 9m0-7v7h-7M12 7v10m-5-5h10'
};
const statIcon=key=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${STAT_ICONS[key]}"></path></svg>`;
const formatStat=(key,n)=>['energia','regeneracao'].includes(key)?Number(n).toLocaleString('pt-BR',{maximumFractionDigits:3}):Math.round(n).toLocaleString('pt-BR');
function renderDetails() {
  const mon=selectedMon();
  $('detail-panel').classList.toggle('collapsed',!mon||mon.kind==='structure');
  if(!mon||mon.kind==='structure')return;
  const p=BY_ID[mon.speciesId];if(!p)return;
  const stats=previewUnitStats(mon,p),ivs=individualIVs(mon);
  $('selected-number').textContent=`#${String(p.number).padStart(3,'0')}`;
  $('selected-name').textContent=p.name;
  $('selected-type').innerHTML=`${p.types.map(typeIcon).join('')} <small>${RARITY_LABELS[p.rarity]}</small>`;
  $('selected-level').textContent=Math.round(mon.level||0);
  $('selected-iv').textContent=mon.bossIv>100?`${mon.bossIv}% (chefe)`:`${meanIV(mon).toFixed(1).replace('.',',')}%`;
  $('selected-power').textContent=combatPower(stats).toLocaleString('pt-BR');
  const slot=benchIndex(mon);
  $('selected-place').textContent=mon.combatUnit?'Em combate':slot!==null?`Banco ${slot+1}`:'No campo';
  $('sell-value').textContent=`Venda: ${saleValueLocal(mon)} ouro`;
  drawPortrait($('selected-avatar'),p);
  $('stats-list').innerHTML=keys.map(key=>`<div class="stat" title="${STAT_NAMES[key]}">
    <span class="stat-title">${statIcon(key)}<span>${STAT_NAMES[key]}</span></span>
    <small>${ivs[key].toFixed(0)}%</small><b>${formatStat(key,stats[key]??0)}</b>
  </div>`).join('');
  const ability=mon.abilityId?String(mon.abilityId):'Sem habilidade ativa';
  $('ability-status').innerHTML=`<span class="ability-name" tabindex="0" title="Habilidade única fixa; nenhuma habilidade ativa está configurada nesta versão.">${ability}</span>`;
  $('moves-active').innerHTML=(mon.activeMoves||[]).slice(0,2).map((id,i)=>{
    const move=MOVES_BY_ID[id];if(!move)return '';
    const tooltipId=`move-description-${i}`;
    const details=[`Categoria: ${move.category==='atk'?'Físico':'Especial'}`,`Tipo: ${move.type}`,
      `Dano: ${move.damage}`,`Alcance: ${move.range} células`,
      ...(i?[`Energia: ${move.energyCost}`]:[]),`Efeito: ${move.effect}`,move.description];
    return `<div class="move-row"><div class="move-card"><button type="button" class="move-help" aria-describedby="${tooltipId}" aria-label="Detalhes de ${move.name}">${move.name}</button>
      <div class="move-tooltip" id="${tooltipId}" role="tooltip">${details.map(text=>`<span>${text}</span>`).join('')}</div></div>
      ${i===1?`<button type="button" class="move-reroll" data-slot="1" aria-label="Roletar ataque carregado por ${RULES.moveChangeCostGold} de ouro" title="Roletar outro golpe carregado">↻ ${RULES.moveChangeCostGold}</button>`:''}</div>`;
  }).join('');
  $('moves-active').querySelectorAll('.move-reroll').forEach(btn=>{
    btn.disabled=!canEdit()||!ownsUnit(mon)||humanParticipant().gold<RULES.moveChangeCostGold;
    btn.addEventListener('click',()=>{
      if(changeLocalMove(localMatch,humanParticipant(),mon,Number(btn.dataset.slot),Math.random)){
        renderHud();showToast('Novo ataque carregado sorteado.');
      }
    });
  });
  $('sell-selected').disabled=!canManage()||!ownsUnit(mon)||!!mon.combatUnit;
}

function renderShop() {
  const player=humanParticipant();
  const offers=currentShop();
  const editable=canManage();
  const kinds=player?.shopKinds||[];
  if(localMatch) {
    const odds=shopOddsForBattle(localMatch.round);
    $('shop-rarity-odds').innerHTML=Object.keys(RARITY_COLORS).map((rarity,i)=>`<span class="rarity-odd" style="--rarity:${RARITY_COLORS[rarity]}" title="${RARITY_LABELS[rarity]}"><i class="rarity-dot"></i>${RARITY_LABELS[rarity]} <b>${odds[i].toLocaleString('pt-BR')}%</b></span>`).join('');
  }
  const signature=`${editable}:${offers.join(',')}:${kinds.join(',')}:${player?.gold}:${player?.bench.filter(Boolean).length}`;
  if(signature===shopSignature)return;
  shopSignature=signature;
  $('shop-slots').innerHTML=Array.from({length:RULES.shopSlots},(_,i)=>{
    const id=offers[i];
    if(kinds[i]==='estrutura' && STRUCTURE_BY_ID[id]) {
      const def=STRUCTURE_BY_ID[id];
      const fullStacks=player.bench.every(Boolean);
      return `<button type="button" class="shop-card structure-offer rarity-${def.rarity}" style="--rarity:${def.rarity==='lendaria'?'#ffda52':def.rarity==='rara'?'#5aa5ff':'#9ca3af'}" data-index="${i}" ${!editable||player.gold<def.price||fullStacks?'disabled':''} title="${def.name}, ${def.size}×${def.size}"><span class="shop-portrait"><canvas class="structure-preview" width="100" height="92" aria-hidden="true"></canvas></span><span class="shop-footer"><b>${def.name}</b><span class="shop-price">${coinSvg}<span>${def.price}</span></span></span></button>`;
    }
    if(!id) {
      const waiting='Vazio';
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
      if(e.button!==0||!canManage())return;
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
// Arte vetorial do cenário compartilhada entre arena, loja e ferramentas.
const structureDrawings=new Map();
function artEllipse(c,x,y,rx,ry,fill){
  c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();
}
function artPath(c,points,fill,stroke='#263d3b',width=2){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}
}
function artLine(c,points,color,width=2){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
}
function structureArt(item){
  if(structureDrawings.has(item.id))return structureDrawings.get(item.id);
  const image=document.createElement('canvas');image.width=96;image.height=96;
  const c=image.getContext('2d');c.translate(48,48);
  const accent=TYPE_COLORS[item.type],edge='#263d3b',ivory='#e3e6ce';
  artEllipse(c,0,33,34,9,'#0c232838');
  artPath(c,[[-30,22],[0,13],[30,22],[30,29],[0,38],[-30,29]],'#607a70',edge);
  artPath(c,[[-30,22],[0,13],[30,22],[0,31]],'#adbc99',edge);
  const stone=(x,y,size=1)=>{
    c.save();c.translate(x,y);c.scale(size,size);
    artPath(c,[[-19,12],[-22,-6],[-8,-20],[13,-16],[22,4],[14,15]],'#738b85');
    artPath(c,[[-22,-6],[-8,-20],[2,-7],[-7,5]],'#b9c8b1',null);
    artLine(c,[[2,-7],[13,-16],[21,4]],'#d3d9bf',1.5);c.restore();
  };
  const tree=ancient=>{
    artPath(c,[[-8,25],[-5,-12],[5,-12],[9,25]],'#94724d');
    artLine(c,[[0,20],[0,-8]],'#c9a471',2);
    for(const [x,y,r] of [[-17,-9,17],[16,-13,17],[0,-26,20]]){
      artEllipse(c,x,y,r,r*.82,ancient?'#4a7d69':'#659460');
      artEllipse(c,x-4,y-5,r*.55,r*.35,'#b0ca83');
    }
    if(ancient)for(const [x,y] of [[-15,-13],[11,-27],[18,-8]])artEllipse(c,x,y,2.5,3,'#f3dea0');
  };
  const fountain=()=>{
    artEllipse(c,0,19,24,8,'#668c99');artEllipse(c,0,16,20,5,'#90d2d1');
    artPath(c,[[-6,15],[-4,-15],[4,-15],[6,15]],ivory);
    for(const side of [-1,1]){
      c.strokeStyle='#b8f0e1';c.lineWidth=3;c.beginPath();c.moveTo(0,-17);c.quadraticCurveTo(side*21,-32,side*16,13);c.stroke();
    }
    artEllipse(c,0,-18,4,5,'#d8faf0');
  };
  switch(item.id){
    case 'planta':
      artLine(c,[[0,23],[0,-23]],'#436957',4);
      for(const [x,y] of [[-9,7],[9,-3],[-8,-12],[7,-21]]){
        artEllipse(c,x,y,10,5,accent);artLine(c,[[0,y+6],[x,y]],'#b7d499',1.5);
      }break;
    case 'flores':
      for(const [x,y] of [[-15,0],[0,-19],[15,-4]]){
        artLine(c,[[x,23],[x,y]],'#66865e',3);
        for(let i=0;i<5;i++){const a=i*TAU/5;artEllipse(c,x+Math.cos(a)*6,y+Math.sin(a)*6,4,4,accent);}
        artEllipse(c,x,y,3,3,'#f7e6a3');
      }break;
    case 'pedra':stone(0,3);break;
    case 'arvorezinha':tree(false);break;
    case 'arvore-ancestral':tree(true);break;
    case 'cacto':
      artLine(c,[[0,23],[0,-25]],'#568566',11);
      artLine(c,[[0,5],[-16,5],[-16,-10]],'#568566',8);
      artLine(c,[[0,-4],[15,-4],[15,-18]],'#568566',8);
      artLine(c,[[2,19],[2,-20]],'#c2d08b',2);artEllipse(c,0,-26,5,3,'#efb2c2');break;
    case 'antena':
      artPath(c,[[-18,24],[-5,-24],[5,-24],[18,24]],'#82989d');
      for(const y of [-8,5,17])artLine(c,[[-y*.25-7,y],[y*.25+7,y]],'#d7e2d3',2);
      artLine(c,[[0,-24],[0,-34]],ivory,3);artEllipse(c,0,-34,5,5,accent);break;
    case 'fonte':fountain();break;
    case 'colmeia':
      for(const [y,rx] of [[-21,11],[-12,18],[-2,22],[8,20],[17,15]]){
        artEllipse(c,0,y,rx,7,'#8b6e47');artEllipse(c,-1,y-2,rx-1,5,'#d5b972');
      }
      artEllipse(c,2,6,6,7,edge);break;
    case 'cristal-gelo':
      for(const [x,y,h] of [[-15,10,26],[14,14,31],[0,18,52]]){
        artPath(c,[[x-9,y],[x-6,y-h+12],[x,y-h],[x+7,y-h+12],[x+10,y]],accent);
        artPath(c,[[x-6,y-h+12],[x,y-h],[x,y],[x-9,y]],'#daf4ef',null);
      }break;
    case 'braseiro':
      artPath(c,[[-21,9],[21,9],[13,23],[-13,23]],'#8f7c66');
      artPath(c,[[-15,8],[-16,-9],[-7,-3],[-2,-30],[8,-13],[16,-21],[15,8]],accent);
      artPath(c,[[-7,8],[-4,-8],[1,-19],[8,8]],'#ffe4a1',null);break;
    case 'obelisco':
      artPath(c,[[-18,24],[-13,-18],[0,-37],[13,-18],[18,24]],'#73879d');
      artPath(c,[[-13,-18],[0,-37],[0,23],[-18,24]],'#b2c2bb',null);
      artLine(c,[[2,-22],[-3,-8],[5,-8],[0,10]],accent,3);break;
    case 'templo-mares':
      for(const x of [-19,0,19])artPath(c,[[x-4,23],[x-4,-10],[x+4,-10],[x+4,23]],ivory);
      artPath(c,[[-30,-10],[0,-31],[30,-10]],'#a5c5bc');
      artLine(c,[[-26,26],[26,26]],accent,4);
      artEllipse(c,0,-17,4,4,accent);break;
    case 'santuario-glacial':
      artPath(c,[[-26,23],[-26,-7],[0,-34],[26,-7],[26,23]],accent);
      artPath(c,[[-26,-7],[0,-34],[3,-8],[-26,23]],'#e4f3e9',null);
      artPath(c,[[-9,23],[-9,1],[0,-10],[9,1],[9,23]],'#4f778c');
      artLine(c,[[-29,26],[29,26]],ivory,4);break;
  }
  structureDrawings.set(item.id,image);return image;
}
function drawStructureArt(c,item,x,y,w,h){if(item)c.drawImage(structureArt(item),x,y,w,h);}
function drawStructurePreview(canvas,item){
  if(!canvas||!item)return;
  const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
  const size=Math.min(canvas.width,canvas.height);
  drawStructureArt(c,item,(canvas.width-size)/2,(canvas.height-size)/2,size,size);
}
function drawArenaFloor(){
  const columns=displayedBattle()?.columns||10,tile=BOARD.tile;
  const left=BOARD.x,top=BOARD.y,width=columns*tile,height=BOARD.rows*tile;
  ctx.fillStyle='#0b2019';ctx.fillRect(0,0,left+width+110,BOARD.height);
  // Cenário contínuo: não há quadrados visíveis nem desenho por célula.
  ctx.fillStyle='#243c30';ctx.fillRect(left-18,top-18,width+36,height+36);
  ctx.fillStyle='#7d976d';ctx.fillRect(left-10,top-10,width+20,height+20);
  const grass=ctx.createLinearGradient(left,top,left+width,top+height);
  grass.addColorStop(0,'#477d54');grass.addColorStop(.45,'#558f5e');grass.addColorStop(1,'#326d4e');
  ctx.fillStyle=grass;ctx.fillRect(left,top,width,height);
  // Manchas de luz e vegetação com distribuição independente dos tiles.
  for(let i=0;i<55;i++){
    const fx=(Math.sin(i*129.7)*43758.5453)%1;
    const fy=(Math.sin((i+13)*78.23)*17349.31)%1;
    const x=left+Math.abs(fx)*width,y=top+Math.abs(fy)*height;
    const radius=25+(i*37)%78;
    ctx.fillStyle=i%3?'#b7db8510':'#103b3220';
    ctx.beginPath();ctx.ellipse(x,y,radius,radius*.55,i*.23,0,TAU);ctx.fill();
  }
  for(let i=0;i<510;i++){
    const vx=Math.abs(Math.sin(i*42.819)*47443.63)%1;
    const vy=Math.abs(Math.sin(i*17.141)*39713.71)%1;
    const x=left+vx*width,y=top+vy*height;
    const bench=vy<1/12||vy>11/12;
    if(bench)continue;
    ctx.strokeStyle=i%3===0?'#c7e4a125':'#183f3229';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x-2.5,y-2);ctx.moveTo(x,y+2);ctx.lineTo(x+2,y-3);ctx.stroke();
  }
  // Banco integrado ao cenário, com uma única faixa de pedra/ardósia.
  for(const row of [BOARD.enemyBenchRow,BOARD.playerBenchRow]){
    const y=top+row*tile;
    const stone=ctx.createLinearGradient(left,y,left,y+tile);
    stone.addColorStop(0,'#55675c');stone.addColorStop(.5,'#364e48');stone.addColorStop(1,'#233e3a');
    ctx.fillStyle=stone;ctx.fillRect(left,y,width,tile);
    ctx.fillStyle='#acc3ac38';ctx.fillRect(left,y,width,2);
    ctx.fillStyle='#0c2a2555';ctx.fillRect(left,y+tile-4,width,4);
    ctx.strokeStyle='#ffffff0b';ctx.lineWidth=1;
    for(let i=0;i<columns*2;i++){
      const x=left+i*tile/2;
      ctx.beginPath();ctx.moveTo(x+5,y+19+(i%3)*3);ctx.lineTo(x+tile*.4,y+21+(i%3)*3);ctx.stroke();
    }
  }
  // Divisão sutil de território, sem separadores de células.
  const center=top+BOARD.playerFieldStart*tile;
  ctx.fillStyle='#e6e9be38';ctx.fillRect(left,center-1,width,2);
  ctx.fillStyle='#e5edcf80';ctx.font='bold 9px system-ui';ctx.textAlign='left';
  ctx.fillText('RESERVA ADVERSÁRIA',left+9,top+15);
  ctx.fillText('SEU BANCO',left+9,top+height-10);
}
function drawBoard(t) {
  drawArenaFloor();
  if(localMatch){
    const watched=observedParticipant();
    const combat=observedCombat();
    const shown=displayedBattle();
    const running=shown;
    const bottomPlayer=running ? localMatch.players.find(p=>p.id===combat.playerIds[0]) : watched;
    const topPlayer=running ? localMatch.players.find(p=>p.id===combat.playerIds[1]) : null;
    for(const [player,isTop] of [[bottomPlayer,false],[topPlayer,true]]){
      if(!player)continue;
      if(running)continue;
      for(const structure of player.structures||[]){
        if(drag?.kind==='placed-structure'&&drag.structure===structure)continue;
        const item=STRUCTURE_BY_ID[structure.id];if(!item)continue;
        const row=isTop?5-structure.row-(item.size-1):BOARD.playerFieldStart+structure.row;
        const x=BOARD.x+structure.col*BOARD.tile,y=BOARD.y+row*BOARD.tile;
        drawStructureArt(ctx,item,x+1,y+1,BOARD.tile*item.size-2,BOARD.tile*item.size-2);
      }
    }
    if(running)for(const side of running.environment)for(const s of side.structures){
      const def=STRUCTURE_BY_ID[s.id],size=def.size*BOARD.tile;
      drawStructureArt(ctx,def,s.combatX-size/2,s.combatY-size/2,size,size);
    }
  }
  ctx.save();
  const showGrid=canManage()&&!!drag;
  if(showGrid){
    ctx.strokeStyle='rgba(238,255,214,.43)';ctx.lineWidth=1;
    const columns=displayedBattle()?.columns||10;
    for(let col=0;col<=columns;col++)line(BOARD.x+col*BOARD.tile,BOARD.y,BOARD.x+col*BOARD.tile,BOARD.y+BOARD.rows*BOARD.tile,ctx.strokeStyle);
    for(let row=0;row<=BOARD.rows;row++)line(BOARD.x,BOARD.y+row*BOARD.tile,BOARD.x+columns*BOARD.tile,BOARD.y+row*BOARD.tile,ctx.strokeStyle);
  }
  if (hovered && showGrid) {
    const isValid = hovered.row === BOARD.playerBenchRow || validCellForTeam(0, hovered);
    ctx.fillStyle = isValid ? 'rgba(255,245,171,.24)' : 'rgba(255,90,105,.24)';
    ctx.fillRect(BOARD.x + hovered.col * BOARD.tile, BOARD.y + hovered.row * BOARD.tile, BOARD.tile, BOARD.tile);
  }
  ctx.restore();

}
const {unitScale,groundShadow,drawUnitSprite} = createSpriteRenderer(ctx,getImageMeta);

// A bola percorre um arco até a célula; o Pokémon se materializa sem cair.
function drawSummon(x,y,progress,team=0) {
  const p=clamp(progress,0,1);
  if(p<.48) {
    const travel=p/.48;
    ctx.save();ctx.translate(x+(team===1?100:-100)*(1-travel),y-10-Math.sin(travel*Math.PI)*65);
    ctx.rotate(travel*TAU*2);
    drawBall('pokeball',0,0,24);ctx.restore();
    return 0;
  }
  const release=(p-.48)/.52;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(1-release)*.8;
  ellipse(x,y-18,12+release*40,16+release*35,'#b8f6ff');
  for(let i=0;i<8;i++) {
    const a=i*TAU/8,r=12+release*52;
    line(x+Math.cos(a)*r*.6,y-18+Math.sin(a)*r*.6,x+Math.cos(a)*r,y-18+Math.sin(a)*r,'#fff0bd',2);
  }
  ctx.restore();return clamp(release*2.5,0,1);
}

function drawPokemonBars(p,x,y,level,health,maxHp,energy,maxEnergy,team=0) {
  const bw=clamp(32+unitScale(p)*4,35,46),h=6,eh=3;
  const py=y-([0,52,66,85][p.stage]||52);
  const barX=x-bw/2+7;const barW=bw-7;
  const hp=clamp((health??maxHp)/Math.max(1,maxHp),0,1);
  const charge=clamp(energy/Math.max(1,maxEnergy),0,1);
  ctx.save();
  ctx.fillStyle='#061912dc';ctx.beginPath();ctx.roundRect(barX-1,py-1,barW+2,h+eh+4,2);ctx.fill();
  ctx.fillStyle='#1c3227';ctx.fillRect(barX,py,barW,h);
  ctx.fillStyle=hp>.45?'#4bd78a':hp>.22?'#e9cb64':'#e76d76';ctx.fillRect(barX+.5,py+.5,(barW-1)*hp,h-1);
  const ticks=Math.min(14,Math.max(2,Math.round(maxHp/75)));
  ctx.fillStyle='#0919109e';
  for(let i=1;i<ticks;i++)ctx.fillRect(Math.round(barX+barW*i/ticks),py,1,h);
  ctx.fillStyle='#11334f';ctx.fillRect(barX,py+h+1,barW,eh);
  ctx.fillStyle='#50c4ff';ctx.fillRect(barX,py+h+1,barW*charge,eh);
  ctx.strokeStyle=team?'#c9cce088':'#d1fce488';ctx.lineWidth=.6;ctx.strokeRect(barX,py,barW,h);
  const badgeX=barX-6;
  ctx.fillStyle='#142d2c';ctx.beginPath();ctx.roundRect(badgeX-14,py-1,13,h+eh+4,3);ctx.fill();
  ctx.strokeStyle='#9fe0c688';ctx.strokeRect(badgeX-14.5,py-1.5,14,h+eh+5);
  ctx.font='bold 9px system-ui';ctx.fillStyle='#e6fff4';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(String(level||0),badgeX-7.5,py+(h+eh+2)/2,13);
  ctx.restore();
}
function drawSetupUnit(mon) {
  if(mon.kind==='structure'){
    const pos=monWorld(mon);drawStructureArt(ctx,STRUCTURE_BY_ID[mon.id],pos.x-27,pos.y-29,54,54);return;
  }
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
  }
  const arrival=summonEffects.find(effect=>effect.id===mon.instanceId);
  const arrivalProgress=arrival?clamp((visualTime-arrival.time)/.95,0,1):1;
  if(prior?.dead&&progress<1)ctx.globalAlpha=drawSummon(pos.x,pos.y,progress);
  else if(arrivalProgress<1)ctx.globalAlpha=drawSummon(pos.x,pos.y,arrivalProgress);
  groundShadow(p, pos.x, pos.y,drag?.feedTarget===mon?'#5df5bc':selectedId === mon.instanceId ? '#ffe177' : null);
  const resting=benchIndex(mon)!==null && !(drag?.kind==='unit'&&drag.mon===mon);
  drawUnitSprite(p,pos.x,pos.y,resting?'Sleep':'Idle',facing,visualTime);
  const effective=previewUnitStats(mon,p);
  drawPokemonBars(p,pos.x,pos.y,mon.level,mon.health??maxHealth(effective),mon.maxHealth??maxHealth(effective),0,4);
  if(drag?.feedTarget===mon){ctx.fillStyle='#9affcf';ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillText(`+${RULES.niveis.porAlimentacao} níveis`,pos.x,pos.y-90);}
  // O sprite Sleep real é usado quando disponível; as notas são um detalhe
  // visual do banco, sem mexer em colisões nem na animação de combate.
  if(resting){
    const phase=visualTime*1.15+pos.x*.02;
    ctx.save();ctx.font='bold 11px system-ui';ctx.textAlign='center';
    ctx.fillStyle=`rgba(215,246,229,${.36+.20*Math.sin(phase)})`;
    ctx.fillText('z',pos.x+19,pos.y-39-Math.sin(phase)*5);ctx.restore();
  }
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
  const progress=intro?clamp((performance.now()/1000-localMatch.phaseStartedAt-u.col*.025)/1.1,0,1):1;
  ctx.save();
  if(intro&&u.team!==0&&progress<1)ctx.globalAlpha=drawSummon(u.x,u.y,progress,u.team);
  groundShadow(u.type, u.x, u.y, selectedId === u.uid ? (u.team === 0 ? '#70cfff' : '#ffaaa0') : null);
  if (u.hitFlash > 0) ellipse(u.x, u.y - 16, 32, 28, `rgba(255,250,210,${u.hitFlash * 1.9})`);
  const result=localMatch.phase==='result';
  const resultTime=result?performance.now()/1000-localMatch.phaseStartedAt:0;
  const target=result?trainerAttackTarget():null;
  const celebratoryCast=!!target&&u.team===observedCombat()?.battle?.winner&&resultTime<1.03;
  const resultAnimation=celebratoryCast
    ? chooseMoveAnimation(MOVES_BY_ID[u.activeMoves[0]],u.type.sprites) : 'Idle';
  const gotHit=u.hurtTime>0&&!intro&&!result;
  const state=intro?'Idle':result?resultAnimation:gotHit?'Hurt':u.state;
  const facing=intro?(u.team===0?Math.round(progress*4):0)
    :result?(celebratoryCast?getDirection(target.x-u.x,target.y-u.y):0):u.facing;
  const frameTime=gotHit?Math.max(0,.16-u.hurtTime):resultTime;
  drawUnitSprite(u.type,u.x,u.y,state,facing,
    gotHit?frameTime:result?frameTime:u.stateTime,
    gotHit?frameTime:result?Math.max(0,resultTime-.2):u.cast?.elapsed??0,
    gotHit?{hit:true}:result&&celebratoryCast?{result:true}:u.cast);
  drawPokemonBars(u.type,u.x,u.y,u.level,u.health,u.maxHealth,u.energy,u.maxEnergy,u.team);
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
  if (!activeBattle) {
    allUnits().slice().sort((a, b) => monWorld(a).y - monWorld(b).y).forEach(drawSetupUnit);
    if (drag?.kind === 'shop'||drag?.kind === 'placed-structure') drawShopGhost(drag);
    drawEvolutionEffects();
  } else {
    activeBattle.units.filter(u => !u.dead).slice().sort((a, b) => a.y - b.y).forEach(u=>drawBattleUnit(damageVisualUnit(u)));
    if(activeBattle.phase==='fighting')drawEffects(activeBattle);
    drawTrainerEnergy();
    observedParticipant()?.bench.filter(Boolean).forEach(drawSetupUnit);
    if(drag?.kind==='shop')drawShopGhost(drag);
  }
  drawAvatarAndLoot();
  renderTrainers();
}
function frame(timestamp) {
  if(!lastFrame)lastFrame=timestamp;
  const dt=Math.min(.05,(timestamp-lastFrame)/1000);
  lastFrame=timestamp;
  visualTime+=dt;
  updateCamera(dt);
  updateEvolutionEffects(dt);
  for(let i=summonEffects.length-1;i>=0;i--)if(visualTime-summonEffects[i].time>=.95)summonEffects.splice(i,1);
  if(localMatch) {
    const previousBattle=displayedBattle();
    const previousCombat=observedCombat();
    const previousPhase=localMatch.phase;
    const previousRound=localMatch.round;
    updateLocalMatchCycle(localMatch,dt,timestamp/1000);
    if(previousBattle?.phase==='finished'&&localMatch.phase==='preparation'&&lastReturnedBattle!==previousBattle){
      lastReturnedBattle=previousBattle;
      const team=previousCombat.playerIds.indexOf(observedId);
      returnAnimation={playerId:observedId,time:visualTime,units:previousBattle.units.filter(u=>u.team===team).map(u=>({...u}))};
    }
    if(previousPhase!==localMatch.phase||previousRound!==localMatch.round) {
      selectedId=null;
      drag=null;
      shopPointer=null;
      ballPointer=null;
      setShopSellMode(false);
      shopSignature='';
      if((previousBattle?.columns||10)!==(displayedBattle()?.columns||10))fitCamera();
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
  const duration=localMatch?.phaseDeadline-localMatch?.phaseStartedAt;
  const remaining=duration>0?clamp((localMatch.phaseDeadline-timestamp/1000)/duration,0,1):0;
  $('phase-progress-fill').style.transform=`scaleX(${remaining})`;
  $('phase-progress').setAttribute('aria-valuenow',String(Math.round(remaining*100)));
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
function renderRoster(){
  const term=$('roster-search').value.trim().toLocaleLowerCase('pt-BR');
  const rarity=$('roster-rarity').value;
  const parent=new Map();
  for(const [id,evolutions] of Object.entries(EVOLUTION_OPTIONS))for(const evolved of evolutions)if(!parent.has(evolved))parent.set(evolved,id);
  const origin=id=>{const visited=new Set();while(parent.has(id)&&!visited.has(id)){visited.add(id);id=parent.get(id);}return id;};
  const order=new Map(POKEMON.map((p,i)=>[p.id,i]));
  const rootOrder=new Map();
  for(const p of POKEMON){const root=origin(p.id);rootOrder.set(root,Math.min(rootOrder.get(root)??Infinity,order.get(p.id)));}
  const depth=id=>{let n=0;const seen=new Set();while(parent.has(id)&&!seen.has(id)){seen.add(id);id=parent.get(id);n++;}return n;};
  const filtered=POKEMON.filter(p=>(!rarity||p.rarity===rarity)&&(!term||p.name.toLocaleLowerCase('pt-BR').includes(term)||String(p.number).includes(term)))
    .sort((a,b)=>rootOrder.get(origin(a.id))-rootOrder.get(origin(b.id))||depth(a.id)-depth(b.id)||order.get(a.id)-order.get(b.id));
  $('roster-count').textContent=`${filtered.length} Pokémon`;
  $('roster-grid').innerHTML=filtered.map(p=>`<article class="roster-card rarity-${p.rarity}" style="--rarity:${RARITY_COLORS[p.rarity]}"><div class="roster-portrait"><span class="roster-placeholder" aria-hidden="true">◉</span><img src="${base}portraits/${p.id}.png" alt="" loading="lazy" onerror="this.style.display='none'" /><small>#${String(p.number).padStart(3,'0')}</small></div><div class="roster-body"><b>${p.name}</b><span>${p.types.map(type=>typeIcon(type)).join('')}<small>${RARITY_LABELS[p.rarity]}</small></span></div></article>`).join('');
}
$('open-roster').addEventListener('click',()=>{
  $('entry-screen').hidden=true;$('roster-screen').hidden=false;
  document.querySelector('.game-shell').dataset.mode='roster';
  renderRoster();
});
$('close-roster').addEventListener('click',openMenu);
$('roster-search').addEventListener('input',renderRoster);
$('roster-rarity').addEventListener('change',renderRoster);
$('skip-bet').addEventListener('click',()=>{specialDismissedRound=localMatch?.round||-1;renderHud();});
$('confirm-difficulty').addEventListener('click',()=>{if(!canEdit())return;specialDismissedRound=localMatch.round;renderHud();});
$('pve-controls').querySelectorAll('[data-difficulty]').forEach(button=>button.addEventListener('click',()=>{
  if(!canEdit())return;
  const difficulty=button.dataset.difficulty;
  if(selectPveDifficulty(localMatch,humanParticipant(),difficulty)){$('pve-difficulty').value=difficulty;renderHud();}
}));
$('confirm-match').addEventListener('click',startMatch);
$('confirm-bet').addEventListener('click',()=>{
  if(!localMatch)return;
  const ok=confirmLocalBet(localMatch,humanParticipant(),$('bet-prediction').value,Number($('bet-amount').value));
  if(ok)specialDismissedRound=localMatch.round;
  showToast(ok?'Aposta confirmada.':'Aposta indisponível.');renderHud();
});
$('pve-difficulty').addEventListener('change',()=>{if(localMatch)selectPveDifficulty(localMatch,humanParticipant(),$('pve-difficulty').value);renderHud();});
$('return-menu').addEventListener('click',openMenu);
$('again').addEventListener('click',openMenu);
$('back-own-arena').addEventListener('click',()=>observePlayer(localMatch?.ownerId));
$('toggle-damage').addEventListener('click',()=>{
  const content=$('damage-content');content.hidden=!content.hidden;
  $('toggle-damage').setAttribute('aria-expanded',String(!content.hidden));
  $('damage-chevron').textContent=content.hidden?'‹':'›';
});
$('reroll-shop').addEventListener('click',()=>{
  if(!canManage())return;
  if(!refreshLocalShop(localMatch,humanParticipant(),Math.random,true))showToast('Reroll indisponível.');
  shopSignature='';
  renderHud();
});
$('lock-shop').addEventListener('click',()=>{
  if(canManage()) {toggleLocalShopLock(localMatch,humanParticipant());shopSignature='';renderHud();}
});
$('sell-selected').addEventListener('click',()=>sell(selectedMon()));
window.addEventListener('resize',sizeCanvas);
sizeCanvas();
renderHud();
prepareSprites();
requestAnimationFrame(frame);
