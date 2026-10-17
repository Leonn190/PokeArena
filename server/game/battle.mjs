import { BY_ID, getDirection } from './pokemon.mjs';
import { RULES } from './rules.mjs';
import { MOVES_BY_ID, initialLoadout, validLoadout, abilityForPokemon, chooseMoveAnimation } from './moves.mjs';
import { chooseCombatTarget } from './ai.mjs';
import {structureModifiers} from './structures.mjs';
import {effectiveUnitStats,individualIVs,meanIV,normalizedLevel,applyStructureStats,ivMultiplier} from './stats.mjs';
export {effectiveUnitStats,ivMultiplier} from './stats.mjs';
// Mantém a exportação usada por integrações anteriores, agora com a mesma regra de IV.
export const effectiveStats=(pokemon,iv=50)=>effectiveUnitStats(pokemon,{iv,level:0});

export const BOARD = Object.freeze({
  columns: 10,
  fieldRows: 10,
  enemyRows: 5,
  enemyBenchRow: 0,
  enemyFieldStart: 1,
  playerFieldStart: 6,
  playerBenchRow: 11,
  rows: 12,
  width: 1000,
  height: 820,
  tile: 58,
  x: 210,
  y: 58
});
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fieldBounds = {
  minX: BOARD.x + 10,
  maxX: BOARD.x + BOARD.columns * BOARD.tile - 10,
  minY: BOARD.y + BOARD.enemyFieldStart * BOARD.tile + 10,
  maxY: BOARD.y + BOARD.playerBenchRow * BOARD.tile - 10
};

export const TAU = Math.PI * 2;
export const tilePosition = (col, row) => ({ x: BOARD.x + (col + .5) * BOARD.tile, y: BOARD.y + (row + .5) * BOARD.tile });
export function cellAtWorld(x, y) {
  const col = Math.floor((x - BOARD.x) / BOARD.tile);
  const row = Math.floor((y - BOARD.y) / BOARD.tile);
  return col >= 0 && col < BOARD.columns && row >= 0 && row < BOARD.rows ? { col, row } : null;
}
export const isBenchCell = cell => cell?.row === BOARD.enemyBenchRow || cell?.row === BOARD.playerBenchRow;
export const benchTeamForCell = cell => cell?.row === BOARD.enemyBenchRow ? 1 : cell?.row === BOARD.playerBenchRow ? 0 : null;
export const validCellForTeam = (team, cell) => !!cell && (team === 1
  ? cell.row >= BOARD.enemyFieldStart && cell.row < BOARD.enemyFieldStart + BOARD.enemyRows
  : cell.row >= BOARD.playerFieldStart && cell.row < BOARD.playerBenchRow);
export const maxHealth = (stats,hpScale=1) => 60*hpScale + stats.vida * 2;
export const moveSpeed = stats => 55 + stats.vel * .62;
export const attackInterval = stats => clamp(1.58 - stats.vel * .0088, .46, 1.45);

// Tabela canônica dos 18 tipos: efeitos dos tipos de ataque contra defensores.
// O catálogo de golpes ainda só utiliza Normal. Não libera golpes adicionais.
const TYPE_EFFECTIVENESS = Object.freeze({
  Normal:{Pedra:.5,Aço:.5,Fantasma:0},
  Fogo:{Fogo:.5,Água:.5,Grama:2,Gelo:2,Inseto:2,Pedra:.5,Dragão:.5,Aço:2},
  Água:{Fogo:2,Água:.5,Grama:.5,Terrestre:2,Pedra:2,Dragão:.5},
  Elétrico:{Água:2,Elétrico:.5,Grama:.5,Terrestre:0,Voador:2,Dragão:.5},
  Grama:{Fogo:.5,Água:2,Grama:.5,Venenoso:.5,Terrestre:2,Voador:.5,Inseto:.5,Pedra:2,Dragão:.5,Aço:.5},
  Gelo:{Fogo:.5,Água:.5,Grama:2,Gelo:.5,Terrestre:2,Voador:2,Dragão:2,Aço:.5},
  Lutador:{Normal:2,Gelo:2,Venenoso:.5,Voador:.5,Psíquico:.5,Inseto:.5,Pedra:2,Fantasma:0,Sombrio:2,Aço:2,Fada:.5},
  Venenoso:{Grama:2,Venenoso:.5,Terrestre:.5,Pedra:.5,Fantasma:.5,Aço:0,Fada:2},
  Terrestre:{Fogo:2,Elétrico:2,Grama:.5,Venenoso:2,Voador:0,Inseto:.5,Pedra:2,Aço:2},
  Voador:{Elétrico:.5,Grama:2,Lutador:2,Inseto:2,Pedra:.5,Aço:.5},
  Psíquico:{Lutador:2,Venenoso:2,Psíquico:.5,Sombrio:0,Aço:.5},
  Inseto:{Fogo:.5,Grama:2,Lutador:.5,Venenoso:.5,Voador:.5,Psíquico:2,Fantasma:.5,Sombrio:2,Aço:.5,Fada:.5},
  Pedra:{Fogo:2,Gelo:2,Lutador:.5,Terrestre:.5,Voador:2,Inseto:2,Aço:.5},
  Fantasma:{Normal:0,Psíquico:2,Fantasma:2,Sombrio:.5},
  Dragão:{Dragão:2,Aço:.5,Fada:0},
  Sombrio:{Lutador:.5,Psíquico:2,Fantasma:2,Sombrio:.5,Fada:.5},
  Aço:{Fogo:.5,Água:.5,Elétrico:.5,Gelo:2,Pedra:2,Aço:.5,Fada:2},
  Fada:{Fogo:.5,Lutador:2,Venenoso:.5,Dragão:2,Sombrio:2,Aço:.5}
});
export function typeMultiplier(attackType, defendingTypes) {
  const types=Array.isArray(defendingTypes)?defendingTypes:[defendingTypes];
  return types.reduce((mult,type)=>mult*(TYPE_EFFECTIVENESS[attackType]?.[type]??1),1);
}
export function physicalOrSpecialDamage(attacker, defender, kind, random = Math.random, baseDamage = 30, attackType = 'Normal') {
  const a = attacker.stats[kind === 'atk' ? 'atk' : 'spa'];
  const d = defender.stats[kind === 'atk' ? 'def' : 'spd'];
  const multiplier = typeMultiplier(attackType, defender.type.types) * (1+(attacker.environmentMods?.damage||0));
  if (multiplier === 0) return 0;
  return Math.max(1, Math.round(baseDamage * (.62 + a / 105) * (100 / (80 + d)) * multiplier * (.92 + random() * .16)));
}
export function normalizeEntry(entry, team) {
  const speciesId = entry.speciesId ?? entry.id;
  const col = clamp(entry.col ?? (team ? 5 : 4), 0, 19);
  const row = clamp(entry.row ?? (team ? 3 : 8), 0, BOARD.rows - 1);
  const p = tilePosition(col, row);
  return {
    instanceId: entry.instanceId ?? entry.uid ?? crypto.randomUUID(),
    speciesId,
    team,
    // A posição em grid prevalece: compras e espelhamento não trazem x/y da reserva.
    x: p.x,
    y: p.y,
    col,
    row,
    iv: meanIV(entry),
    ivs: individualIVs(entry),
    level:normalizedLevel(entry.level),
    bossIv:entry.bossIv||0,
    pveModifiers:entry.pveModifiers?{...entry.pveModifiers}:null,
    zygardeProgress: entry.zygardeProgress ?? 0,
    purchaseCost: entry.purchaseCost,
    provenance: entry.provenance?.map(part=>({...part})),
    evolutionSteps: entry.evolutionSteps ?? 0,
    babyPerfect: entry.babyPerfect ?? false,
    activeMoves: validLoadout(speciesId,entry.activeMoves||initialLoadout(speciesId)),
    abilityId:abilityForPokemon(speciesId),
    slots: 2
  };
}
function makeUnits(lineups,environment=[{},{}]) {
  let order = 0;
  return lineups.flatMap((list, team) => list.map(entry => {
    const type = BY_ID[entry.speciesId];
    const rawStats = effectiveUnitStats(type,entry);
    const stats = {...rawStats};
    const start={type,x:entry.x,y:entry.y};
    const structures=structureModifiers(environment,start);
    Object.assign(stats,applyStructureStats(rawStats,structures));
    const hpScale=entry.pveModifiers?.hp||1;
    const hp = Math.round(maxHealth(stats,hpScale));
    return {
      uid: entry.instanceId,
      team,
      type,
      stats,
      baseStats:rawStats,
      environmentMods:structures,
      hpScale,
      iv: entry.iv,
      ivs: entry.ivs,
      level: entry.level,
      slots: entry.slots,
      activeMoves: validLoadout(entry.speciesId,entry.activeMoves),
      abilityId:abilityForPokemon(entry.speciesId),
      energy:0,energyRegen:stats.energia,regeneration:stats.regeneracao,
      maxEnergy:MOVES_BY_ID[entry.activeMoves[1]]?.energyCost||4,
      x: entry.x,
      y: entry.y,
      col: entry.col,
      row: entry.row,
      health: hp,
      damageDealt: 0,
      maxHealth: hp,
      dead: false,
      vx: 0,
      vy: 0,
      radius: type.collisionRadius ?? 18,
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
export function createBattle(lineups = [[], []],environment=[{},{}]) {
  const clean = lineups.map((list, team) => list.map(entry => normalizeEntry(entry, team)));
  const columns=lineups.length===4?20:10;
  return { phase:'setup', paused:false, elapsed:0, winner:null, columns,bounds:{...fieldBounds,maxX:BOARD.x+columns*BOARD.tile-10},eliminatedAt:{},ranking:[],environment, lineups:clean, units:makeUnits(clean,environment), projectiles:[], effects:[], floaters:[], events:[], kills:lineups.map(()=>0) };
}
export function syncLineups(b, lineups) {
  if (b.phase !== 'setup') return false;
  b.lineups = lineups.map((list, team) => list.map(entry => normalizeEntry(entry, team)));
  b.units = makeUnits(b.lineups,b.environment);
  return true;
}
export function startBattle(b) {
  if (b.phase !== 'setup') return false;
  b.phase = 'fighting';
  b.paused = false;
  b.elapsed = 0;
  b.events = [{ type:'start' }];
  b.kills = b.lineups.map(()=>0);
  b.projectiles = [];
  b.effects = [];
  b.floaters = [];
  b.units = makeUnits(b.lineups,b.environment);
  resolveBattle(b);
  return true;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const edgeDistance = (a, b) => Math.max(0, dist(a, b) - a.radius - b.radius);
export const attackRangePixels = move => move.range * BOARD.tile;
export function effectiveAttackRange(_unit, move) {
  // Nunca derivar alcance do tamanho da imagem ou da animação.
  return attackRangePixels(move);
}
const setState = (u, state) => { if (u.state !== state) { u.state = state; u.stateTime = 0; } };
function getTarget(b, u, moves = getMoves(u)) { return chooseCombatTarget(u,b.units.filter(other=>!other.dead&&other.team!==u.team),moves,BOARD.tile); }
function getMoves(u) { return u.activeMoves.map(m => MOVES_BY_ID[m]).filter(Boolean); }
function beginAttack(b, u, target, move) {
  const animation = chooseMoveAnimation(move, u.type.sprites);
  const meta = u.type.sprites[animation] || u.type.sprites.Attack;
  const durations = meta?.durations || [4, 4, 4, 4, 4];
  const natural = durations.reduce((s, n) => s + n, 0) / 60;
  const length = clamp(natural, .28, 1.15);
  const hitFrame = clamp(meta?.hitFrame ?? Math.floor(durations.length * .55), 0, durations.length - 1);
  const hitAt = clamp(durations.slice(0, hitFrame).reduce((s, n) => s + n, 0) / 60, .08, length * .92);
  if(move.kind==='charged')u.energy=Math.max(0,u.energy-move.energyCost);
  u.cast = { moveId:move.id, animation, length, hitAt, elapsed:0, fired:false, targetId:target.uid };
  u.vx = 0;
  u.vy = 0;
  u.facing = getDirection(target.x - u.x, target.y - u.y);
  setState(u, animation);
}
function spawnProjectile(b, u, target, move) {
  const dx = target.x - u.x;
  const dy = target.y - u.y;
  const length = Math.hypot(dx, dy) || 1;
  b.projectiles.push({
    owner:u.uid,
    target:target.uid,
    team:u.team,
    moveId:move.id,
    x:u.x + dx / length * (u.radius + 11),
    y:u.y - 18 + dy / length * 8,
    vx:dx / length,
    vy:dy / length,
    speed:move.projectileSpeed || 410,
    radius:move.category === 'atk' ? 6 : 9,
    color:move.color,
    life:1.8
  });
}
function applyHit(b, attacker, target, move, random) {
  if (target.dead) return;
  const damage = physicalOrSpecialDamage(attacker, target, move.category, random, move.damage, move.type);
  attacker.damageDealt += Math.min(target.health,damage);
  target.health = Math.max(0, target.health - damage);
  target.hitFlash = .20;
  target.hurtTime = .16;
  b.floaters.push({ x:target.x, y:target.y - 40, text:`-${damage}`, time:.85, total:.85, kind:move.category });
  b.effects.push({ x:target.x, y:target.y - 15, color:move.color, time:.35, total:.35, style:move.effect });
  b.events.push({ type:'attack', name:attacker.type.name, target:target.type.name, damage, move:move.name });
  if (target.health === 0) {
    target.dead = true;
    setState(target, 'Hurt');
    b.kills[attacker.team]++;
    b.events.push({ type:'ko', name:target.type.name, by:attacker.type.name });
  }
}
function handleCast(b, u, dt, random) {
  const cast = u.cast;
  const move = MOVES_BY_ID[cast.moveId];
  cast.elapsed += dt;
  u.vx = 0;
  u.vy = 0;
  if (!cast.fired && cast.elapsed >= cast.hitAt) {
    cast.fired = true;
    const target = b.units.find(z => z.uid === cast.targetId && !z.dead);
    if (target) {
      if (move.projectile && edgeDistance(u, target) <= effectiveAttackRange(u, move) + 35) spawnProjectile(b, u, target, move);
      else if (!move.projectile && edgeDistance(u, target) <= effectiveAttackRange(u, move) + 9) applyHit(b, u, target, move, random);
    }
  }
  if (cast.elapsed >= cast.length) {
    u.cast = null;
    setState(u, 'Idle');
    u.cooldown = attackInterval(u.stats) / (1+(u.environmentMods?.attackSpeed||0)) * (.88 + random() * .24);
  }
}
function collideAndClamp(b, u) {
  const fieldBounds=b.bounds;
  u.x = clamp(u.x, fieldBounds.minX + u.radius, fieldBounds.maxX - u.radius);
  u.y = clamp(u.y, fieldBounds.minY + u.radius, fieldBounds.maxY - u.radius);
  for (const other of b.units) {
    if (other === u || other.dead) continue;
    const dx = u.x - other.x;
    const dy = u.y - other.y;
    const r = u.radius + other.radius + 3;
    const d = Math.hypot(dx, dy);
    if (d < r) {
      const angle = d > .001 ? Math.atan2(dy, dx) : (u.uid < other.uid ? 0 : Math.PI);
      const overlap = (r - d) * .5;
      u.x += Math.cos(angle) * overlap;
      u.y += Math.sin(angle) * overlap;
      if (!other.cast) {
        other.x -= Math.cos(angle) * overlap;
        other.y -= Math.sin(angle) * overlap;
      }
    }
  }
  u.x = clamp(u.x, fieldBounds.minX + u.radius, fieldBounds.maxX - u.radius);
  u.y = clamp(u.y, fieldBounds.minY + u.radius, fieldBounds.maxY - u.radius);
}
function moveToTarget(b, u, target, dt, ideal) {
  const dx = target.x - u.x;
  const dy = target.y - u.y;
  const d = Math.hypot(dx, dy) || 1;
  const edge = Math.max(0, d - u.radius - target.radius);
  const intensity = clamp((edge - ideal) / Math.max(1,moveSpeed(u.stats)*dt), 0, 1);
  if (intensity === 0) {
    u.vx = 0;
    u.vy = 0;
    setState(u, 'Idle');
    return;
  }
  const oldX = u.x;
  const oldY = u.y;
  const speed = moveSpeed(u.stats) * (1+(u.environmentMods?.moveSpeed||0));
  u.vx = dx / d * speed * intensity;
  u.vy = dy / d * speed * intensity;
  u.x += u.vx * dt;
  u.y += u.vy * dt;
  collideAndClamp(b, u);
  if (Math.hypot(u.x - oldX, u.y - oldY) > .03) {
    u.facing = getDirection(u.x - oldX, u.y - oldY);
    setState(u, 'Walk');
  } else {
    u.vx = 0;
    u.vy = 0;
    setState(u, 'Idle');
  }
}
// Eliminações no mesmo passo usam estado agregado, dano e índice estável como desempate.
function resolveBattle(b,timeout=false) {
  const scores=b.lineups.map((_,team)=>{
    const units=b.units.filter(u=>u.team===team),live=units.filter(u=>!u.dead);
    if(!live.length&&b.eliminatedAt[team]===undefined)b.eliminatedAt[team]=b.elapsed;
    return {team,live:live.length,ratio:units.reduce((s,u)=>s+u.health,0)/Math.max(1,units.reduce((s,u)=>s+u.maxHealth,0)),damage:units.reduce((s,u)=>s+u.damageDealt,0),time:b.eliminatedAt[team]??Infinity};
  });
  if(!timeout&&scores.filter(s=>s.live>0).length>1)return;
  scores.sort((a,c)=>c.time-a.time||c.ratio-a.ratio||c.live-a.live||c.damage-a.damage||a.team-c.team);
  b.ranking=scores.map(s=>s.team);b.phase='finished';
  b.winner=b.lineups.length===2&&Math.abs(scores[0].ratio-scores[1].ratio)<1e-6?null:scores[0].team;
  b.events.push({type:'finish',winner:b.winner,reason:timeout?'timeout':'elimination'});
}
export function updateBattle(b, seconds, random = Math.random) {
  const dt = clamp(seconds, 0, .05);
  b.events = [];
  for (const fx of [b.effects, b.floaters]) {
    for (let i = fx.length - 1; i >= 0; i--) {
      fx[i].time -= dt;
      if (fx[i].time <= 0) fx.splice(i, 1);
    }
  }
  for (const u of b.units) {
    // Distância à estrutura é avaliada com a posição atual: reforço local 1,5×.
    const structural=structureModifiers(b.environment,u);
    u.environmentMods=structural;
    Object.assign(u.stats,applyStructureStats(u.baseStats,structural));
    u.energyRegen=u.stats.energia;u.regeneration=u.stats.regeneracao;
    const nextMax=Math.round(maxHealth(u.stats,u.hpScale));
    if(nextMax!==u.maxHealth) {u.health=Math.min(nextMax,u.health*(nextMax/u.maxHealth));u.maxHealth=nextMax;}
    if(!u.dead&&b.phase==='fighting') {
      const regen=u.regeneration+(u.environmentMods?.regen||0)*u.maxHealth;
      if(regen)u.health=Math.min(u.maxHealth,u.health+regen*dt);
      u.energy=Math.min(u.maxEnergy,u.energy+u.energyRegen*dt);
    }
    u.stateTime += dt;
    u.hitFlash = Math.max(0, u.hitFlash - dt);
    u.hurtTime = Math.max(0, u.hurtTime - dt);
  }
  if (b.phase !== 'fighting' || b.paused) return b;
  b.elapsed += dt;
  if (b.elapsed >= RULES.battleSeconds - 1e-6) {
    resolveBattle(b,true);
    return b;
  }
  for (const u of b.units) {
    if (u.dead) continue;
    if (u.cast) {
      handleCast(b, u, dt, random);
      continue;
    }
    if (u.hurtTime > 0) {
      u.vx = 0;
      u.vy = 0;
      setState(u, 'Hurt');
      continue;
    }
    const [regular,charged]=getMoves(u);
    const chargedReady=!!charged&&u.energy+1e-6>=charged.energyCost;
    // Com energia cheia o carregado é obrigatório: inclusive quando ele
    // exige caminhar até ficar ao alcance. Não usa regulares nesse intervalo.
    const selectedMove=chargedReady?charged:regular;
    const target=getTarget(b,u,[selectedMove]);
    u.targetId=target?.uid||null;
    if(!target||!selectedMove){u.vx=0;u.vy=0;setState(u,'Idle');continue;}
    const inRange=edgeDistance(u,target)<=effectiveAttackRange(u,selectedMove);
    u.cooldown-=dt;
    if(inRange&&(chargedReady||u.cooldown<=0)){
      beginAttack(b,u,target,selectedMove);continue;
    }
    if(inRange){u.vx=0;u.vy=0;setState(u,'Idle');continue;}
    moveToTarget(b,u,target,dt,effectiveAttackRange(u,selectedMove));
  }
  for (let i = b.projectiles.length - 1; i >= 0; i--) {
    const p = b.projectiles[i];
    p.life -= dt;
    const target = b.units.find(u => u.uid === p.target && !u.dead);
    if (p.life <= 0 || !target) {
      b.projectiles.splice(i, 1);
      continue;
    }
    const dx = target.x - p.x;
    const dy = target.y - 17 - p.y;
    const d = Math.hypot(dx, dy);
    const step = dt * p.speed;
    if (d < step + target.radius * .75) {
      b.projectiles.splice(i, 1);
      const owner = b.units.find(u => u.uid === p.owner);
      if (owner) applyHit(b, owner, target, MOVES_BY_ID[p.moveId], random);
    } else {
      p.vx = dx / d;
      p.vy = dy / d;
      p.x += p.vx * step;
      p.y += p.vy * step;
    }
    if (b.phase === 'finished') break;
  }
  resolveBattle(b);
  return b;
}
