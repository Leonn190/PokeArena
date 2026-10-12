import { BY_ID, getDirection } from './pokemon.mjs';
import { MOVES_BY_ID, initialLoadout, chooseMoveAnimation } from './moves.mjs';

export const BOARD = Object.freeze({ columns:10, rows:10, enemyRows:5, width:1000, height:720, tile:58, x:210, y:62 });
const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const worldBounds = {
  minX: BOARD.x + 10,
  maxX: BOARD.x + BOARD.columns * BOARD.tile - 10,
  minY: BOARD.y + 10,
  maxY: BOARD.y + BOARD.rows * BOARD.tile - 10
};
export const tilePosition = (col, row) => ({ x: BOARD.x + (col + .5) * BOARD.tile, y: BOARD.y + (row + .5) * BOARD.tile });
export function cellAtPixel(x, y) {
  const col = Math.floor((x - BOARD.x) / BOARD.tile);
  const row = Math.floor((y - BOARD.y) / BOARD.tile);
  return col >= 0 && col < BOARD.columns && row >= 0 && row < BOARD.rows ? { col, row } : null;
}
export const teamAtCell = row => row < BOARD.enemyRows ? 1 : 0;
export const validCellForTeam = (team, cell) => cell && (team === 1 ? cell.row < BOARD.enemyRows : cell.row >= BOARD.enemyRows);
export const maxActiveForRound = round => clamp(round, 1, 6);
export const ivMultiplier = iv => .8 + clamp(iv, 0, 100) / 100 * .4;
export function effectiveStats(pokemon, ivs = {}) {
  return Object.fromEntries(Object.entries(pokemon.stats).map(([key, value]) => [key, Math.round(value * ivMultiplier(ivs[key] ?? 50))]));
}
export const maxHealth = stats => 60 + stats.vida * 2;
export function moveSpeed(stats) { return 55 + stats.vel * .62; }
export function attackInterval(stats) { return clamp(1.58 - stats.vel * .0088, .46, 1.45); }
export function physicalOrSpecialDamage(attacker, defender, kind, random = Math.random, baseDamage = 30) {
  const a = attacker.stats[kind === 'atk' ? 'atk' : 'spa'];
  const d = defender.stats[kind === 'atk' ? 'def' : 'spd'];
  const type = typeMultiplier(attacker.type.type, defender.type.type);
  return Math.max(1, Math.round(baseDamage * (.62 + a / 105) * (100 / (80 + d)) * type * (.92 + random() * .16)));
}
function typeMultiplier(attackType, defendType) {
  if (attackType === 'Fogo' && defendType === 'Grama') return 1.25;
  if (attackType === 'Grama' && defendType === 'Água') return 1.25;
  if (attackType === 'Água' && defendType === 'Fogo') return 1.25;
  if (attackType === 'Fogo' && defendType === 'Água') return .8;
  if (attackType === 'Grama' && defendType === 'Fogo') return .8;
  if (attackType === 'Água' && defendType === 'Grama') return .8;
  return 1;
}
export function normalizeEntry(entry, team) {
  const cell = entry.cell ?? (Number.isInteger(entry.col) && Number.isInteger(entry.row) ? { col: entry.col, row: entry.row } : null);
  const fallback = tilePosition(team === 1 ? 4 : 5, team === 1 ? 2 : 7);
  const center = cell ? tilePosition(cell.col, cell.row) : fallback;
  const speciesId = entry.speciesId ?? entry.id;
  return {
    instanceId: entry.instanceId ?? entry.uid ?? crypto.randomUUID(),
    speciesId,
    team,
    x: entry.x ?? center.x,
    y: entry.y ?? center.y,
    col: cell?.col ?? clamp(Math.floor(((entry.x ?? center.x) - BOARD.x) / BOARD.tile), 0, 9),
    row: cell?.row ?? clamp(Math.floor(((entry.y ?? center.y) - BOARD.y) / BOARD.tile), 0, 9),
    ivs: { ...(entry.ivs ?? {}) },
    activeMoves: (entry.activeMoves?.length ? entry.activeMoves : initialLoadout(speciesId)).slice(0, 3),
    slots: clamp(entry.slots ?? entry.activeMoves?.length ?? 2, 2, 3)
  };
}
function makeUnits(lineups) {
  let order = 0;
  return lineups.flatMap((list, team) => list.map(entry => {
    const type = BY_ID[entry.speciesId];
    const stats = effectiveStats(type, entry.ivs);
    const hp = maxHealth(stats);
    return {
      uid: entry.instanceId,
      team,
      type,
      stats,
      ivs: entry.ivs,
      slots: entry.slots,
      activeMoves: entry.activeMoves.slice(0, entry.slots),
      x: entry.x,
      y: entry.y,
      col: entry.col,
      row: entry.row,
      health: hp,
      maxHealth: hp,
      dead: false,
      vx: 0,
      vy: 0,
      radius: clamp(12 + type.sprites.Idle.width * .24, 16, 28),
      state: 'Idle',
      stateTime: 0,
      facing: team === 0 ? 4 : 0,
      cooldown: .28 + order++ * .09,
      cast: null,
      hitFlash: 0,
      hurtTime: 0
    };
  }));
}
export function createBattle(lineups = [[], []]) {
  const clean = lineups.map((list, team) => list.map(entry => normalizeEntry(entry, team)));
  return { phase:'setup', elapsed:0, winner:null, lineups:clean, units:makeUnits(clean), projectiles:[], effects:[], floaters:[], events:[], kills:[0,0] };
}
export function syncLineups(b, lineups) {
  if (b.phase !== 'setup') return false;
  b.lineups = lineups.map((list, team) => list.map(entry => normalizeEntry(entry, team)));
  b.units = makeUnits(b.lineups);
  return true;
}
export function startBattle(b) {
  if (b.phase !== 'setup' || !b.lineups[0].length || !b.lineups[1].length) return false;
  b.phase = 'fighting';
  b.elapsed = 0;
  b.events = [{ type:'start' }];
  b.units = makeUnits(b.lineups);
  return true;
}
const alive = (b, team) => b.units.filter(u => !u.dead && u.team === team);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const edgeDistance = (a, b) => Math.max(0, dist(a, b) - a.radius - b.radius);
export const attackRangePixels = move => move.range * BOARD.tile;
export function effectiveAttackRange(unit, move) {
  const nominal = attackRangePixels(move);
  if (move.projectile) return nominal;
  const animation = chooseMoveAnimation(move, unit.type.sprites);
  const idle = unit.type.sprites.Idle;
  const attack = unit.type.sprites[animation];
  return attack && idle ? nominal + clamp(Math.max(attack.width - idle.width, attack.height - idle.height) * .22, 0, 18) : nominal;
}
const setState = (u, state) => { if (u.state !== state) { u.state = state; u.stateTime = 0; } };
function getTarget(b, u) { return alive(b, 1 - u.team).sort((a, z) => dist(a, u) - dist(z, u))[0] || null; }
function getMoves(u) { return u.activeMoves.map(m => MOVES_BY_ID[m]).filter(Boolean); }
function turnTowards(u, target) { u.facing = getDirection(target.x - u.x, target.y - u.y); }
function beginAttack(b, u, target, move) {
  const animation = chooseMoveAnimation(move, u.type.sprites);
  const meta = u.type.sprites[animation] || u.type.sprites.Attack;
  const durations = meta?.durations || [4, 4, 4, 4, 4];
  const natural = durations.reduce((s, n) => s + n, 0) / 60;
  const length = clamp(natural, .28, 1.15);
  const hitFrame = clamp(meta?.hitFrame ?? Math.floor(durations.length * .55), 0, durations.length - 1);
  const hitAt = clamp(durations.slice(0, hitFrame).reduce((s, n) => s + n, 0) / 60, .08, length * .92);
  u.cast = { moveId:move.id, animation, length, hitAt, elapsed:0, fired:false, targetId:target.uid };
  u.vx = 0; u.vy = 0; turnTowards(u, target); setState(u, animation);
}
function spawnProjectile(b, u, target, move) {
  const dx = target.x - u.x, dy = target.y - u.y;
  const length = Math.hypot(dx, dy) || 1;
  b.projectiles.push({
    owner:u.uid, target:target.uid, team:u.team, moveId:move.id,
    x:u.x + dx / length * (u.radius + 11), y:u.y - 18 + dy / length * 8,
    vx:dx / length, vy:dy / length, speed:move.projectileSpeed || 410,
    radius:move.category === 'atk' ? 6 : 9, color:move.color, life:1.8
  });
}
function applyHit(b, attacker, target, move, random) {
  if (target.dead) return;
  const damage = physicalOrSpecialDamage(attacker, target, move.category, random, move.damage);
  target.health = Math.max(0, target.health - damage);
  target.hitFlash = .20; target.hurtTime = .16;
  b.floaters.push({ x:target.x, y:target.y - 40, text:`-${damage}`, time:.85, total:.85, kind:move.category });
  b.effects.push({ x:target.x, y:target.y - 15, color:move.color, time:.35, total:.35, style:move.effect });
  b.events.push({ type:'attack', name:attacker.type.name, target:target.type.name, damage, move:move.name });
  if (target.health === 0) {
    target.dead = true; setState(target, 'Hurt'); b.kills[attacker.team]++;
    b.events.push({ type:'ko', name:target.type.name, by:attacker.type.name });
    if (!alive(b, target.team).length) { b.phase = 'finished'; b.winner = attacker.team; b.events.push({ type:'finish', winner:b.winner }); }
  }
}
function handleCast(b, u, dt, random) {
  const cast = u.cast, move = MOVES_BY_ID[cast.moveId];
  cast.elapsed += dt; u.vx = 0; u.vy = 0;
  if (!cast.fired && cast.elapsed >= cast.hitAt) {
    cast.fired = true;
    const target = b.units.find(z => z.uid === cast.targetId && !z.dead);
    if (target) {
      if (move.projectile && edgeDistance(u, target) <= effectiveAttackRange(u, move) + 35) spawnProjectile(b, u, target, move);
      else if (!move.projectile && edgeDistance(u, target) <= effectiveAttackRange(u, move) + 9) applyHit(b, u, target, move, random);
    }
  }
  if (cast.elapsed >= cast.length) {
    u.cast = null; setState(u, 'Idle'); u.cooldown = attackInterval(u.stats) * (.88 + random() * .24);
  }
}
function collideAndClamp(b, u) {
  u.x = clamp(u.x, worldBounds.minX + u.radius, worldBounds.maxX - u.radius);
  u.y = clamp(u.y, worldBounds.minY + u.radius, worldBounds.maxY - u.radius);
  for (const other of b.units) {
    if (other === u || other.dead) continue;
    const dx = u.x - other.x, dy = u.y - other.y;
    const r = u.radius + other.radius + 3, d = Math.hypot(dx, dy);
    if (d < r) {
      const angle = d > .001 ? Math.atan2(dy, dx) : (u.uid < other.uid ? 0 : Math.PI);
      const overlap = (r - d) * .5;
      u.x += Math.cos(angle) * overlap; u.y += Math.sin(angle) * overlap;
      if (!other.cast) { other.x -= Math.cos(angle) * overlap; other.y -= Math.sin(angle) * overlap; }
    }
  }
  u.x = clamp(u.x, worldBounds.minX + u.radius, worldBounds.maxX - u.radius);
  u.y = clamp(u.y, worldBounds.minY + u.radius, worldBounds.maxY - u.radius);
}
function moveToTarget(b, u, target, dt, ideal) {
  const dx = target.x - u.x, dy = target.y - u.y, d = Math.hypot(dx, dy) || 1;
  const edge = Math.max(0, d - u.radius - target.radius);
  let intensity = clamp((edge - ideal) / 25, -1, 1);
  if (Math.abs(intensity) < .25) intensity = 0;
  if (intensity === 0) { u.vx = 0; u.vy = 0; setState(u, 'Idle'); return; }
  const speed = moveSpeed(u.stats);
  const oldX = u.x, oldY = u.y;
  u.vx = dx / d * speed * intensity; u.vy = dy / d * speed * intensity;
  u.x += u.vx * dt; u.y += u.vy * dt;
  collideAndClamp(b, u);
  if (Math.hypot(u.x - oldX, u.y - oldY) > .03) { u.facing = getDirection(u.x - oldX, u.y - oldY); setState(u, 'Walk'); }
  else { u.vx = 0; u.vy = 0; setState(u, 'Idle'); }
}
export function updateBattle(b, seconds, random = Math.random) {
  const dt = clamp(seconds, 0, .05);
  b.events = [];
  for (const fx of [b.effects, b.floaters]) for (let i = fx.length - 1; i >= 0; i--) { fx[i].time -= dt; if (fx[i].time <= 0) fx.splice(i, 1); }
  for (const u of b.units) { u.stateTime += dt; u.hitFlash = Math.max(0, u.hitFlash - dt); u.hurtTime = Math.max(0, u.hurtTime - dt); }
  if (b.phase !== 'fighting') return b;
  b.elapsed += dt;
  for (const u of b.units) {
    if (u.dead) continue;
    if (u.cast) { handleCast(b, u, dt, random); continue; }
    if (u.hurtTime > 0) { u.vx = u.vy = 0; setState(u, 'Hurt'); continue; }
    const target = getTarget(b, u);
    if (!target) continue;
    const moves = getMoves(u);
    const inRange = moves.filter(m => edgeDistance(u, target) <= effectiveAttackRange(u, m));
    u.cooldown -= dt;
    if (u.cooldown <= 0 && inRange.length) {
      beginAttack(b, u, target, inRange[Math.floor(random() * inRange.length)]);
      continue;
    }
    moveToTarget(b, u, target, dt, Math.max(...moves.map(m => effectiveAttackRange(u, m))) * .72);
  }
  for (let i = b.projectiles.length - 1; i >= 0; i--) {
    const p = b.projectiles[i]; p.life -= dt;
    const target = b.units.find(u => u.uid === p.target && !u.dead);
    if (p.life <= 0 || !target) { b.projectiles.splice(i, 1); continue; }
    const dx = target.x - p.x, dy = target.y - 17 - p.y, d = Math.hypot(dx, dy), step = dt * p.speed;
    if (d < step + target.radius * .75) {
      b.projectiles.splice(i, 1);
      const owner = b.units.find(u => u.uid === p.owner);
      if (owner) applyHit(b, owner, target, MOVES_BY_ID[p.moveId], random);
    } else { p.vx = dx / d; p.vy = dy / d; p.x += p.vx * step; p.y += p.vy * step; }
    if (b.phase === 'finished') break;
  }
  return b;
}
export { TAU };
