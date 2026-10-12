import { FIGHTERS } from './fighters.mjs';

export const BOARD = { width: 1120, height: 590, ground: 417 };
const RANGE = 415;
const PROJECTILE_SPEED = 590;

export function createBattle() {
  return {
    elapsed: 0,
    phase: 'approaching',
    winner: null,
    fighters: FIGHTERS.map((type, index) => ({
      type,
      x: index === 0 ? 173 : 947,
      y: BOARD.ground,
      side: index,
      facing: index === 0 ? 6 : 2,
      health: 100,
      maxHealth: 100,
      action: 'Idle',
      actionTime: 0,
      cooldown: index === 0 ? 0.16 : 0.41,
      attackTime: 0,
      shotLaunched: false,
      hitFlash: 0,
      hurtTime: 0,
      defeated: false,
    })),
    projectiles: [],
    floaters: [],
    effects: [],
    events: [],
  };
}

function setAction(pokemon, action) {
  if (pokemon.action !== action) {
    pokemon.action = action;
    pokemon.actionTime = 0;
  }
}

function emitProjectile(battle, from) {
  const target = battle.fighters[1 - from.side];
  battle.projectiles.push({
    x: from.x + (from.side === 0 ? 40 : -40),
    y: from.y - 92,
    target: target.side,
    owner: from.side,
    speed: PROJECTILE_SPEED,
    side: from.side,
    size: 9,
    trail: [],
  });
  battle.effects.push({ x: from.x + (from.side === 0 ? 44 : -44), y: from.y - 88, time: .25, maxTime: .25, color: from.type.color, r: 28 });
  battle.events.push({ type: 'shot', pokemon: from.type.name });
}

function applyHit(battle, projectile, random) {
  const target = battle.fighters[projectile.target];
  if (target.defeated) return;
  const source = battle.fighters[projectile.owner];
  const [min, max] = source.type.damage;
  const damage = min + Math.floor(random() * (max - min + 1));
  target.health = Math.max(0, target.health - damage);
  target.hitFlash = 0.22;
  target.hurtTime = 0.23;
  const crit = damage >= 18;
  battle.floaters.push({
    x: target.x + (random() - .5) * 22, y: target.y - 135,
    text: `-${damage}`, time: .85, maxTime: .85,
    color: crit ? '#ffe2a6' : '#ffffff'
  });
  battle.effects.push({ x: target.x, y: target.y - 83, time: .34, maxTime: .34, color: source.type.color, r: 44 });
  battle.events.push({ type: 'damage', pokemon: target.type.name, damage, health: target.health });
  if (target.health === 0) {
    target.defeated = true;
    const winner = source;
    battle.winner = winner.side;
    battle.phase = 'finished';
    battle.projectiles.length = 0;
    battle.events.push({ type: 'finish', winner: winner.type.name, loser: target.type.name });
  }
}

export function updateBattle(battle, deltaSeconds, random = Math.random) {
  const dt = Math.min(0.05, Math.max(0, deltaSeconds));
  battle.events = [];
  battle.elapsed += dt;

  // Mesmo depois da vitoria, as pequenas particulas terminam suas animacoes.
  for (const f of battle.fighters) {
    f.actionTime += dt;
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    f.hurtTime = Math.max(0, f.hurtTime - dt);
  }
  for (const list of [battle.effects, battle.floaters]) {
    for (const item of list) item.time -= dt;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].time <= 0) list.splice(i, 1);
  }
  if (battle.phase === 'finished') return battle;

  const [a, b] = battle.fighters;
  const currentDistance = Math.abs(b.x - a.x);
  if (currentDistance > RANGE) {
    battle.phase = 'approaching';
    for (const f of battle.fighters) {
      setAction(f, 'Walk');
      f.x += (f.side === 0 ? 1 : -1) * f.type.speed * dt;
    }
    return battle;
  }

  battle.phase = 'fighting';
  for (const f of battle.fighters) {
    if (f.attackTime > 0) {
      f.attackTime -= dt;
      if (!f.shotLaunched && f.actionTime >= .16) {
        f.shotLaunched = true;
        emitProjectile(battle, f);
      }
      if (f.attackTime <= 0) setAction(f, 'Idle');
    } else {
      if (f.hurtTime > 0) setAction(f, 'Hurt');
      else setAction(f, 'Idle');
      f.cooldown -= dt;
      if (f.cooldown <= 0) {
        f.attackTime = .44;
        f.shotLaunched = false;
        f.cooldown = f.type.fireDelay + random() * .30;
        setAction(f, 'Attack');
      }
    }
  }

  for (let i = battle.projectiles.length - 1; i >= 0; i--) {
    const projectile = battle.projectiles[i];
    const target = battle.fighters[projectile.target];
    projectile.trail.unshift({x: projectile.x, y: projectile.y});
    if (projectile.trail.length > 7) projectile.trail.pop();
    const tx = target.x, ty = target.y - 87;
    const dx = tx - projectile.x, dy = ty - projectile.y;
    const distance = Math.hypot(dx, dy);
    const step = projectile.speed * dt;
    if (distance <= step + 15) {
      battle.projectiles.splice(i, 1);
      applyHit(battle, projectile, random);
      if (battle.phase === 'finished') break;
    } else {
      projectile.x += dx / distance * step;
      projectile.y += dy / distance * step;
    }
  }
  return battle;
}

// Durations da sprite sheet: 60 ticks representam 1 segundo.
export function getSpriteFrame(durations, seconds, loop = true) {
  if (!durations?.length) return 0;
  const ticks = Math.floor(seconds * 60);
  const total = durations.reduce((a, b) => a + b, 0);
  let at = loop ? ticks % total : Math.min(ticks, total - 1);
  for (let i = 0; i < durations.length; i++) {
    if (at < durations[i]) return i;
    at -= durations[i];
  }
  return durations.length - 1;
}
