import { POKEMON, BY_ID, SHOP_IDS, EVOLVES_TO, getFrame, spritePath, spriteUrl, applySpriteManifest } from './pokemon.mjs';
import { MOVES_BY_ID, movePool, initialLoadout } from './moves.mjs';
import { BOARD, TAU, cellAtWorld, isBenchCell, benchTeamForCell, tilePosition, validCellForTeam, maxActiveForRound, effectiveStats, createBattle, syncLineups, startBattle, updateBattle } from './battle.mjs';

const $ = id => document.getElementById(id);
const canvas = $('arena');
const ctx = canvas.getContext('2d', { alpha:false });
const base = (canvas.dataset.base || '/').replace(/\/?$/, '/');
const keys = ['vida', 'atk', 'def', 'spa', 'spd', 'vel'];
const stageName = { 1:'Base', 2:'Evoluido', 3:'Final' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const spriteMap = new Map();
const hash = (x, y, z = 0) => {
  let v = Math.imul(x * 374761393 ^ y * 668265263 ^ z * 1274126177, 1597334677);
  v ^= v >>> 13;
  v = Math.imul(v, 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
};

let idSeq = 1;
let battle = createBattle([[], []]);
let selectedId = null;
let speciesPick = '0004';
let teamPick = 1;
let deleteMode = false;
let resultAnnounced = false;
let lastFrame = 0;
let visualTime = 0;
let hovered = null;
let drag = null;
let shopPointer = null;
let suppressShopClick = false;
let pan = null;
let spaceDown = false;
let toastTimer = 0;
let dpr = 1;
let screen = { w: 1000, h: 760 };
const camera = { x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1 };
const evolutionEffects = [];
const state = {
  round: 1,
  gold: Infinity,
  infiniteGold: true,
  playerBench: Array(10).fill(null),
  enemyBench: Array(10).fill(null),
  playerBoard: [],
  enemyBoard: [],
  shop: Array(6).fill(null)
};

function newMon(speciesId, team = 0) {
  const ivs = Object.fromEntries(keys.map(k => [k, Math.round(Math.random() * 100)]));
  return {
    instanceId: `mon-${Date.now().toString(36)}-${idSeq++}`,
    speciesId,
    team,
    ivs,
    iv: Math.round(keys.reduce((sum, k) => sum + ivs[k], 0) / keys.length),
    activeMoves: initialLoadout(speciesId),
    slots: 2,
    col: team ? 5 : 4,
    row: team ? 2 : 7,
    x: 0,
    y: 0
  };
}
function maxActive() {
  return maxActiveForRound(state.round);
}
function fieldUnits() {
  return [...state.playerBoard, ...state.enemyBoard];
}
function allUnits() {
  return [...fieldUnits(), ...state.playerBench.filter(Boolean), ...state.enemyBench.filter(Boolean)];
}
function listForTeam(team) {
  return team ? state.enemyBoard : state.playerBoard;
}
function benchForTeam(team) {
  return team ? state.enemyBench : state.playerBench;
}
function selectedMon() {
  return findMon(selectedId) || allUnits()[0] || null;
}
function findMon(id) {
  return allUnits().find(mon => mon.instanceId === id) || null;
}
function monCell(mon) {
  if (state.playerBench.includes(mon)) return { col: state.playerBench.indexOf(mon), row: BOARD.playerBenchRow };
  if (state.enemyBench.includes(mon)) return { col: state.enemyBench.indexOf(mon), row: BOARD.enemyBenchRow };
  return { col: mon.col, row: mon.row };
}
function monWorld(mon) {
  if (drag?.kind === 'unit' && drag.mon === mon && drag.world) return drag.world;
  const cell = monCell(mon);
  return tilePosition(cell.col, cell.row);
}
function benchIndex(mon) {
  const playerSlot = state.playerBench.findIndex(item => item === mon);
  if (playerSlot >= 0) return { team:0, slot:playerSlot };
  const enemySlot = state.enemyBench.findIndex(item => item === mon);
  if (enemySlot >= 0) return { team:1, slot:enemySlot };
  return null;
}
function boardIndex(mon) {
  return listForTeam(mon.team).indexOf(mon);
}
function removeFromContainers(mon) {
  const b = benchIndex(mon);
  if (b) benchForTeam(b.team)[b.slot] = null;
  for (const list of [state.playerBoard, state.enemyBoard]) {
    const i = list.indexOf(mon);
    if (i >= 0) list.splice(i, 1);
  }
}
function boardOccupant(team, col, row, except = null) {
  return listForTeam(team).find(mon => mon !== except && mon.col === col && mon.row === row);
}
function benchOccupant(team, col, except = null) {
  const bench = benchForTeam(team);
  return bench[col] && bench[col] !== except ? bench[col] : null;
}
function snapshot(mon) {
  const b = benchIndex(mon);
  if (b) return { kind:'bench', slot:b.slot, team:b.team, col:mon.col, row:mon.row };
  return { kind:'board', team:mon.team, col:mon.col, row:mon.row };
}
function restore(mon, origin) {
  removeFromContainers(mon);
  mon.team = origin.team;
  mon.col = origin.col;
  mon.row = origin.row;
  if (origin.kind === 'bench') benchForTeam(origin.team)[origin.slot] = mon;
  else listForTeam(mon.team).push(mon);
  syncBattle();
  renderHud();
}
function firstBenchSlot(team = 0) {
  return benchForTeam(team).findIndex(item => !item);
}
function placeBench(mon, team, slot, swap = true) {
  if (!mon || battle.phase !== 'setup') return false;
  const target = clamp(slot, 0, 9);
  const other = benchOccupant(team, target, mon);
  const origin = snapshot(mon);
  if (other && !swap) return false;
  removeFromContainers(mon);
  if (other) restoreOtherToOrigin(other, origin);
  mon.team = team;
  benchForTeam(team)[target] = mon;
  selectedId = mon.instanceId;
  syncBattle();
  renderHud();
  return true;
}
function restoreOtherToOrigin(other, origin) {
  removeFromContainers(other);
  other.team = origin.team;
  other.col = origin.col;
  other.row = origin.row;
  if (origin.kind === 'bench') benchForTeam(origin.team)[origin.slot] = other;
  else listForTeam(other.team).push(other);
}
function placeBoard(mon, team, cell, swap = true) {
  if (!mon || battle.phase !== 'setup' || !validCellForTeam(team, cell)) return false;
  const list = listForTeam(team);
  const alreadyInList = list.includes(mon);
  if (!alreadyInList && list.length >= maxActive()) {
    showToast(`Limite do campo: ${maxActive()} em campo.`);
    return false;
  }
  const other = boardOccupant(team, cell.col, cell.row, mon);
  const origin = snapshot(mon);
  if (other && !swap) return false;
  removeFromContainers(mon);
  if (other) restoreOtherToOrigin(other, origin);
  mon.team = team;
  mon.col = cell.col;
  mon.row = cell.row;
  const p = tilePosition(cell.col, cell.row);
  mon.x = p.x;
  mon.y = p.y;
  list.push(mon);
  selectedId = mon.instanceId;
  syncBattle();
  renderHud();
  return true;
}
function removeUnit(mon, grantGold = false) {
  if (!mon || battle.phase !== 'setup') return;
  const p = BY_ID[mon.speciesId];
  removeFromContainers(mon);
  if (grantGold && mon.team === 0 && !state.infiniteGold) state.gold += p.price;
  if (selectedId === mon.instanceId) selectedId = allUnits()[0]?.instanceId ?? null;
  syncBattle();
  renderHud();
  showToast(mon.team === 0 ? `${p.name} vendido por ${p.price}.` : `${p.name} removido.`);
}
function buyOffer(index) {
  if (battle.phase !== 'setup') return;
  const speciesId = state.shop[index];
  if (!speciesId) return;
  const slot = firstBenchSlot(0);
  if (slot < 0) {
    showToast('Banco cheio.');
    return;
  }
  const p = BY_ID[speciesId];
  if (!state.infiniteGold && state.gold < p.price) {
    showToast('Ouro insuficiente.');
    return;
  }
  if (!state.infiniteGold) state.gold -= p.price;
  const mon = newMon(speciesId, 0);
  placeBench(mon, 0, slot, false);
  state.shop[index] = null;
  evolveTeam(0);
  renderHud();
}
function buyOfferToCell(index, cell) {
  if (battle.phase !== 'setup') return false;
  const speciesId = state.shop[index];
  if (!speciesId || !cell) return false;
  const team = isBenchCell(cell) ? benchTeamForCell(cell) : pointerTeamForCell(cell);
  if (team == null) return false;
  const p = BY_ID[speciesId];
  if (!state.infiniteGold && state.gold < p.price) {
    showToast('Ouro insuficiente.');
    return false;
  }
  const mon = newMon(speciesId, team);
  const placed = isBenchCell(cell) ? placeBench(mon, team, cell.col, false) : placeBoard(mon, team, cell, false);
  if (!placed) return false;
  if (!state.infiniteGold) state.gold -= p.price;
  state.shop[index] = null;
  evolveTeam(team);
  renderHud();
  return true;
}
function refillShop() {
  state.shop = Array.from({ length:6 }, () => SHOP_IDS[Math.floor(Math.random() * SHOP_IDS.length)]);
  renderShop();
}
function evolveTeam(team) {
  let changed = false;
  for (;;) {
    const groups = new Map();
    for (const mon of allUnits().filter(unit => unit.team === team)) {
      if (!EVOLVES_TO[mon.speciesId]) continue;
      const list = groups.get(mon.speciesId) || [];
      list.push(mon);
      groups.set(mon.speciesId, list);
    }
    const found = [...groups.entries()].find(([, list]) => list.length >= 3);
    if (!found) break;
    const [speciesId, copies] = found;
    const keep = copies[0];
    const mergeTo = monWorld(keep);
    evolutionEffects.push({
      from: copies.slice(0, 3).map(mon => ({ ...monWorld(mon), speciesId:mon.speciesId, team:mon.team })),
      to: { ...mergeTo },
      newSpeciesId: EVOLVES_TO[speciesId],
      time: 0,
      total: .95
    });
    for (const mon of copies.slice(1, 3)) removeFromContainers(mon);
    keep.speciesId = EVOLVES_TO[speciesId];
    keep.activeMoves = initialLoadout(keep.speciesId);
    keep.slots = 2;
    selectedId = keep.instanceId;
    changed = true;
    showToast(`${BY_ID[speciesId].name} evoluiu para ${BY_ID[keep.speciesId].name}.`);
  }
  if (changed) {
    syncBattle();
    renderHud();
  }
}
function rerollMove(slot) {
  const mon = selectedMon();
  if (!mon || battle.phase !== 'setup') return;
  const moveSlot = clamp(slot, 0, mon.slots - 1);
  const pool = movePool(mon.speciesId);
  const current = mon.activeMoves[moveSlot];
  const available = pool.filter(move => move.id !== current && !mon.activeMoves.includes(move.id));
  if (!available.length) return;
  mon.activeMoves[moveSlot] = available[Math.floor(Math.random() * available.length)].id;
  syncBattle();
  renderDetails();
}
function unlockMove() {
  const mon = selectedMon();
  if (!mon || battle.phase !== 'setup' || mon.slots >= 3) return;
  const available = movePool(mon.speciesId).find(move => !mon.activeMoves.includes(move.id));
  if (!available) return;
  mon.slots = 3;
  mon.activeMoves.push(available.id);
  syncBattle();
  renderDetails();
}
function syncBattle() {
  syncLineups(battle, [state.playerBoard, state.enemyBoard]);
}
function beginBattle() {
  if (!state.playerBoard.length || !state.enemyBoard.length) {
    showToast('Coloque pelo menos uma unidade de cada lado.');
    return;
  }
  if (startBattle(battle)) {
    resultAnnounced = false;
    $('outcome').hidden = true;
    renderHud();
  }
}
function prepareSameTeams() {
  battle = createBattle([state.playerBoard, state.enemyBoard]);
  resultAnnounced = false;
  $('outcome').hidden = true;
  renderHud();
}
function togglePause() {
  if (battle.phase !== 'fighting') return;
  battle.paused = !battle.paused;
  renderHud();
}
function nextRound() {
  state.round += 1;
  prepareSameTeams();
  refillShop();
}
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
}

function screenPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x:clientX - rect.left, y:clientY - rect.top };
}
function screenToWorld(point) {
  return { x:(point.x - camera.x) / camera.scale, y:(point.y - camera.y) / camera.scale };
}
function worldToScreen(point) {
  return { x:point.x * camera.scale + camera.x, y:point.y * camera.scale + camera.y };
}
function clientToWorld(clientX, clientY) {
  return screenToWorld(screenPoint(clientX, clientY));
}
function fitCamera() {
  const world = {
    x: BOARD.x - 34,
    y: BOARD.y - 42,
    w: BOARD.columns * BOARD.tile + 68,
    h: BOARD.rows * BOARD.tile + 80
  };
  const usableH = Math.max(280, screen.h - 136);
  const scale = clamp(Math.min((screen.w - 34) / world.w, usableH / world.h), .55, 1.9);
  camera.scale = scale;
  camera.targetScale = scale;
  camera.x = (screen.w - world.w * scale) / 2 - world.x * scale;
  camera.y = 78 + (usableH - world.h * scale) / 2 - world.y * scale;
  camera.targetX = camera.x;
  camera.targetY = camera.y;
}
function zoomAt(screenPos, factor) {
  const before = screenToWorld(screenPos);
  camera.targetScale = clamp(camera.targetScale * factor, .45, 2.7);
  camera.targetX = screenPos.x - before.x * camera.targetScale;
  camera.targetY = screenPos.y - before.y * camera.targetScale;
}
function updateCamera(dt) {
  if (pan) return;
  const t = 1 - Math.pow(.0015, dt);
  camera.scale += (camera.targetScale - camera.scale) * t;
  camera.x += (camera.targetX - camera.x) * t;
  camera.y += (camera.targetY - camera.y) * t;
  if (Math.abs(camera.targetScale - camera.scale) < .0005) camera.scale = camera.targetScale;
  if (Math.abs(camera.targetX - camera.x) < .05) camera.x = camera.targetX;
  if (Math.abs(camera.targetY - camera.y) < .05) camera.y = camera.targetY;
}
function cellAtClient(clientX, clientY) {
  const p = clientToWorld(clientX, clientY);
  return cellAtWorld(p.x, p.y);
}
function hitUnit(world) {
  let hit = null;
  let proximity = 34;
  for (const mon of allUnits()) {
    const p = monWorld(mon);
    const d = Math.hypot(world.x - p.x, world.y - p.y + 14);
    if (d < proximity) {
      hit = mon;
      proximity = d;
    }
  }
  return hit;
}
function pointerTeamForCell(cell) {
  if (!cell) return teamPick;
  if (isBenchCell(cell)) return benchTeamForCell(cell);
  return validCellForTeam(1, cell) ? 1 : 0;
}
function dropUnit(mon, cell, origin) {
  if (!cell) {
    restore(mon, origin);
    return;
  }
  if (isBenchCell(cell)) {
    placeBench(mon, benchTeamForCell(cell), cell.col);
    return;
  }
  const team = pointerTeamForCell(cell);
  if (!placeBoard(mon, team, cell, true)) restore(mon, origin);
  else evolveTeam(team);
}
function dropShopOffer(index, cell) {
  if (!buyOfferToCell(index, cell)) showToast('Solte em um banco ou campo valido.');
}
function createAt(cell) {
  if (!cell || isBenchCell(cell) || battle.phase !== 'setup') return;
  if (deleteMode) return;
  const team = teamPick;
  if (!validCellForTeam(team, cell)) return;
  const mon = newMon(speciesPick, team);
  placeBoard(mon, team, cell, true);
}

canvas.addEventListener('pointerdown', e => {
  const screenPos = screenPoint(e.clientX, e.clientY);
  const world = screenToWorld(screenPos);
  if (e.button === 1 || e.button === 2 || (spaceDown && e.button === 0)) {
    pan = { pointer:e.pointerId, start:screenPos, x:camera.x, y:camera.y };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if (e.button !== 0 || battle.phase !== 'setup') return;
  const hit = hitUnit(world);
  if (hit) {
    selectedId = hit.instanceId;
    renderDetails();
    if (deleteMode) {
      removeUnit(hit, hit.team === 0);
      return;
    }
    const p = monWorld(hit);
    drag = { kind:'unit', pointer:e.pointerId, mon:hit, origin:snapshot(hit), offset:{ x:world.x - p.x, y:world.y - p.y }, world:p, moved:false };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', e => {
  const screenPos = screenPoint(e.clientX, e.clientY);
  const world = screenToWorld(screenPos);
  hovered = battle.phase === 'setup' ? cellAtWorld(world.x, world.y) : null;
  if (pan?.pointer === e.pointerId) {
    camera.x = pan.x + screenPos.x - pan.start.x;
    camera.y = pan.y + screenPos.y - pan.start.y;
    camera.targetX = camera.x;
    camera.targetY = camera.y;
    return;
  }
  if (drag?.pointer === e.pointerId) {
    drag.world = { x:world.x - drag.offset.x, y:world.y - drag.offset.y };
    drag.moved = true;
  }
});
canvas.addEventListener('pointerup', e => {
  if (pan?.pointer === e.pointerId) {
    pan = null;
    return;
  }
  if (!drag || drag.pointer !== e.pointerId) return;
  const activeDrag = drag;
  drag = null;
  if (document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#sell-zone,#shop-slots,.shop-meta,.bottom-hud')) {
    removeUnit(activeDrag.mon, activeDrag.mon.team === 0);
    return;
  }
  if (activeDrag.kind === 'unit') dropUnit(activeDrag.mon, cellAtClient(e.clientX, e.clientY), activeDrag.origin);
});
canvas.addEventListener('pointercancel', () => {
  if (drag?.kind === 'unit') restore(drag.mon, drag.origin);
  drag = null;
  pan = null;
  shopPointer = null;
});
document.addEventListener('pointermove', e => {
  if (!shopPointer || shopPointer.pointer !== e.pointerId) return;
  const moved = Math.hypot(e.clientX - shopPointer.start.x, e.clientY - shopPointer.start.y);
  if (!shopPointer.dragging && moved > 5) {
    shopPointer.dragging = true;
    suppressShopClick = true;
    const world = clientToWorld(e.clientX, e.clientY);
    drag = { kind:'shop', pointer:e.pointerId, index:shopPointer.index, speciesId:shopPointer.speciesId, offset:{ x:0, y:0 }, world, moved:true };
  }
  if (shopPointer.dragging && drag?.kind === 'shop') {
    drag.world = clientToWorld(e.clientX, e.clientY);
    hovered = battle.phase === 'setup' ? cellAtClient(e.clientX, e.clientY) : null;
  }
});
document.addEventListener('pointerup', e => {
  if (!shopPointer || shopPointer.pointer !== e.pointerId) return;
  const active = shopPointer;
  shopPointer = null;
  if (!active.dragging) return;
  drag = null;
  if (!document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.bottom-hud')) {
    dropShopOffer(active.index, cellAtClient(e.clientX, e.clientY));
  }
  setTimeout(() => { suppressShopClick = false; }, 0);
});
document.addEventListener('pointercancel', e => {
  if (!shopPointer || shopPointer.pointer !== e.pointerId) return;
  shopPointer = null;
  if (drag?.kind === 'shop') drag = null;
  suppressShopClick = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoomAt(screenPoint(e.clientX, e.clientY), e.deltaY < 0 ? 1.12 : .89);
}, { passive:false });
window.addEventListener('keydown', e => {
  if (e.code === 'Space') spaceDown = true;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const mon = selectedMon();
    if (mon) removeUnit(mon, mon.team === 0);
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') spaceDown = false;
});

function renderHud() {
  $('round-label').textContent = String(state.round);
  $('limit-label').textContent = `${state.playerBoard.length}/${maxActive()}`;
  $('gold-label').textContent = state.infiniteGold ? '∞' : String(state.gold);
  $('phase-label').textContent = battle.phase === 'setup' ? 'Preparação' : battle.phase === 'finished' ? 'Resultado' : battle.paused ? 'Pausado' : 'Combate';
  $('start').disabled = battle.phase !== 'setup' || !state.playerBoard.length || !state.enemyBoard.length;
  $('pause').disabled = battle.phase !== 'fighting';
  $('pause').textContent = battle.paused ? '▶' : 'Ⅱ';
  $('prepare').disabled = battle.phase === 'setup';
  renderDetails();
  renderShop();
}
function renderDetails() {
  const mon = selectedMon();
  const panel = $('detail-panel');
  panel.classList.toggle('collapsed', !mon);
  if (!mon) return;
  selectedId = mon.instanceId;
  const p = BY_ID[mon.speciesId];
  const stats = effectiveStats(p, mon.ivs);
  $('selected-number').textContent = `#${String(p.number).padStart(3, '0')}`;
  $('selected-name').textContent = p.name;
  $('selected-type').textContent = `${p.type} · ${stageName[p.stage]}`;
  $('selected-type').style.color = p.color;
  const b = benchIndex(mon);
  $('selected-place').textContent = b ? `${b.team ? 'Banco inimigo' : 'Banco'} ${b.slot + 1}` : mon.team ? `Inimigo ${mon.col + 1},${mon.row}` : `Aliado ${mon.col + 1},${mon.row - BOARD.playerFieldStart + 1}`;
  $('selected-iv').textContent = `IV geral ${mon.iv}%`;
  $('sell-value').textContent = mon.team === 0 ? `Venda: ${p.price} ouro` : 'Remover inimigo';
  drawSmallSprite($('selected-avatar'), p, mon.team ? 0 : 4);
  $('stats-list').innerHTML = keys.map(k => {
    const baseValue = p.stats[k];
    const value = stats[k];
    return `<div class="stat"><span>${k.toUpperCase()}</span><div><b>${value}</b><small>base ${baseValue} · IV ${mon.ivs[k]}%</small></div></div>`;
  }).join('');
  $('moves-active').innerHTML = mon.activeMoves.slice(0, mon.slots).map((id, i) => {
    const move = MOVES_BY_ID[id];
    return `<div class="move-row"><button type="button" class="move-card" tabindex="-1"><b>${move.name}</b><small>${move.category === 'atk' ? 'Fisico' : 'Especial'} · ${move.damage} · ${move.range.toFixed(1)}</small></button><button type="button" class="move-reroll" data-slot="${i}" title="Rerollar ${move.name}" aria-label="Rerollar ${move.name}">↻</button></div>`;
  }).join('');
  if (mon.slots < 3) $('moves-active').insertAdjacentHTML('beforeend', '<button id="unlock-move" class="move-unlock" type="button">+ Novo ataque</button>');
  $('moves-active').querySelectorAll('.move-reroll').forEach(btn => {
    btn.disabled = battle.phase !== 'setup';
    btn.addEventListener('click', () => rerollMove(Number(btn.dataset.slot)));
  });
  const unlockButton = $('unlock-move');
  if (unlockButton) {
    unlockButton.addEventListener('click', unlockMove);
    unlockButton.disabled = battle.phase !== 'setup' || mon.slots >= 3;
  }
  $('sell-selected').disabled = battle.phase !== 'setup';
}
function renderSpeciesTools() {
  const wrap = $('species-picks');
  if (!wrap) return;
  wrap.innerHTML = SHOP_IDS.map(id => `<button type="button" class="${speciesPick === id ? 'picked' : ''}" data-id="${id}"><canvas width="36" height="32" aria-hidden="true"></canvas><span>${BY_ID[id].name}</span></button>`).join('');
  wrap.querySelectorAll('button').forEach(btn => {
    drawSmallSprite(btn.querySelector('canvas'), BY_ID[btn.dataset.id], 0);
    btn.addEventListener('click', () => {
      speciesPick = btn.dataset.id;
      renderSpeciesTools();
    });
  });
  renderTeamTools();
}
function renderTeamTools() {
  if (!$('pick-player')) return;
  $('pick-player').classList.toggle('picked', teamPick === 0);
  $('pick-enemy').classList.toggle('picked', teamPick === 1);
  $('delete-mode').classList.toggle('picked', deleteMode);
}
function renderShop() {
  const slots = $('shop-slots');
  slots.innerHTML = state.shop.map((id, i) => {
    if (!id) return `<button type="button" class="shop-card empty" data-index="${i}"><span>${i < 2 ? 'Flex' : 'Mon'}</span><b>Vazio</b></button>`;
    const p = BY_ID[id];
    return `<button type="button" class="shop-card" data-index="${i}"><span>${i < 2 ? 'Flex' : 'Mon'}</span><canvas width="48" height="44" aria-hidden="true"></canvas><b>${p.name}</b><small>${p.price} ouro</small></button>`;
  }).join('');
  slots.querySelectorAll('.shop-card').forEach(card => {
    const index = Number(card.dataset.index);
    const id = state.shop[index];
    if (id) drawSmallSprite(card.querySelector('canvas'), BY_ID[id], 0);
    card.addEventListener('click', () => {
      if (suppressShopClick) return;
      buyOffer(index);
    });
    card.addEventListener('pointerdown', e => startShopPointer(e, index));
  });
}
function startShopPointer(e, index) {
  if (e.button !== 0 || battle.phase !== 'setup' || !state.shop[index]) return;
  shopPointer = {
    pointer:e.pointerId,
    index,
    speciesId:state.shop[index],
    start:{ x:e.clientX, y:e.clientY },
    dragging:false
  };
}

function assetFor(p, action) {
  return p.sprites[action]?.asset || action;
}
async function loadImage(p, action) {
  const key = `${p.id}:${action}`;
  if (spriteMap.has(key)) return;
  const image = new Image();
  image.decoding = 'async';
  await new Promise(resolve => {
    let remote = false;
    image.onload = () => { spriteMap.set(key, image); resolve(); };
    image.onerror = () => {
      if (remote) { resolve(); return; }
      remote = true;
      image.src = spriteUrl(p, action);
    };
    image.src = `${base}sprites/${spritePath(p, action)}`;
  });
}
async function prepareSprites() {
  try {
    const r = await fetch(`${base}sprites/manifest.json`);
    if (r.ok) applySpriteManifest(await r.json());
  } catch {}
  const requests = POKEMON.flatMap(p => [...new Set(Object.values(p.sprites).map(x => x.asset).filter(Boolean))].map(action => [p, action]));
  for (let i = 0; i < requests.length; i += 9) {
    await Promise.all(requests.slice(i, i + 9).map(([p, a]) => loadImage(p, a)));
    if (i === 0) {
      renderHud();
      renderSpeciesTools();
    }
  }
  renderHud();
  renderSpeciesTools();
}
function getImageMeta(p, stateName) {
  const meta = p.sprites[stateName] || p.sprites.Idle;
  const image = spriteMap.get(`${p.id}:${assetFor(p, stateName)}`) || spriteMap.get(`${p.id}:Idle`);
  return { image, meta };
}
function drawSmallSprite(dest, p, direction = 0) {
  if (!dest || !p) return;
  const c = dest.getContext('2d');
  c.clearRect(0, 0, dest.width, dest.height);
  const { image, meta } = getImageMeta(p, 'Idle');
  if (image?.naturalWidth) {
    const scale = Math.min((dest.width - 4) / meta.width, (dest.height - 4) / meta.height);
    const dirs = Math.floor(image.naturalHeight / meta.height);
    c.imageSmoothingEnabled = false;
    c.drawImage(image, 0, (dirs === 8 ? direction : 0) * meta.height, meta.width, meta.height, (dest.width - meta.width * scale) / 2, (dest.height - meta.height * scale) / 2, meta.width * scale, meta.height * scale);
  } else {
    c.fillStyle = p.color;
    c.beginPath();
    c.ellipse(dest.width / 2, dest.height / 2, dest.width * .25, dest.height * .28, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#18331e';
    c.font = 'bold 12px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(p.name.slice(0, 2).toUpperCase(), dest.width / 2, dest.height / 2);
  }
}

function ellipse(x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}
function line(x, y, toX, toY, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}
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
  ctx.save();
  ctx.fillStyle = 'rgba(43,112,174,.10)';
  ctx.fillRect(BOARD.x, BOARD.y + BOARD.playerFieldStart * BOARD.tile, BOARD.columns * BOARD.tile, BOARD.enemyRows * BOARD.tile);
  ctx.fillStyle = 'rgba(185,75,94,.10)';
  ctx.fillRect(BOARD.x, BOARD.y + BOARD.enemyFieldStart * BOARD.tile, BOARD.columns * BOARD.tile, BOARD.enemyRows * BOARD.tile);
  const showGrid = battle.phase === 'setup' && (drag || hovered);
  ctx.strokeStyle = showGrid ? 'rgba(238,255,214,.45)' : 'rgba(238,255,214,.18)';
  ctx.lineWidth = 1;
  for (let col = 0; col <= BOARD.columns; col++) line(BOARD.x + col * BOARD.tile, BOARD.y, BOARD.x + col * BOARD.tile, BOARD.y + BOARD.rows * BOARD.tile, ctx.strokeStyle);
  for (let row = 0; row <= BOARD.rows; row++) line(BOARD.x, BOARD.y + row * BOARD.tile, BOARD.x + BOARD.columns * BOARD.tile, BOARD.y + row * BOARD.tile, ctx.strokeStyle);
  if (hovered && battle.phase === 'setup') {
    const team = drag ? pointerTeamForCell(hovered) : teamPick;
    const isValid = isBenchCell(hovered) || validCellForTeam(team, hovered);
    ctx.fillStyle = isValid ? 'rgba(255,245,171,.24)' : 'rgba(255,90,105,.24)';
    ctx.fillRect(BOARD.x + hovered.col * BOARD.tile, BOARD.y + hovered.row * BOARD.tile, BOARD.tile, BOARD.tile);
  }
  ctx.font = '900 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f6ffe8';
  ctx.shadowColor = '#16371f';
  ctx.shadowBlur = 6;
  ctx.fillText('BANCO INIMIGO', BOARD.x + BOARD.columns * BOARD.tile / 2, BOARD.y - 18);
  ctx.fillText('INIMIGO', BOARD.x + BOARD.columns * BOARD.tile / 2, BOARD.y + BOARD.enemyFieldStart * BOARD.tile - 12);
  ctx.fillText('SEU CAMPO', BOARD.x + BOARD.columns * BOARD.tile / 2, BOARD.y + BOARD.playerBenchRow * BOARD.tile + 22);
  ctx.fillText('BANCO', BOARD.x - 46, BOARD.y + BOARD.playerBenchRow * BOARD.tile + 34);
  ctx.shadowBlur = 0;
  ctx.restore();
  for (let i = 0; i < 18; i++) {
    ellipse(BOARD.x + 20 + hash(i, 9) * (BOARD.columns * BOARD.tile - 40), BOARD.y + 20 + hash(9, i) * (BOARD.rows * BOARD.tile - 40), 1.3, 1.3, `rgba(255,247,183,${.18 + .16 * Math.sin(t + i)})`);
  }
}
function drawUnitSprite(type, x, y, stateName, facing, stateTime, castElapsed = 0, cast = null) {
  const { image, meta } = getImageMeta(type, stateName);
  if (image?.naturalWidth && meta) {
    const direction = Math.floor(image.naturalHeight / meta.height) === 8 ? facing : 0;
    const frame = getFrame(meta.durations, cast ? castElapsed : stateTime, !cast && stateName !== 'Hurt');
    const scale = clamp(64 / type.sprites.Idle.height, 1.18, 2.05);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, frame * meta.width, direction * meta.height, meta.width, meta.height, Math.round(x - meta.width * scale / 2), Math.round(y + 16 - meta.height * scale), Math.round(meta.width * scale), Math.round(meta.height * scale));
    ctx.imageSmoothingEnabled = true;
  } else {
    ellipse(x, y - 15, 24, 25, type.color);
    ctx.fillStyle = '#17331f';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(type.name.slice(0, 3).toUpperCase(), x, y + 2);
  }
}
function drawSetupUnit(mon) {
  const p = BY_ID[mon.speciesId];
  const pos = monWorld(mon);
  const color = mon.team === 0 ? '#72d2ff' : '#ff9cac';
  ellipse(pos.x, pos.y + 11, 30, 10, '#17371f88');
  ctx.save();
  ctx.strokeStyle = selectedId === mon.instanceId ? '#ffe177' : color;
  ctx.lineWidth = selectedId === mon.instanceId ? 3 : 2;
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 11, 29, 10, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  drawUnitSprite(p, pos.x, pos.y, 'Idle', mon.team ? 0 : 4, visualTime);
}
function drawShopGhost(activeDrag) {
  const p = BY_ID[state.shop[activeDrag.index] || activeDrag.speciesId];
  if (!p || !activeDrag.world) return;
  ctx.save();
  ctx.globalAlpha = .82;
  ellipse(activeDrag.world.x, activeDrag.world.y + 14, 30, 10, '#17371f88');
  drawUnitSprite(p, activeDrag.world.x, activeDrag.world.y, 'Idle', 4, visualTime);
  ctx.restore();
}
function drawBattleUnit(u) {
  if (u.dead) return;
  const color = u.team === 0 ? '#72d2ff' : '#ff9cac';
  ellipse(u.x, u.y + 11, u.radius + 9, 10, '#17371f88');
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = .88;
  ctx.beginPath();
  ctx.ellipse(u.x, u.y + 11, u.radius + 6, 10, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  if (u.hitFlash > 0) ellipse(u.x, u.y - 16, 37, 32, `rgba(255,250,210,${u.hitFlash * 1.9})`);
  drawUnitSprite(u.type, u.x, u.y, u.state, u.facing, u.stateTime, u.cast?.elapsed ?? 0, u.cast);
  const bw = 52;
  const bh = 7;
  const py = u.y - 72;
  const health = clamp(u.health / u.maxHealth, 0, 1);
  ctx.fillStyle = '#142b1cdd';
  ctx.fillRect(u.x - bw / 2, py, bw, bh);
  ctx.fillStyle = health > .35 ? '#87e26f' : '#ffbd66';
  ctx.fillRect(u.x - bw / 2 + 1, py + 1, (bw - 2) * health, bh - 2);
}
function drawEffects() {
  for (const p of battle.projectiles) {
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
  for (const e of battle.effects) {
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
  for (const f of battle.floaters) {
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, screen.w, screen.h);
  ctx.fillStyle = '#16351e';
  ctx.fillRect(0, 0, screen.w, screen.h);
  ctx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, dpr * camera.x, dpr * camera.y);
  drawBoard(visualTime);
  if (battle.phase === 'setup') {
    allUnits().slice().sort((a, b) => monWorld(a).y - monWorld(b).y).forEach(drawSetupUnit);
    if (drag?.kind === 'shop') drawShopGhost(drag);
    drawEvolutionEffects();
  } else {
    battle.units.filter(u => !u.dead).slice().sort((a, b) => a.y - b.y).forEach(drawBattleUnit);
    drawEffects();
  }
}
function frame(timestamp) {
  if (!lastFrame) lastFrame = timestamp;
  const dt = Math.min(.05, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp;
  visualTime += dt;
  updateCamera(dt);
  updateEvolutionEffects(dt);
  updateBattle(battle, dt);
  if (battle.phase === 'finished' && !resultAnnounced) {
    resultAnnounced = true;
    $('result-title').textContent = battle.winner === 0 ? 'Vitoria do seu time' : 'Derrota';
    $('result-note').textContent = 'Volte para preparação e ajuste as formações.';
    $('outcome').hidden = false;
    renderHud();
  }
  draw();
  requestAnimationFrame(frame);
}
function sizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  screen = { w: Math.max(320, rect.width), h: Math.max(320, rect.height) };
  dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  canvas.width = Math.round(screen.w * dpr);
  canvas.height = Math.round(screen.h * dpr);
  fitCamera();
}

$('start').addEventListener('click', beginBattle);
$('pause').addEventListener('click', togglePause);
$('prepare').addEventListener('click', prepareSameTeams);
$('again').addEventListener('click', prepareSameTeams);
$('zoom-in').addEventListener('click', () => zoomAt({ x:screen.w / 2, y:screen.h / 2 }, 1.15));
$('zoom-out').addEventListener('click', () => zoomAt({ x:screen.w / 2, y:screen.h / 2 }, .87));
$('camera-reset').addEventListener('click', fitCamera);
$('reroll-shop').addEventListener('click', () => { if (battle.phase === 'setup') refillShop(); });
$('sell-selected').addEventListener('click', () => {
  const mon = selectedMon();
  if (mon) removeUnit(mon, mon.team === 0);
});
$('pick-player')?.addEventListener('click', () => { teamPick = 0; deleteMode = false; renderTeamTools(); });
$('pick-enemy')?.addEventListener('click', () => { teamPick = 1; deleteMode = false; renderTeamTools(); });
$('delete-mode')?.addEventListener('click', () => { deleteMode = !deleteMode; renderTeamTools(); });
window.addEventListener('resize', sizeCanvas);

const starter = newMon('0004', 0);
const enemy = newMon('0007', 1);
placeBoard(starter, 0, { col:4, row:8 }, false);
placeBoard(enemy, 1, { col:5, row:3 }, false);
selectedId = starter.instanceId;
refillShop();
sizeCanvas();
renderSpeciesTools();
renderHud();
prepareSprites();
requestAnimationFrame(frame);
