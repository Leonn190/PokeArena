import { POKEMON, BY_ID, SHOP_IDS, EVOLVES_TO, getFrame, spritePath, spriteUrl, applySpriteManifest } from './pokemon.mjs';
import { MOVES_BY_ID, movePool, initialLoadout } from './moves.mjs';
import { BOARD, TAU, cellAtPixel, tilePosition, validCellForTeam, maxActiveForRound, effectiveStats, createBattle, syncLineups, startBattle, updateBattle } from './battle.mjs';

const $ = id => document.getElementById(id);
const canvas = $('arena');
const ctx = canvas.getContext('2d', { alpha:false });
const base = (canvas.dataset.base || '/').replace(/\/?$/, '/');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (x, y, z = 0) => {
  let v = Math.imul(x * 374761393 ^ y * 668265263 ^ z * 1274126177, 1597334677);
  v ^= v >>> 13; v = Math.imul(v, 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
};
const stageName = { 1:'Base', 2:'Evoluido', 3:'Final' };
const keys = ['vida', 'atk', 'def', 'spa', 'spd', 'vel'];
const spriteMap = new Map();
let idSeq = 1;
let battle = createBattle([[], []]);
let lastFrame = 0, visualTime = 0, lastHud = 0;
let selectedId = null, selectedMoveSlot = 0, enemyPick = '0004';
let hovered = null, drag = null, resultAnnounced = false;
const state = {
  round: 1,
  bench: Array(10).fill(null),
  playerBoard: [],
  enemyBoard: [],
  shop: []
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
    x: 0,
    y: 0,
    col: 0,
    row: team ? 2 : 7
  };
}
function currentLimit() { return maxActiveForRound(state.round); }
function allMons(team = 0) { return team ? state.enemyBoard : [...state.playerBoard, ...state.bench.filter(Boolean)]; }
function selectedMon() { return findMon(selectedId) || state.bench.find(Boolean) || state.playerBoard[0] || state.enemyBoard[0] || null; }
function findMon(id) { return [...state.playerBoard, ...state.enemyBoard, ...state.bench.filter(Boolean)].find(m => m.instanceId === id) || null; }
function boardList(team) { return team ? state.enemyBoard : state.playerBoard; }
function boardOccupant(team, col, row, except = null) {
  return boardList(team).find(m => m !== except && m.col === col && m.row === row);
}
function benchIndex(mon) { return state.bench.findIndex(m => m === mon); }
function boardIndex(mon) { return boardList(mon.team).indexOf(mon); }
function removeFromWherever(mon) {
  const b = benchIndex(mon);
  if (b >= 0) state.bench[b] = null;
  const list = boardList(mon.team);
  const i = list.indexOf(mon);
  if (i >= 0) list.splice(i, 1);
}
function placeInBench(mon, slot = -1) {
  if (!mon || mon.team !== 0 || battle.phase !== 'setup') return false;
  const target = slot >= 0 ? slot : state.bench.findIndex(Boolean.bind(null, false));
  const free = target >= 0 && target < 10 && !state.bench[target] ? target : state.bench.findIndex(v => !v);
  if (free < 0) { log('Banco cheio. Venda/mova uma unidade antes de comprar.', 'warn'); return false; }
  removeFromWherever(mon);
  mon.team = 0; state.bench[free] = mon; selectedId = mon.instanceId;
  sync(); renderHud(); return true;
}
function placeOnBoard(mon, team, cell) {
  if (!mon || battle.phase !== 'setup' || !validCellForTeam(team, cell)) return false;
  const list = boardList(team);
  if (mon.team !== team) mon.team = team;
  if (!list.includes(mon) && list.length >= currentLimit()) { log(`Limite ativo da rodada: ${currentLimit()} por time.`, 'warn'); return false; }
  if (boardOccupant(team, cell.col, cell.row, mon)) { log('Esse tile ja esta ocupado.', 'warn'); return false; }
  removeFromWherever(mon);
  const p = tilePosition(cell.col, cell.row);
  mon.team = team; mon.col = cell.col; mon.row = cell.row; mon.x = p.x; mon.y = p.y;
  list.push(mon); selectedId = mon.instanceId;
  sync(); renderHud(); return true;
}
function sync() {
  syncLineups(battle, [state.playerBoard, state.enemyBoard]);
}
function refillShop() {
  state.shop = Array.from({ length:6 }, () => SHOP_IDS[Math.floor(Math.random() * SHOP_IDS.length)]);
  renderHud();
}
function buyShop(index) {
  if (battle.phase !== 'setup') return;
  const speciesId = state.shop[index];
  const mon = newMon(speciesId, 0);
  if (placeInBench(mon)) {
    log(`Comprou ${BY_ID[speciesId].name} por ${BY_ID[speciesId].price} ouro.`);
    state.shop[index] = SHOP_IDS[Math.floor(Math.random() * SHOP_IDS.length)];
    evolveTeam(0);
    renderHud();
  }
}
function evolveTeam(team) {
  let evolved = false;
  for (;;) {
    const groups = new Map();
    for (const mon of allMons(team)) {
      if (!EVOLVES_TO[mon.speciesId]) continue;
      const list = groups.get(mon.speciesId) || [];
      list.push(mon); groups.set(mon.speciesId, list);
    }
    const found = [...groups.entries()].find(([, list]) => list.length >= 3);
    if (!found) break;
    const [speciesId, list] = found;
    const keep = list[0], consume = list.slice(1, 3);
    for (const mon of consume) removeFromWherever(mon);
    keep.speciesId = EVOLVES_TO[speciesId];
    keep.activeMoves = initialLoadout(keep.speciesId);
    keep.slots = 2;
    selectedId = keep.instanceId;
    evolved = true;
    log(`Tres ${BY_ID[speciesId].name} evoluiram para ${BY_ID[keep.speciesId].name}!`, 'good');
  }
  if (evolved) sync();
}
function rerollMove() {
  const mon = selectedMon();
  if (!mon || battle.phase !== 'setup') return;
  const pool = movePool(mon.speciesId);
  const choices = pool.filter(m => !mon.activeMoves.includes(m.id) || m.id === mon.activeMoves[selectedMoveSlot]);
  const current = mon.activeMoves[selectedMoveSlot];
  const next = choices.filter(m => m.id !== current);
  if (!next.length) return;
  mon.activeMoves[selectedMoveSlot] = next[Math.floor(Math.random() * next.length)].id;
  log(`${BY_ID[mon.speciesId].name} rerrolou um ataque por 2 ouro.`);
  sync(); renderHud();
}
function unlockMove() {
  const mon = selectedMon();
  if (!mon || battle.phase !== 'setup' || mon.slots >= 3) return;
  mon.slots = 3;
  const available = movePool(mon.speciesId).find(m => !mon.activeMoves.includes(m.id));
  if (available) mon.activeMoves.push(available.id);
  log(`${BY_ID[mon.speciesId].name} desbloqueou o terceiro ataque por 4 ouro.`);
  sync(); renderHud();
}
function beginBattle() {
  if (!state.playerBoard.length || !state.enemyBoard.length) { log('Coloque pelo menos um Pokémon em cada lado.', 'warn'); return; }
  if (startBattle(battle)) { resultAnnounced = false; $('outcome').hidden = true; renderHud(); log('Combate iniciado.'); }
}
function nextRound() {
  state.round++;
  battle = createBattle([state.playerBoard, state.enemyBoard]);
  resultAnnounced = false; $('outcome').hidden = true;
  refillShop(); renderHud(); log(`Rodada ${state.round}: limite ativo ${currentLimit()}.`, 'good');
}

function canvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x:(clientX - rect.left) * BOARD.width / rect.width, y:(clientY - rect.top) * BOARD.height / rect.height };
}
function hitUnit(p) {
  let hit = null, proximity = 42;
  for (const mon of [...state.playerBoard, ...state.enemyBoard]) {
    const d = Math.hypot(p.x - mon.x, p.y - mon.y + 14);
    if (d < proximity) { hit = mon; proximity = d; }
  }
  return hit;
}
function dropOnBench(clientX, clientY, mon) {
  const el = document.elementFromPoint(clientX, clientY)?.closest?.('.bench-slot');
  if (!el || !mon || mon.team !== 0) return false;
  return placeInBench(mon, Number(el.dataset.slot));
}
canvas.addEventListener('pointerdown', e => {
  if (battle.phase !== 'setup' || e.button !== 0) return;
  const p = canvasPoint(e.clientX, e.clientY);
  const hit = hitUnit(p);
  if (hit) {
    selectedId = hit.instanceId;
    drag = { kind:'unit', mon:hit, pointer:e.pointerId, start:p, last:p, moved:false };
  } else {
    const cell = cellAtPixel(p.x, p.y);
    if (cell?.row < BOARD.enemyRows) {
      const mon = newMon(enemyPick, 1);
      placeOnBoard(mon, 1, cell);
      evolveTeam(1);
    }
  }
  canvas.setPointerCapture(e.pointerId);
  renderHud();
});
canvas.addEventListener('pointermove', e => {
  const p = canvasPoint(e.clientX, e.clientY);
  hovered = battle.phase === 'setup' ? cellAtPixel(p.x, p.y) : null;
  if (drag?.pointer === e.pointerId) {
    drag.last = p;
    drag.moved = drag.moved || Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 6;
  }
});
canvas.addEventListener('pointerup', e => {
  if (!drag || drag.pointer !== e.pointerId) return;
  const d = drag; drag = null;
  if (battle.phase !== 'setup') return;
  const p = canvasPoint(e.clientX, e.clientY);
  const cell = cellAtPixel(p.x, p.y);
  if (dropOnBench(e.clientX, e.clientY, d.mon)) return;
  if (cell) placeOnBoard(d.mon, d.mon.team, cell);
});
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (battle.phase !== 'setup') return;
  const mon = hitUnit(canvasPoint(e.clientX, e.clientY));
  if (!mon) return;
  if (mon.team === 0) placeInBench(mon);
  else { removeFromWherever(mon); sync(); renderHud(); }
});

function makeBenchSlot(i) {
  const slot = document.createElement('button');
  slot.type = 'button'; slot.className = 'bench-slot'; slot.dataset.slot = String(i);
  slot.addEventListener('click', () => { const mon = state.bench[i]; if (mon) { selectedId = mon.instanceId; renderHud(); } });
  slot.addEventListener('pointerdown', e => {
    const mon = state.bench[i];
    if (!mon || battle.phase !== 'setup' || e.button !== 0) return;
    selectedId = mon.instanceId;
    drag = { kind:'bench', mon, pointer:e.pointerId, start:canvasPoint(e.clientX, e.clientY), last:canvasPoint(e.clientX, e.clientY), moved:false };
    slot.setPointerCapture(e.pointerId);
  });
  slot.addEventListener('pointermove', e => {
    if (drag?.pointer !== e.pointerId) return;
    const p = canvasPoint(e.clientX, e.clientY);
    drag.last = p; drag.moved = true; hovered = cellAtPixel(p.x, p.y);
  });
  slot.addEventListener('pointerup', e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const d = drag; drag = null;
    const p = canvasPoint(e.clientX, e.clientY);
    const cell = cellAtPixel(p.x, p.y);
    if (cell) placeOnBoard(d.mon, 0, cell);
  });
  return slot;
}
function renderHud() {
  $('round-label').textContent = String(state.round);
  $('limit-label').textContent = `${state.playerBoard.length}/${currentLimit()} / 6`;
  $('phase-label').textContent = battle.phase === 'setup' ? 'Preparação' : battle.phase === 'fighting' ? 'Combate' : 'Resultado';
  $('start').disabled = battle.phase !== 'setup' || !state.playerBoard.length || !state.enemyBoard.length;
  $('next-round').disabled = battle.phase === 'fighting';
  renderBench(); renderShop(); renderEnemyPicks(); renderDetails(); renderMoves();
}
function renderBench() {
  const row = $('bench-row');
  row.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const slot = makeBenchSlot(i), mon = state.bench[i], p = mon && BY_ID[mon.speciesId];
    if (mon && p) {
      slot.classList.add('filled');
      if (mon.instanceId === selectedId) slot.classList.add('selected');
      slot.innerHTML = `<canvas width="46" height="42" aria-hidden="true"></canvas><span>${p.name}</span><small>IV ${mon.iv}%</small>`;
      drawSmallSprite(slot.querySelector('canvas'), p, 0);
    } else slot.innerHTML = `<span class="slot-number">${i + 1}</span>`;
    row.appendChild(slot);
  }
}
function renderShop() {
  const slots = $('shop-slots');
  slots.innerHTML = state.shop.map((id, i) => {
    const p = BY_ID[id];
    return `<button type="button" class="shop-card" data-index="${i}"><span>${i < 2 ? 'Flex' : 'Mon'}</span><canvas width="48" height="44" aria-hidden="true"></canvas><b>${p.name}</b><small>${p.price} ouro</small></button>`;
  }).join('');
  slots.querySelectorAll('.shop-card').forEach(card => {
    const p = BY_ID[state.shop[Number(card.dataset.index)]];
    drawSmallSprite(card.querySelector('canvas'), p, 0);
    card.addEventListener('click', () => buyShop(Number(card.dataset.index)));
  });
}
function renderEnemyPicks() {
  const wrap = $('enemy-picks');
  wrap.innerHTML = SHOP_IDS.map(id => `<button type="button" class="${enemyPick === id ? 'picked' : ''}" data-id="${id}"><canvas width="38" height="34" aria-hidden="true"></canvas><span>${BY_ID[id].name}</span></button>`).join('');
  wrap.querySelectorAll('button').forEach(btn => {
    drawSmallSprite(btn.querySelector('canvas'), BY_ID[btn.dataset.id], 0);
    btn.addEventListener('click', () => { enemyPick = btn.dataset.id; renderEnemyPicks(); });
  });
}
function renderDetails() {
  const mon = selectedMon();
  if (!mon) return;
  const p = BY_ID[mon.speciesId], stats = effectiveStats(p, mon.ivs);
  selectedId = mon.instanceId;
  $('selected-number').textContent = `#${String(p.number).padStart(3, '0')}`;
  $('selected-name').textContent = p.name;
  $('selected-type').textContent = `${p.type} · ${stageName[p.stage]}`;
  $('selected-type').style.color = p.color;
  const place = state.bench.includes(mon) ? `Banco ${benchIndex(mon) + 1}` : mon.team ? `Inimigo ${mon.col + 1},${mon.row + 1}` : `Campo ${mon.col + 1},${mon.row - 4}`;
  $('selected-place').textContent = place;
  $('selected-iv').textContent = `IV geral ${mon.iv}%`;
  drawSmallSprite($('selected-avatar'), p, mon.team ? 0 : 4);
  $('stats-list').innerHTML = keys.map(k => {
    const baseValue = p.stats[k], value = stats[k], iv = mon.ivs[k];
    return `<div class="stat"><span>${k.toUpperCase()}</span><div><b>${value}</b><small>base ${baseValue} · IV ${iv}%</small></div></div>`;
  }).join('');
}
function renderMoves() {
  const mon = selectedMon();
  if (!mon) return;
  const box = $('moves-active');
  box.innerHTML = mon.activeMoves.slice(0, mon.slots).map((id, i) => {
    const m = MOVES_BY_ID[id];
    return `<button type="button" class="${selectedMoveSlot === i ? 'selected' : ''}" data-slot="${i}"><b>${m.name}</b><small>${m.category === 'atk' ? 'Fisico' : 'Especial'} · ${m.damage} · ${m.range.toFixed(1)}</small></button>`;
  }).join('');
  box.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { selectedMoveSlot = Number(btn.dataset.slot); renderMoves(); }));
  $('unlock-move').disabled = battle.phase !== 'setup' || mon.slots >= 3;
  $('reroll-move').disabled = battle.phase !== 'setup';
}
function log(text, kind = '') {
  const box = $('battle-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${kind}`;
  entry.textContent = text;
  box.prepend(entry);
  while (box.children.length > 8) box.lastElementChild.remove();
}

function assetFor(p, action) { return p.sprites[action]?.asset || action; }
async function loadImage(p, action) {
  const key = `${p.id}:${action}`;
  if (spriteMap.has(key)) return;
  const image = new Image(); image.decoding = 'async';
  await new Promise(resolve => {
    let remote = false;
    image.onload = () => { spriteMap.set(key, image); resolve(); };
    image.onerror = () => { if (remote) { resolve(); return; } remote = true; image.src = spriteUrl(p, action); };
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
    if (i === 0) renderHud();
  }
  renderHud();
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
    c.fillStyle = p.color; c.beginPath(); c.ellipse(dest.width / 2, dest.height / 2, dest.width * .25, dest.height * .28, 0, 0, TAU); c.fill();
    c.fillStyle = '#18331e'; c.font = `bold 12px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.name.slice(0, 2).toUpperCase(), dest.width / 2, dest.height / 2);
  }
}
function ellipse(x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
function line(x, y, toX, toY, color, width = 1) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(toX, toY); ctx.stroke(); }
function makeTerrain() {
  const temp = document.createElement('canvas'), c = temp.getContext('2d');
  temp.width = BOARD.width; temp.height = BOARD.height; c.imageSmoothingEnabled = false;
  c.fillStyle = '#18351f'; c.fillRect(0, 0, BOARD.width, BOARD.height);
  for (let y = 0; y < BOARD.height; y += 28) for (let x = 0; x < BOARD.width; x += 28) {
    c.fillStyle = hash(x, y) > .5 ? '#224a28' : '#1e4325'; c.fillRect(x, y, 28, 28);
  }
  c.fillStyle = '#6b9952'; c.fillRect(BOARD.x - 12, BOARD.y - 12, BOARD.columns * BOARD.tile + 24, BOARD.rows * BOARD.tile + 24);
  for (let row = 0; row < BOARD.rows; row++) for (let col = 0; col < BOARD.columns; col++) {
    const x = BOARD.x + col * BOARD.tile, y = BOARD.y + row * BOARD.tile;
    c.fillStyle = ['#7db44e', '#83ba55', '#76ab49'][Math.floor(hash(col, row) * 3)];
    c.fillRect(x, y, BOARD.tile, BOARD.tile);
    for (let j = 0; j < 16; j++) {
      const xx = x + hash(col * 40 + j, row, 17) * (BOARD.tile - 8) + 4;
      const yy = y + hash(col, row * 50 + j, 26) * (BOARD.tile - 8) + 5;
      c.strokeStyle = hash(j, col, row) > .48 ? '#609843' : '#a8cc75'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(xx, yy + 3); c.lineTo(xx - 2, yy); c.moveTo(xx + 1, yy + 3); c.lineTo(xx + 2, yy - 1); c.stroke();
    }
  }
  c.fillStyle = '#b9ce80'; c.fillRect(BOARD.x - 6, BOARD.y + BOARD.enemyRows * BOARD.tile - 3, BOARD.columns * BOARD.tile + 12, 6);
  c.strokeStyle = '#e1f0b7'; c.lineWidth = 2; c.strokeRect(BOARD.x - 1, BOARD.y - 1, BOARD.columns * BOARD.tile + 2, BOARD.rows * BOARD.tile + 2);
  return temp;
}
const terrain = makeTerrain();
function drawBoard(t) {
  ctx.drawImage(terrain, 0, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(43,112,174,.10)'; ctx.fillRect(BOARD.x, BOARD.y + BOARD.enemyRows * BOARD.tile, BOARD.columns * BOARD.tile, BOARD.enemyRows * BOARD.tile);
  ctx.fillStyle = 'rgba(185,75,94,.10)'; ctx.fillRect(BOARD.x, BOARD.y, BOARD.columns * BOARD.tile, BOARD.enemyRows * BOARD.tile);
  ctx.strokeStyle = 'rgba(238,255,214,.30)'; ctx.lineWidth = 1;
  for (let col = 0; col <= BOARD.columns; col++) line(BOARD.x + col * BOARD.tile, BOARD.y, BOARD.x + col * BOARD.tile, BOARD.y + BOARD.rows * BOARD.tile, ctx.strokeStyle);
  for (let row = 0; row <= BOARD.rows; row++) line(BOARD.x, BOARD.y + row * BOARD.tile, BOARD.x + BOARD.columns * BOARD.tile, BOARD.y + row * BOARD.tile, ctx.strokeStyle);
  if (hovered && battle.phase === 'setup') {
    const ok = validCellForTeam(hovered.row < BOARD.enemyRows ? 1 : 0, hovered);
    ctx.fillStyle = ok ? 'rgba(255,255,205,.24)' : 'rgba(255,90,105,.24)';
    ctx.fillRect(BOARD.x + hovered.col * BOARD.tile, BOARD.y + hovered.row * BOARD.tile, BOARD.tile, BOARD.tile);
  }
  ctx.font = '900 12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#f6ffe8'; ctx.shadowColor = '#16371f'; ctx.shadowBlur = 6;
  ctx.fillText('INIMIGO', BOARD.x + BOARD.columns * BOARD.tile / 2, BOARD.y - 18);
  ctx.fillText('SEU TABULEIRO', BOARD.x + BOARD.columns * BOARD.tile / 2, BOARD.y + BOARD.rows * BOARD.tile + 24);
  ctx.restore();
  for (let i = 0; i < 18; i++) ellipse(BOARD.x + 20 + hash(i, 9) * (BOARD.columns * BOARD.tile - 40), BOARD.y + 20 + hash(9, i) * (BOARD.rows * BOARD.tile - 40), 1.3, 1.3, `rgba(255,247,183,${.18 + .16 * Math.sin(t + i)})`);
}
function drawUnit(u) {
  if (u.dead) return;
  let x = u.x, y = u.y;
  if (drag?.mon?.instanceId === u.uid && drag.moved) {
    const cell = cellAtPixel(drag.last.x, drag.last.y);
    if (cell) { const p = tilePosition(cell.col, cell.row); x = p.x; y = p.y; }
  }
  const color = u.team === 0 ? '#72d2ff' : '#ff9cac';
  ellipse(x, y + 11, u.radius + 9, 10, '#17371f88');
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = .88; ctx.beginPath(); ctx.ellipse(x, y + 11, u.radius + 6, 10, 0, 0, TAU); ctx.stroke(); ctx.restore();
  if (u.hitFlash > 0) ellipse(x, y - 16, 37, 32, `rgba(255,250,210,${u.hitFlash * 1.9})`);
  const { image, meta } = getImageMeta(u.type, u.state);
  if (image?.naturalWidth && meta) {
    const direction = Math.floor(image.naturalHeight / meta.height) === 8 ? u.facing : 0;
    const frame = getFrame(meta.durations, u.cast ? u.cast.elapsed : u.stateTime, !u.cast && u.state !== 'Hurt');
    const scale = clamp(64 / u.type.sprites.Idle.height, 1.18, 2.05);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, frame * meta.width, direction * meta.height, meta.width, meta.height, Math.round(x - meta.width * scale / 2), Math.round(y + 16 - meta.height * scale), Math.round(meta.width * scale), Math.round(meta.height * scale));
    ctx.imageSmoothingEnabled = true;
  } else {
    ellipse(x, y - 15, 24, 25, u.type.color);
    ctx.fillStyle = '#17331f'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(u.type.name.slice(0, 3).toUpperCase(), x, y + 2);
  }
  const bw = 52, bh = 7, py = y - 72, health = clamp(u.health / u.maxHealth, 0, 1);
  ctx.fillStyle = '#142b1cdd'; ctx.fillRect(x - bw / 2, py, bw, bh);
  ctx.fillStyle = health > .35 ? '#87e26f' : '#ffbd66'; ctx.fillRect(x - bw / 2 + 1, py + 1, (bw - 2) * health, bh - 2);
  ctx.fillStyle = '#fffbea'; ctx.textAlign = 'center'; ctx.font = 'bold 10px system-ui'; ctx.shadowColor = '#1b4022'; ctx.shadowBlur = 4; ctx.fillText(u.type.name, x, y + 28); ctx.shadowBlur = 0;
}
function drawEffects() {
  for (const p of battle.projectiles) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.globalAlpha = .24; ellipse(-13, 0, 20, 8, p.color); ctx.globalAlpha = 1;
    const m = MOVES_BY_ID[p.moveId];
    ellipse(0, 0, 15, 7, m?.color || '#fff'); ellipse(4, 0, 7, 4, '#f8fdff'); ctx.restore();
  }
  for (const e of battle.effects) {
    const a = 1 - e.time / e.total; ctx.save(); ctx.globalAlpha = 1 - a;
    for (let j = 0; j < 7; j++) {
      const angle = TAU * j / 7, r = 8 + a * 33;
      line(e.x + Math.cos(angle) * r * .4, e.y + Math.sin(angle) * r * .4, e.x + Math.cos(angle) * r, e.y + Math.sin(angle) * r, e.color, 3);
    }
    ctx.restore();
  }
  for (const f of battle.floaters) {
    const a = 1 - f.time / f.total; ctx.save(); ctx.globalAlpha = Math.min(1, f.time * 4); ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.shadowColor = '#17371f'; ctx.shadowBlur = 4; ctx.fillStyle = f.kind === 'atk' ? '#fff0aa' : '#e4f7ff'; ctx.fillText(f.text, f.x, f.y - a * 34); ctx.restore();
  }
}
function processEvents(events) {
  for (const ev of events) {
    if (ev.type === 'attack' && Math.random() < .22) log(`${ev.name} usou ${ev.move}.`);
    if (ev.type === 'ko') log(`${ev.name} caiu para ${ev.by}.`, 'warn');
    if (ev.type === 'finish') log(ev.winner === 0 ? 'Seu time venceu!' : 'O inimigo venceu.', ev.winner === 0 ? 'good' : 'warn');
  }
}
function draw(t) {
  ctx.clearRect(0, 0, BOARD.width, BOARD.height);
  drawBoard(t);
  battle.units.filter(u => !u.dead).slice().sort((a, b) => a.y - b.y).forEach(drawUnit);
  drawEffects();
}
function frame(timestamp) {
  if (!lastFrame) lastFrame = timestamp;
  const dt = Math.min(.05, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp; visualTime += dt;
  updateBattle(battle, dt);
  if (battle.events.length) processEvents(battle.events);
  if (battle.phase === 'finished' && !resultAnnounced) {
    resultAnnounced = true;
    $('result-title').textContent = battle.winner === 0 ? 'Vitoria do seu time' : 'Derrota';
    $('result-note').textContent = battle.winner === 0 ? 'A arena esta pronta para a proxima rodada.' : 'Ajuste banco, loja e inimigos antes de tentar de novo.';
    $('outcome').hidden = false;
  }
  draw(visualTime);
  if (timestamp - lastHud > 180) {
    const total = Math.floor(battle.elapsed);
    $('clock').textContent = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    renderHud(); lastHud = timestamp;
  }
  requestAnimationFrame(frame);
}
function sizeCanvas() {
  const scale = clamp(window.devicePixelRatio || 1, 1, 2);
  const w = Math.round(BOARD.width * scale), h = Math.round(BOARD.height * scale);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; ctx.setTransform(scale, 0, 0, scale, 0, 0); }
}

$('start').addEventListener('click', beginBattle);
$('next-round').addEventListener('click', nextRound);
$('again').addEventListener('click', nextRound);
$('reroll-shop').addEventListener('click', () => { if (battle.phase === 'setup') { refillShop(); log('Loja atualizada por 2 ouro.'); } });
$('reroll-move').addEventListener('click', rerollMove);
$('unlock-move').addEventListener('click', unlockMove);
window.addEventListener('resize', sizeCanvas);

const first = newMon('0004', 0);
const enemy = newMon('0007', 1);
placeOnBoard(first, 0, { col:4, row:7 });
placeOnBoard(enemy, 1, { col:5, row:2 });
selectedId = first.instanceId;
refillShop();
sizeCanvas();
renderHud();
prepareSprites();
requestAnimationFrame(frame);
