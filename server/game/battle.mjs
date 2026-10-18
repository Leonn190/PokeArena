import { BY_ID, getDirection } from './pokemon.mjs';
import { RULES } from './rules.mjs';
import { MOVES_BY_ID, validLoadout, equippedAbility, resolvedMoves, combatRange, chooseMoveAnimation, RANGE_EPSILON } from './moves.mjs';
import { ENERGY_PER_ATTACK } from '../../config/ataques.mjs';
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
// Regulares e genéricos usam Normal; habilidades exclusivas declaram seu tipo.
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
  return types.reduce((mult,type)=>{
    const relation=TYPE_EFFECTIVENESS[attackType]?.[type]??1;
    return mult*(relation===2 ? 1.25 : (relation===.5||relation===0) ? .8 : 1);
  },1);
}
function damageBreakdown(attacker, defender, kind, random, baseDamage, attackType, scaledByAttribute, fractional=false) {
  const a = attacker.stats[kind === 'atk' ? 'atk' : 'spa'];
  const d = defender.stats[kind === 'atk' ? 'def' : 'spd'];
  const multiplier = typeMultiplier(attackType, defender.type.types) * (1+(attacker.environmentMods?.damage||0));
  const power=baseDamage * (scaledByAttribute?1:(.62 + a / 105));
  const roll=.92 + random() * .16;
  const raw=power*(100/(80+d))*multiplier*roll;
  const damage=fractional?Math.max(0,raw):Math.max(1,Math.round(raw));
  // Compara a mesma rolagem com defesa zero; não conta excesso de dano como mitigação.
  return {damage,mitigated:Math.max(0,Math.round(power*(100/80)*multiplier*roll)-damage)};
}
export function physicalOrSpecialDamage(attacker, defender, kind, random = Math.random, baseDamage = 30, attackType = 'Normal', scaledByAttribute = false) {
  return damageBreakdown(attacker,defender,kind,random,baseDamage,attackType,scaledByAttribute).damage;
}
export function normalizeEntry(entry, team) {
  const speciesId = String(entry.speciesId ?? entry.id).padStart(4,'0');
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
    activeMoves: validLoadout(speciesId,entry),
    abilityId:equippedAbility(speciesId,entry).id,
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
      activeMoves: validLoadout(entry.speciesId,entry),
      abilityId:equippedAbility(entry.speciesId,entry).id,
      energy:0,
      maxEnergy:equippedAbility(entry.speciesId,entry).energyCost,
      x: entry.x,
      y: entry.y,
      col: entry.col,
      row: entry.row,
      health: hp,
      damageDealt: 0,
      damagePhysical: 0,
      damageSpecial: 0,
      mitigatedPhysical: 0,
      mitigatedSpecial: 0,
      healingDone: 0,
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
export function effectiveAttackRange(unit) {
  // Nunca derivar alcance do tamanho da imagem ou da animação.
  return combatRange(unit.type.id,unit)*BOARD.tile;
}
const setState = (u, state) => { if (u.state !== state) { u.state = state; u.stateTime = 0; } };
function getTarget(b, u) { return chooseCombatTarget(u,b.units.filter(other=>!other.dead&&other.team!==u.team),BOARD.tile); }
function getMoves(u) { return resolvedMoves(u.type.id,u); }
// Centros candidatos de círculos: posições inimigas e interseções dos limites
// de área/alcance. A contagem usa posições atuais e desempate pela ordem estável.
function pollenCenter(b,u,move) {
  const enemies=b.units.filter(v=>!v.dead&&v.team!==u.team);
  const radius=move.areaRadius*BOARD.tile,reach=effectiveAttackRange(u)+u.radius;
  const circles=[...enemies.map(v=>({x:v.x,y:v.y,r:radius})),{x:u.x,y:u.y,r:reach}];
  const candidates=enemies.map(v=>({x:v.x,y:v.y}));
  for(let i=0;i<circles.length;i++)for(let j=i+1;j<circles.length;j++){
    const a=circles[i],c=circles[j],d=dist(a,c);
    if(d<1e-6||d>a.r+c.r||d<Math.abs(a.r-c.r))continue;
    const along=(a.r*a.r-c.r*c.r+d*d)/(2*d);
    const height=Math.sqrt(Math.max(0,a.r*a.r-along*along));
    const dx=(c.x-a.x)/d,dy=(c.y-a.y)/d;
    for(const sign of [-1,1])candidates.push({x:a.x+dx*along-sign*dy*height,y:a.y+dy*along+sign*dx*height});
  }
  let best=null,count=0;
  for(const point of candidates){
    if(dist(u,point)>reach+1e-6)continue;
    const hits=enemies.filter(v=>dist(v,point)<=radius+1e-6).length;
    if(hits>count){best=point;count=hits;}
  }
  return best;
}
function beginAttack(b, u, target, move) {
  const destination=move.behavior==='pollen'?pollenCenter(b,u,move):null;
  if(move.behavior==='pollen'&&!destination)return false;
  const animation = chooseMoveAnimation(move, u.type.sprites);
  const meta = u.type.sprites[animation] || u.type.sprites.Attack;
  const durations = meta?.durations || [4, 4, 4, 4, 4];
  const natural = durations.reduce((s, n) => s + n, 0) / 60;
  let length = clamp(natural, .28, 1.15);
  const hitFrame = clamp(meta?.hitFrame ?? Math.floor(durations.length * .55), 0, durations.length - 1);
  let hitAt = clamp(durations.slice(0, hitFrame).reduce((s, n) => s + n, 0) / 60, .08, length * .92);
  const extended=['0004','0005','0006','0007','0008','0009'].includes(move.id);
  if(extended){
    length=natural;
    hitAt=durations.slice(0,hitFrame).reduce((s,n)=>s+n,0)/60;
  }
  // Transição curta para a concha; não conservar os 20 ticks do primeiro frame.
  if(move.behavior==='water-spin')hitAt=.1;
  // Shoot: frame 1 prepara os canhões; frame 2 mostra a emissão de água.
  if(move.behavior==='double-jet'&&animation==='Shoot')hitAt=durations.slice(0,2).reduce((s,n)=>s+n,0)/60;
  if(move.duration)length=hitAt+move.duration+.16;
  if(move.behavior==='ricochet')length=hitAt+2.5;
  if(move.shots)length=Math.max(length,hitAt+(move.shots-1)*move.shotInterval+.08);
  u.energy=clamp(u.energy-(move.kind==='charged'?move.energyCost:0)+ENERGY_PER_ATTACK,0,u.maxEnergy);
  u.cast = { moveId:move.id, animation, length, hitAt, elapsed:0, fired:false, shotsFired:0, targetId:target.uid, destination,
    behavior:move.behavior, duration:move.duration, pulses:0, hitIds:[],
    angle:Math.atan2(target.y-u.y,target.x-u.x), startedAt:b.elapsed };
  u.vx = 0;
  u.vy = 0;
  u.facing = getDirection(target.x - u.x, target.y - u.y);
  setState(u, animation);
  return true;
}
function spawnProjectile(b, u, target, move, destination=null) {
  if(move.behavior==='pollen'){
    const end=destination||{x:target.x,y:target.y};
    b.projectiles.push({owner:u.uid,team:u.team,moveId:move.id,behavior:move.behavior,
      x:u.x,y:u.y,startX:u.x,startY:u.y,endX:end.x,endY:end.y,
      vx:0,vy:0,speed:move.projectileSpeed,color:move.color,radius:8,
      life:Math.max(2,dist(u,end)/move.projectileSpeed+1)});
    return;
  }
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
    radius:move.behavior==='seeds'?4:move.category === 'atk' ? 6 : 9,
    color:move.color,
    life:1.8
  });
}
function applyHit(b, attacker, target, move, random) {
  if (target.dead) return;
  const coefficient=move.category==='atk'?move.atkCoefficient:move.spaCoefficient;
  const scaled=coefficient!==undefined;
  const base=scaled?attacker.stats[move.category]*coefficient+attacker.stats.def*(move.defCoefficient||0):move.damage;
  const result = damageBreakdown(attacker, target, move.category, random, base, move.type, scaled,move.fractional);
  const spin=target.cast?.behavior==='water-spin'?target.cast:null;
  const spinMove=spin?MOVES_BY_ID[spin.moveId]:null;
  const protectedNow=spin&&!target.dead&&b.phase==='fighting'&&
    b.elapsed+1e-6>=spin.startedAt+spin.hitAt&&b.elapsed<spin.startedAt+spin.hitAt+spin.duration-1e-6;
  const reduction=protectedNow?Math.min(spinMove.reductionCap,spinMove.reductionBase+target.stats.atk*spinMove.reductionPerAtk):0;
  const damage=result.damage*(1-reduction),mitigated=result.mitigated+result.damage*reduction;
  attacker.damageDealt += Math.min(target.health,damage);
  attacker[move.category==='atk'?'damagePhysical':'damageSpecial']+=Math.min(target.health,damage);
  target[move.category==='atk'?'mitigatedPhysical':'mitigatedSpecial']+=mitigated;
  target.health = Math.max(0, target.health - damage);
  target.hitFlash = .20;
  target.hurtTime = .16;
  const floater=move.fractional?b.floaters.find(f=>f.targetId===target.uid&&f.ownerId===attacker.uid&&f.time>.55):null;
  if(floater){floater.amount+=damage;floater.text=`-${Math.round(floater.amount)}`;}
  else b.floaters.push({ x:target.x, y:target.y - 40, text:`-${Math.round(damage)}`, amount:damage,
    targetId:move.fractional?target.uid:null,ownerId:attacker.uid,time:.85,total:.85,kind:move.category });
  if(!move.fractional)b.effects.push({ x:target.x, y:target.y - 15, color:move.color, time:.35, total:.35, style:move.effect });
  b.events.push({ type:'attack', name:attacker.type.name, target:target.type.name, damage, move:move.name });
  if (target.health === 0) {
    target.dead = true;
    target.cast=null;
    setState(target, 'Hurt');
    b.kills[attacker.team]++;
    b.events.push({ type:'ko', name:target.type.name, by:attacker.type.name });
  }
}
function handleCast(b, u, dt, random) {
  const cast = u.cast;
  const move = getMoves(u).find(move=>move.id===cast.moveId);
  cast.elapsed += dt;
  u.vx = 0;
  u.vy = 0;
  if(move.duration||move.behavior==='ricochet'){
    handleExtendedCast(b,u,move,dt,random);
    if(u.cast&&cast.elapsed>=cast.length)finishCast(u,random);
    return;
  }
  while (cast.shotsFired<(move.shots||1) && cast.elapsed+1e-6 >= cast.hitAt+cast.shotsFired*(move.shotInterval||0)) {
    cast.shotsFired++;
    cast.fired = true;
    const target = b.units.find(z => z.uid === cast.targetId && !z.dead);
    if(move.behavior==='pollen'){
      // Reavalia a concentração ao lançar, sem depender da sobrevivência do alvo inicial.
      const center=pollenCenter(b,u,move);
      if(center)spawnProjectile(b,u,center,move,center);
    } else if(move.behavior==='vines'){
      strikeVines(b,u,move,random);
    } else if (target) {
      if (move.projectile && (move.behavior==='seeds'||edgeDistance(u, target) <= effectiveAttackRange(u) + 35)) spawnProjectile(b, u, target, move);
      else if (!move.projectile && edgeDistance(u, target) <= effectiveAttackRange(u) + 9) applyHit(b, u, target, move, random);
    }
  }
  if (cast.elapsed >= cast.length) {
    finishCast(u,random);
  }
}
function finishCast(u,random){
  u.cast=null;u.vx=0;u.vy=0;setState(u,'Idle');
  u.cooldown=attackInterval(u.stats)/(1+(u.environmentMods?.attackSpeed||0))*(.88+random()*.24);
}
function finishChannel(cast){
  if(cast.recoveryAt===undefined){cast.recoveryAt=cast.elapsed;cast.length=cast.elapsed+.16;}
}
function beamContact(u,v,cast,move){
  const dx=Math.cos(cast.angle),dy=Math.sin(cast.angle);
  const x=v.x-u.x-dx*u.radius,y=v.y-u.y-dy*u.radius,reach=move.range*BOARD.tile;
  const t=clamp(x*dx+y*dy,0,reach);
  return Math.hypot(x-t*dx,y-t*dy)<=v.radius+move.beamWidth*BOARD.tile/2;
}
function handleExtendedCast(b,u,move,dt,random){
  const cast=u.cast;
  if(cast.recoveryAt!==undefined||cast.elapsed<cast.hitAt)return;
  if(move.behavior==='ricochet'){advanceRicochet(b,u,move,dt,random);return;}
  const target=b.units.find(v=>v.uid===cast.targetId&&!v.dead);
  if(move.behavior==='double-jet'){
    if(!target){finishChannel(cast);return;}
    cast.angle=Math.atan2(target.y-u.y,target.x-u.x);
    u.facing=getDirection(target.x-u.x,target.y-u.y);
  }
  const active=Math.min(move.duration,cast.elapsed-cast.hitAt);
  const pulseCount=Math.round(move.duration/move.tickInterval);
  while(cast.pulses<pulseCount&&active+1e-6>=(cast.pulses+1)*move.tickInterval){
    cast.pulses++;
    const pulse={...move,spaCoefficient:move.spaCoefficient/pulseCount,fractional:true};
    if(move.behavior==='double-jet'){
      if(!target||target.dead){finishChannel(cast);return;}
      // Os dois fluxos compartilham UM orçamento de dano por pulso.
      applyHit(b,u,target,pulse,random);
      if(target.dead){finishChannel(cast);return;}
    }else{
      for(const enemy of b.units){
        if(enemy.dead||enemy.team===u.team)continue;
        const inside=move.behavior==='water-spin'
          ? dist(u,enemy)<=move.areaRadius*BOARD.tile+enemy.radius
          : beamContact(u,enemy,cast,move);
        if(inside)applyHit(b,u,enemy,pulse,random);
      }
      if(move.behavior==='water-spin')b.effects.push({ownerId:u.uid,x:u.x,y:u.y,radius:move.areaRadius*BOARD.tile,color:move.color,style:'water-wave',time:.4,total:.4});
    }
  }
}
// Distância de um centro ao segmento; permite recusar trajetórias bloqueadas
// antes de escolher o próximo ricochete, sem usar dimensões de sprites.
function segmentDistance(point,a,c){
  const dx=c.x-a.x,dy=c.y-a.y,length=dx*dx+dy*dy;
  const t=length?clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/length,0,1):0;
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}
function ricochetDestination(u,target){
  const distance=dist(u,target)||1,stop=u.radius+target.radius+3;
  const travel=Math.max(0,distance-stop);
  return {x:u.x+(target.x-u.x)/distance*travel,y:u.y+(target.y-u.y)/distance*travel};
}
function clearRicochetPath(b,u,target){
  const end=ricochetDestination(u,target),bounds=b.bounds;
  if(end.x<bounds.minX+u.radius||end.x>bounds.maxX-u.radius||end.y<bounds.minY+u.radius||end.y>bounds.maxY-u.radius)return false;
  return !b.units.some(v=>v!==u&&v!==target&&!v.dead&&segmentDistance(v,u,end)<u.radius+v.radius+2.9);
}
function nextRicochetTarget(b,u,move){
  return b.units.filter(v=>!v.dead&&v.team!==u.team&&!u.cast.hitIds.includes(v.uid)&&
    edgeDistance(u,v)<=move.range*BOARD.tile&&clearRicochetPath(b,u,v))
    .sort((a,c)=>dist(u,a)-dist(u,c)||a.uid.localeCompare(c.uid))[0];
}
function advanceRicochet(b,u,move,dt,random){
  const cast=u.cast;
  if(cast.elapsed>=cast.hitAt+2.5){finishChannel(cast);cast.length=cast.elapsed+7/30;return;}
  let target=b.units.find(v=>v.uid===cast.targetId&&!v.dead&&!cast.hitIds.includes(v.uid));
  if(!target||edgeDistance(u,target)>move.range*BOARD.tile||!clearRicochetPath(b,u,target))target=nextRicochetTarget(b,u,move);
  if(!target){finishChannel(cast);cast.length=cast.elapsed+7/30;return;}
  cast.targetId=target.uid;
  let budget=move.dashSpeed*Math.min(dt,Math.max(0,cast.elapsed-cast.hitAt));
  while(budget>1e-6){
    const end=ricochetDestination(u,target),distance=dist(u,end);
    const step=Math.min(3,budget,distance);
    if(step>1e-6){
      const next={x:u.x+(end.x-u.x)/distance*step,y:u.y+(end.y-u.y)/distance*step};
      if(b.units.some(v=>v!==u&&v!==target&&!v.dead&&dist(next,v)<u.radius+v.radius+2.9)){
        finishChannel(cast);cast.length=cast.elapsed+7/30;return;
      }
      u.facing=getDirection(end.x-u.x,end.y-u.y);u.x=next.x;u.y=next.y;budget-=step;
    }
    if(distance>step+1e-6)continue;
    cast.hitIds.push(target.uid);applyHit(b,u,target,move,random);
    target=cast.hitIds.length<move.maxTargets?nextRicochetTarget(b,u,move):null;
    if(!target){finishChannel(cast);cast.length=cast.elapsed+7/30;return;}
    cast.targetId=target.uid;
  }
}
function strikeVines(b,u,move,random){
  const target=b.units.find(v=>v.uid===u.cast.targetId);
  const angle=target?Math.atan2(target.y-u.y,target.x-u.x):Math.PI/2-u.facing*Math.PI/4;
  const dx=Math.cos(angle),dy=Math.sin(angle),reach=effectiveAttackRange(u);
  b.effects.push({x:u.x,y:u.y,angle,radius:reach,halfAngle:move.coneHalfAngle,color:move.color,style:'vine-cone',time:.45,total:.45});
  for(const enemy of b.units){
    if(enemy.dead||enemy.team===u.team||edgeDistance(u,enemy)>reach)continue;
    const x=enemy.x-u.x,y=enemy.y-u.y,forward=x*dx+y*dy,lateral=-x*dy+y*dx;
    if(forward<0||Math.abs(lateral)>Math.tan(move.coneHalfAngle)*forward+enemy.radius)continue;
    applyHit(b,u,enemy,move,random);
    const pull=clamp(lateral,-move.pullDistance*BOARD.tile,move.pullDistance*BOARD.tile)*.65;
    // Movimento curto e varrido: rejeita passos que atravessam unidades ou limites.
    const steps=Math.ceil(Math.abs(pull)/3);
    for(let i=0;i<steps;i++){
      const next={x:enemy.x+dy*pull/steps,y:enemy.y-dx*pull/steps};
      if(next.x<b.bounds.minX+enemy.radius||next.x>b.bounds.maxX-enemy.radius||
        next.y<b.bounds.minY+enemy.radius||next.y>b.bounds.maxY-enemy.radius||
        b.units.some(v=>v!==enemy&&!v.dead&&dist(next,v)<enemy.radius+v.radius+3))break;
      enemy.x=next.x;enemy.y=next.y;
    }
  }
}
function explodePollen(b,owner,p,move,random){
  const radius=move.areaRadius*BOARD.tile;
  b.effects.push({x:p.endX,y:p.endY,color:move.color,radius,style:'pollen-area',time:.65,total:.65});
  for(const unit of b.units){
    if(unit.dead||dist(unit,{x:p.endX,y:p.endY})>radius+1e-6)continue;
    if(unit.team!==owner.team){applyHit(b,owner,unit,move,random);continue;}
    const healing=Math.min(unit.maxHealth-unit.health,owner.stats.spa*move.healCoefficient);
    if(healing<=0)continue;
    unit.health+=healing;
    owner.healingDone+=healing;
    b.floaters.push({x:unit.x,y:unit.y-40,text:`+${Math.round(healing)}`,kind:'heal',time:.85,total:.85});
    b.events.push({type:'heal',name:owner.type.name,target:unit.type.name,healing,move:move.name});
  }
}
function explodeFireball(b,owner,target,move,random){
  const center={x:target.x,y:target.y},radius=move.areaRadius*BOARD.tile;
  applyHit(b,owner,target,move,random);
  b.effects.push({...center,radius,color:move.color,style:'fire-explosion',time:.4,total:.4});
  for(const enemy of b.units){
    if(enemy===target||enemy.dead||enemy.team===owner.team||dist(center,enemy)>radius+enemy.radius)continue;
    applyHit(b,owner,enemy,{...move,spaCoefficient:move.splashCoefficient},random);
  }
}
function updateAbilityProjectile(b,p,dt,random){
  const owner=b.units.find(u=>u.uid===p.owner),move=MOVES_BY_ID[p.moveId];
  if(!owner||!move)return true;
  const destination={x:p.endX,y:p.endY};
  const distance=dist(p,destination),step=Math.min(distance,p.speed*dt);
  p.vx=distance?(destination.x-p.x)/distance:0;p.vy=distance?(destination.y-p.y)/distance:0;
  p.x+=p.vx*step;p.y+=p.vy*step;
  if(distance>step+1e-6)return false;
  explodePollen(b,owner,p,move,random);return true;
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
function clearWalkPath(b,u,end){
  const bounds=b.bounds;
  if(end.x<bounds.minX+u.radius||end.x>bounds.maxX-u.radius||end.y<bounds.minY+u.radius||end.y>bounds.maxY-u.radius)return false;
  return !b.units.some(other=>{
    if(other===u||other.dead)return false;
    const separation=u.radius+other.radius+3;
    // Sobreposição herdada de um empurrão pode ser desfeita, nunca agravada.
    const initial=dist(u,other),minimum=Math.min(separation,initial);
    return segmentDistance(other,u,end)<minimum-RANGE_EPSILON||
      (initial<separation-RANGE_EPSILON&&dist(end,other)<=initial);
  });
}
function walkDestination(b,u,target,ideal){
  const distance=dist(u,target)||1;
  // Entrar ligeiramente no alcance evita terminar em uma fronteira flutuante.
  const travel=Math.max(0,edgeDistance(u,target)-Math.max(0,ideal-.5));
  const end={x:u.x+(target.x-u.x)/distance*travel,y:u.y+(target.y-u.y)/distance*travel};
  if(clearWalkPath(b,u,end)){u.detour=null;return end;}
  const blockers=b.units.filter(other=>other!==u&&other!==target&&!other.dead&&
    segmentDistance(other,u,end)<u.radius+other.radius+3)
    .sort((a,c)=>dist(u,a)-dist(u,c));
  for(const blocker of blockers){
    const angle=Math.atan2(u.y-blocker.y,u.x-blocker.x);
    const radius=u.radius+blocker.radius+11;
    const preferred=u.detour?.blockerId===blocker.uid?u.detour.side:null;
    const choices=[-1,1].map(side=>{
      const point={x:blocker.x+Math.cos(angle+side*.65)*radius,y:blocker.y+Math.sin(angle+side*.65)*radius};
      return {point,side,score:dist(u,point)+dist(point,end)};
    }).filter(choice=>clearWalkPath(b,u,choice.point))
      .sort((a,c)=>(a.side===preferred?-1:c.side===preferred?1:0)||a.score-c.score);
    if(choices.length){
      u.detour={blockerId:blocker.uid,side:choices[0].side};
      return choices[0].point;
    }
  }
  return end;
}
function moveToTarget(b, u, target, dt, ideal) {
  const oldX = u.x;
  const oldY = u.y;
  const speed = moveSpeed(u.stats) * (1+(u.environmentMods?.moveSpeed||0));
  const destination=walkDestination(b,u,target,ideal);
  let remaining=Math.min(speed*dt,dist(u,destination));
  while(remaining>RANGE_EPSILON){
    const angle=Math.atan2(destination.y-u.y,destination.x-u.x),step=Math.min(3,remaining);
    const side=u.detour?.side??1;
    // Se o corredor se fecha por uma unidade em movimento, procurar um passo
    // lateral válido em vez de empurrar indefinidamente o mesmo obstáculo.
    const offsets=[0,side*Math.PI/8,-side*Math.PI/8,side*Math.PI/4,-side*Math.PI/4,side*Math.PI/2,-side*Math.PI/2];
    const next=offsets.map(offset=>({x:u.x+Math.cos(angle+offset)*step,y:u.y+Math.sin(angle+offset)*step}))
      .find(point=>clearWalkPath(b,u,point));
    if(!next)break;
    u.x=next.x;u.y=next.y;remaining-=step;
  }
  collideAndClamp(b, u);
  u.vx=dt>0?(u.x-oldX)/dt:0;u.vy=dt>0?(u.y-oldY)/dt:0;
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
  for(const unit of b.units)if(unit.cast?.duration||unit.cast?.behavior==='ricochet'){
    unit.cast=null;unit.vx=0;unit.vy=0;setState(unit,'Idle');
  }
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
    const nextMax=Math.round(maxHealth(u.stats,u.hpScale));
    if(nextMax!==u.maxHealth) {u.health=Math.min(nextMax,u.health*(nextMax/u.maxHealth));u.maxHealth=nextMax;}
    if(!u.dead&&b.phase==='fighting'&&!b.paused) {
      const regen=(u.environmentMods?.regen||0)*u.maxHealth;
      if(regen)u.health=Math.min(u.maxHealth,u.health+regen*dt);
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
    // Hurt é reação visual, não atordoamento. Acertos sucessivos não podem
    // bloquear aproximação, recarga nem a prioridade da habilidade carregada.
    const [regular,charged]=getMoves(u);
    const chargedReady=!!charged&&u.energy+1e-6>=charged.energyCost;
    // Com energia cheia o carregado é obrigatório: inclusive quando ele
    // exige caminhar até ficar ao alcance. Não usa regulares nesse intervalo.
    const selectedMove=chargedReady?charged:regular;
    const target=getTarget(b,u);
    u.targetId=target?.uid||null;
    if(!target||!selectedMove){u.vx=0;u.vy=0;setState(u,'Idle');continue;}
    const inRange=edgeDistance(u,target)<=effectiveAttackRange(u)+RANGE_EPSILON;
    u.cooldown-=dt;
    if(inRange&&(chargedReady||u.cooldown<=0)){
      if(beginAttack(b,u,target,selectedMove))continue;
    }
    if(inRange){u.vx=0;u.vy=0;setState(u,'Idle');continue;}
    moveToTarget(b,u,target,dt,effectiveAttackRange(u));
  }
  for (let i = b.projectiles.length - 1; i >= 0; i--) {
    const p = b.projectiles[i];
    p.life -= dt;
    if(p.behavior){
      if(p.life<=0||updateAbilityProjectile(b,p,dt,random))b.projectiles.splice(i,1);
      continue;
    }
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
      const move=MOVES_BY_ID[p.moveId];
      if(owner){
        if(move.behavior==='fireball')explodeFireball(b,owner,target,move,random);
        else applyHit(b,owner,target,move,random);
      }
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
