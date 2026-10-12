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
import {TERRAIN,STRUCTURE_BY_ID,STRUCTURE_CAPACITY,paintTerrain,buyStructure,placeStructure,removeStructure,discardStructure,structurePoints,fieldEffects} from '../../server/game/terrain.mjs';

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
    if(!buyStructure(localMatch,player,index)) {showToast('Sem ouro ou seis pilhas de estruturas ocupadas.');return false;}
    shopSignature=''; terrainSignature=''; renderHud();showToast('Estrutura adicionada ao inventário.');return true;
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
  if(activeTab==='terrain'){
    terrainActionAt(e);
    if(terrainTool!=='structure'&&terrainTool!=='remove'){terrainPainting=e.pointerId;canvas.setPointerCapture(e.pointerId);}
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
  if(drag?.kind==='unit'&&drag.pointer===e.pointerId) {
    drag.world={x:world.x-drag.offset.x,y:world.y-drag.offset.y};
    updateSellHover(e.clientX,e.clientY);
  }
});
canvas.addEventListener('pointerup',e=>{
  if(terrainPainting===e.pointerId){terrainPainting=null;return;}
  if(pan?.pointer===e.pointerId) {pan=null;return;}
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
document.addEventListener('pointercancel',()=>{shopPointer=null;if(drag?.kind==='shop')drag=null;suppressShopClick=false;});
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
  $('shop-title').textContent=terrainMode?'Terreno':'Loja';
  $('tab-pokemon').classList.toggle('selected',!terrainMode);
  $('tab-pokemon').setAttribute('aria-pressed',String(!terrainMode));
  $('tab-terrain').classList.toggle('selected',terrainMode);
  $('tab-terrain').setAttribute('aria-pressed',String(terrainMode));
  $('reroll-shop').hidden=terrainMode;
  $('lock-shop').hidden=terrainMode||!localMatch;
  $('discard-structure').hidden=!terrainMode;
  $('remove-placed').hidden=!terrainMode;
  $('remove-placed').disabled=!editing;
  $('remove-placed').classList.toggle('selected',terrainTool==='remove');
  $('discard-structure').disabled=!editing||!selectedStructure||!(player?.structureInventory||[]).some(s=>s.id===selectedStructure);
  $('shop-mode-note').textContent=terrainMode?'10 solos · 6 pilhas':'Pool compartilhado · Pokémon';
  $('hp-stat').hidden=!localMatch;
  $('alive-stat').hidden=!localMatch;
  $('timer-stat').hidden=!localMatch;
  $('round-label').textContent=localMatch?.round??1;
  $('limit-label').textContent=`${observed?.board.length||0}/${fieldLimitForBattle(localMatch?.round||1)}`;
  $('gold-label').textContent=player?.gold??9;
  $('hp-label').textContent=observed?.hp??100;
  $('alive-label').textContent=localMatch?`${aliveCount(localMatch)}/${localMatch.players.length}`:'—';
  $('timer-label').textContent=localMatch?`${phaseRemainingSeconds(localMatch,performance.now()/1000)}s`:'45s';
  $('phase-label').textContent=localMatch?.phase==='combat'?'Combate · Local':localMatch?.phase==='finished'?'Fim de partida':'Preparação · Local';
  $('reroll-shop').disabled=!editing||player.shopLocked||player.gold<RULES.rerollCostGold;
  $('lock-shop').disabled=!editing;
  $('lock-shop').textContent=player?.shopLocked?'🔒 Travada':'🔓 Travar';
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
function renderEnvironment() {
  const player=observedParticipant();
  if(!player||!localMatch)return;
  const compass=calculateCompass(player);
  player.compass=compass; // Snapshot local recalculado ao consultar; nunca altera chances de raridade.
  $('compass-list').innerHTML=ALL_TYPES.map(type=>`<span class="compass-entry"><span>${type}</span><b>${+compass[type].toFixed(1)}</b></span>`).join('');
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
  $('terrain-tools').innerHTML=Object.entries(TERRAIN).filter(([id])=>id!=='neutro').map(([id,t])=>`<button class="terrain-tool${terrainTool===id?' selected':''}" type="button" data-id="${id}" title="Pintar ${t.name}" ${canEdit()?'':'disabled'}><span class="swatch" style="background:${t.color}"></span><small>${t.name}</small></button>`).join('');
  $('terrain-tools').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{terrainTool=button.dataset.id;selectedStructure=null;terrainSignature='';renderHud();}));
  const inventory=player?.structureInventory||[];
  $('structure-inventory').innerHTML=Array.from({length:6},(_,i)=>{
    const stack=inventory[i];const item=STRUCTURE_BY_ID[stack?.id];
    return `<button type="button" class="structure-slot${selectedStructure===stack?.id&&terrainTool==='structure'?' selected':''}" data-index="${i}" ${!item||!canEdit()?'disabled':''} title="${item?.name||'Inventário vazio'}"><small>${item?.name||'Vazio'}</small>${stack?`<span class="stack-count">×${stack.count}</span>`:''}</button>`;
  }).join('');
  $('structure-inventory').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
    selectedStructure=inventory[Number(button.dataset.index)]?.id||null;
    terrainTool='structure';terrainSignature='';renderHud();
  }));
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
    $('shop-rarity-odds').innerHTML=Object.keys(RARITY_COLORS).map((rarity,i)=>`<span style="--rarity:${RARITY_COLORS[rarity]}" title="${RARITY_LABELS[rarity]}">${RARITY_LABELS[rarity]} <b>${odds[i]}%</b></span>`).join('');
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
      return `<button type="button" class="shop-card structure-offer rarity-${def.rarity}" data-index="${i}" ${!editable||player.gold<def.price||fullStacks?'disabled':''} title="${def.name}, ${def.size}×${def.size}"><span class="shop-rarity">Estrutura ${def.rarity}</span><span class="shop-portrait"><span class="structure-symbol">${def.size===2?'▦':'◆'}</span></span><span class="shop-footer"><b>${def.name}</b><span class="shop-price">${coinSvg}<span>${def.price}</span></span></span></button>`;
    }
    if(!id) {
      const waiting=kinds[i]==='item'?'Item · etapa 10':kinds[i]==='estrutura'?'Estrutura · etapa 9':'Vazio';
      return `<button type="button" class="shop-card empty" data-index="${i}" disabled><span class="shop-portrait"><span class="empty-mark">＋</span></span><span class="shop-footer"><b>${waiting}</b></span></button>`;
    }
    const p=BY_ID[id];
    const disabled=!editable||player.gold<p.price;
    return `<button type="button" class="shop-card rarity-${p.rarity}" data-index="${i}" style="--rarity:${RARITY_COLORS[p.rarity]}" ${disabled?'disabled':''} aria-label="Comprar ${p.name} por ${p.price} ouro"><span class="shop-rarity">${RARITY_LABELS[p.rarity]}</span><span class="shop-portrait"><canvas class="portrait-fallback visible" width="70" height="70" aria-hidden="true"></canvas></span><span class="shop-footer"><b>${p.name}</b><span class="shop-price">${coinSvg}<span>${p.price}</span></span></span></button>`;
  }).join('');
  $('shop-slots').querySelectorAll('.shop-card').forEach(card=>{
    const index=Number(card.dataset.index);
    const id=offers[index];
    if(!id)return;
    if(BY_ID[id])drawSmallSprite(card.querySelector('canvas'),BY_ID[id],0);
    card.addEventListener('click',()=>{if(!suppressShopClick)purchase(index);});
    card.addEventListener('pointerdown',e=>{
      if(e.button!==0||!canEdit()||!BY_ID[id])return;
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
function makeTerrain() {
  const temp = document.createElement('canvas');
  const c = temp.getContext('2d');
  temp.width = BOARD.width;
  temp.height = BOARD.height;
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#18351f';
  c.fillRect(0, 0, BOARD.width, BOARD.height);
  for (let y = 0; y < BOARD.height; y += 28) {
    for (let x = 0; x < BOARD.width; x += 28) {
      c.fillStyle = hash(x, y) > .5 ? '#224a28' : '#1e4325';
      c.fillRect(x, y, 28, 28);
    }
  }
  c.fillStyle = '#5f8848';
  c.fillRect(BOARD.x - 12, BOARD.y - 12, BOARD.columns * BOARD.tile + 24, BOARD.rows * BOARD.tile + 24);
  for (let row = 0; row < BOARD.rows; row++) {
    for (let col = 0; col < BOARD.columns; col++) {
      const x = BOARD.x + col * BOARD.tile;
      const y = BOARD.y + row * BOARD.tile;
      c.fillStyle = (row === BOARD.enemyBenchRow || row === BOARD.playerBenchRow) ? '#617d4e' : ['#7db44e', '#83ba55', '#76ab49'][Math.floor(hash(col, row) * 3)];
      c.fillRect(x, y, BOARD.tile, BOARD.tile);
      for (let j = 0; j < 14; j++) {
        const xx = x + hash(col * 40 + j, row, 17) * (BOARD.tile - 8) + 4;
        const yy = y + hash(col, row * 50 + j, 26) * (BOARD.tile - 8) + 5;
        c.strokeStyle = hash(j, col, row) > .48 ? '#609843' : '#a8cc75';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(xx, yy + 3);
        c.lineTo(xx - 2, yy);
        c.moveTo(xx + 1, yy + 3);
        c.lineTo(xx + 2, yy - 1);
        c.stroke();
      }
    }
  }
  c.fillStyle = '#d7df96';
  c.fillRect(BOARD.x - 6, BOARD.y + BOARD.playerFieldStart * BOARD.tile - 3, BOARD.columns * BOARD.tile + 12, 6);
  c.fillStyle = '#2e5a32';
  c.fillRect(BOARD.x - 6, BOARD.y + BOARD.enemyFieldStart * BOARD.tile - 6, BOARD.columns * BOARD.tile + 12, 8);
  c.fillRect(BOARD.x - 6, BOARD.y + BOARD.playerBenchRow * BOARD.tile - 6, BOARD.columns * BOARD.tile + 12, 8);
  c.strokeStyle = '#e1f0b7';
  c.lineWidth = 2;
  c.strokeRect(BOARD.x - 1, BOARD.y - 1, BOARD.columns * BOARD.tile + 2, BOARD.rows * BOARD.tile + 2);
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
        ctx.save();ctx.globalAlpha=.80;ctx.fillStyle=tile.color;ctx.fillRect(x+1,y+1,BOARD.tile-2,BOARD.tile-2);
        ctx.globalAlpha=.22;ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x+8,y+BOARD.tile-8);ctx.lineTo(x+BOARD.tile-8,y+8);ctx.stroke();ctx.restore();
      }
      for(const structure of player.structures||[]){
        const item=STRUCTURE_BY_ID[structure.id];if(!item)continue;
        const row=isTop?5-structure.row-(item.size-1):BOARD.playerFieldStart+structure.row;
        const x=BOARD.x+structure.col*BOARD.tile,y=BOARD.y+row*BOARD.tile;
        ctx.save();ctx.fillStyle='#213a30dc';ctx.fillRect(x+4,y+4,BOARD.tile*item.size-8,BOARD.tile*item.size-8);
        ctx.strokeStyle=item.rarity==='lendaria'?'#ffe09b':item.rarity==='rara'?'#a3d9ff':'#c7deb4';ctx.lineWidth=3;
        ctx.strokeRect(x+5,y+5,BOARD.tile*item.size-10,BOARD.tile*item.size-10);
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f7f9dd';ctx.font=`${item.size===2?20:13}px sans-serif`;
        ctx.fillText(item.size===2?'▦':'◆',x+BOARD.tile*item.size/2,y+BOARD.tile*item.size/2-6);
        ctx.font=`bold ${item.size===2?11:8}px sans-serif`;ctx.fillText(item.name.slice(0,item.size===2?19:8),x+BOARD.tile*item.size/2,y+BOARD.tile*item.size/2+9);ctx.restore();
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
  if (!p || !activeDrag.world) return;
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
    if (drag?.kind === 'shop') drawShopGhost(drag);
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
