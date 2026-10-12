import { createBattle, startBattle, updateBattle, BOARD } from './battle.mjs';
import { RULES, defeatDamage, fieldLimitForBattle } from './rules.mjs';
import { awardLocalRoundIncome, prepareLocalRound, releaseEliminatedLocalPlayer } from './roster.mjs';
import { prepareLocalBots } from './ai.mjs';

export const LOCAL_PHASES = Object.freeze({
  PREPARATION: 'preparation',
  COMBAT: 'combat',
  FINISHED: 'finished'
});

const pairKey = (a, b) => [a, b].sort().join('|');
const activePlayers = match => match.players.filter(player => !player.eliminated && player.hp > 0);
const clampField = (player, round) => player.board.slice(0, fieldLimitForBattle(round));

function toCombatEntry(unit, team) {
  const entry = { ...unit, team };
  if (team === 1) {
    const mirrored = BOARD.playerBenchRow - (unit.row ?? 8);
    entry.row = Math.max(BOARD.enemyFieldStart, Math.min(BOARD.enemyFieldStart + BOARD.enemyRows - 1, mirrored));
  }
  return entry;
}

function hasValidTeam(player, round) {
  return clampField(player, round).length > 0;
}

function survivorsInBattle(battle, team) {
  return battle.units.filter(unit => unit.team === team && !unit.dead).length;
}

function findPlayer(match, id) {
  return match.players.find(player => player.id === id) || null;
}

function nextBye(match, players) {
  if (players.length % 2 === 0) return null;
  const index = match.byeCursor % players.length;
  match.byeCursor = (match.byeCursor + 1) % Math.max(1, match.players.length);
  return players[index];
}

function makePairings(match) {
  const players = activePlayers(match);
  const bye = nextBye(match, players);
  const waiting = players.filter(player => player !== bye);
  const previous = new Set(match.previousPairs || []);
  const pairings = [];

  while (waiting.length >= 2) {
    const first = waiting.shift();
    let index = waiting.findIndex(candidate => !previous.has(pairKey(first.id, candidate.id)));
    if (index < 0) index = 0;
    const second = waiting.splice(index, 1)[0];
    pairings.push({ id:`r${match.round}-${pairings.length + 1}`, playerIds:[first.id, second.id] });
  }
  if (bye) pairings.push({ id:`r${match.round}-bye`, playerIds:[bye.id], bye:true });
  return pairings;
}

export function startLocalMatchCycle(match, nowSeconds = 0) {
  match.phase = LOCAL_PHASES.PREPARATION;
  match.phaseStartedAt = nowSeconds;
  match.phaseDeadline = nowSeconds + RULES.preparationSeconds;
  match.combats = [];
  match.pairings = [];
  match.waitingForUnavailableUntil = null;
  match.previousPairs = match.previousPairs || [];
  match.byeCursor = match.byeCursor || 0;
  match.lastMessage = 'Preparação local: organize o campo e compre Pokémon na loja.';
  prepareLocalRound(match);
  prepareLocalBots(match);
  return match;
}

export function startCombatPhase(match, nowSeconds = 0) {
  match.phase = LOCAL_PHASES.COMBAT;
  match.phaseStartedAt = nowSeconds;
  match.phaseDeadline = nowSeconds + RULES.battleSeconds;
  match.pairings = makePairings(match);
  match.combats = match.pairings.map(pairing => {
    if (pairing.bye) {
      return { ...pairing, status:'bye', result:{ reason:'bye', damage:0 } };
    }

    const [leftId, rightId] = pairing.playerIds;
    const left = findPlayer(match, leftId);
    const right = findPlayer(match, rightId);
    if (!left || !right) {
      return { ...pairing, status:'unavailable', result:{ reason:'invalid-teams', damage:0 } };
    }
    if (!hasValidTeam(left, match.round) || !hasValidTeam(right, match.round)) {
      // Regra temporária: quem não montou equipe perde para a formação válida.
      // Duas equipes vazias empatam, sem dano (o GDD ainda deixa este caso em aberto).
      const winner = hasValidTeam(left,match.round) ? left : hasValidTeam(right,match.round) ? right : null;
      const loser = winner === left ? right : winner === right ? left : null;
      const survivors = winner ? clampField(winner,match.round).length : 0;
      const damage = loser ? defeatDamage(match.round,survivors) : 0;
      if (loser) { loser.hp = Math.max(0,loser.hp-damage); loser.eliminated = loser.hp<=0; }
      return { ...pairing, status:'finished', result:{reason:'empty-team',winnerId:winner?.id||null,loserId:loser?.id||null,damage,survivors} };
    }

    const battle = createBattle([
      clampField(left, match.round).map(unit => toCombatEntry(unit, 0)),
      clampField(right, match.round).map(unit => toCombatEntry(unit, 1))
    ], [
      {terrain:left.terrain,structures:left.structures},
      {terrain:right.terrain,structures:right.structures}
    ]);
    startBattle(battle);
    return { ...pairing, status:'running', battle, result:null };
  });
  match.previousPairs = match.pairings
    .filter(pairing => pairing.playerIds.length === 2)
    .map(pairing => pairKey(pairing.playerIds[0], pairing.playerIds[1]));
  const hasRunningCombat = match.combats.some(combat => combat.status === 'running');
  if (!hasRunningCombat) match.phaseDeadline = nowSeconds + 3;
  match.lastMessage = hasRunningCombat
    ? 'Combates locais em andamento.'
    : 'Nenhum confronto com duas equipes validas nesta rodada.';
  match.waitingForUnavailableUntil = hasRunningCombat
    ? null
    : nowSeconds + 3;
  return match;
}

function finishCombat(match, combat) {
  if (combat.status !== 'running' || combat.battle.phase !== 'finished') return;
  const [leftId, rightId] = combat.playerIds;
  const winnerTeam = combat.battle.winner;
  combat.status = 'finished';

  if (winnerTeam === null) {
    combat.result = { reason:'draw', winnerId:null, loserId:null, damage:0, survivors:0 };
    return;
  }

  const winnerId = winnerTeam === 0 ? leftId : rightId;
  const loserId = winnerTeam === 0 ? rightId : leftId;
  const loser = findPlayer(match, loserId);
  const survivors = survivorsInBattle(combat.battle, winnerTeam);
  const damage = defeatDamage(match.round, survivors);
  if (loser) {
    loser.hp = Math.max(0, loser.hp - damage);
    loser.eliminated = loser.hp <= 0;
  }
  combat.result = { reason:'defeat', winnerId, loserId, damage, survivors };
}

function finishCombatPhase(match, nowSeconds = 0) {
  for (const combat of match.combats) finishCombat(match, combat);
  match.outcomes.push({
    round: match.round,
    combats: match.combats.map(combat => ({
      id: combat.id,
      playerIds: combat.playerIds,
      status: combat.status,
      result: combat.result
    }))
  });
  for (const participant of match.players) releaseEliminatedLocalPlayer(match,participant);
  awardLocalRoundIncome(match);
  const alive = activePlayers(match);
  if (alive.length <= 1) {
    match.phase = LOCAL_PHASES.FINISHED;
    match.phaseStartedAt = nowSeconds;
    match.phaseDeadline = null;
    match.championId = alive[0]?.id || null;
    match.lastMessage = match.championId ? 'Partida local encerrada.' : 'Partida local encerrada sem vencedor.';
    return match;
  }
  match.round += 1;
  return startLocalMatchCycle(match, nowSeconds);
}

export function updateLocalMatchCycle(match, dtSeconds, nowSeconds = 0) {
  if (!match || match.phase === LOCAL_PHASES.FINISHED) return match;
  if (match.phase === LOCAL_PHASES.PREPARATION && nowSeconds >= match.phaseDeadline) {
    return startCombatPhase(match, nowSeconds);
  }
  if (match.phase !== LOCAL_PHASES.COMBAT) return match;

  for (const combat of match.combats) {
    if (combat.status !== 'running') continue;
    updateBattle(combat.battle, dtSeconds);
    if (combat.battle.phase === 'finished') finishCombat(match, combat);
  }

  const running = match.combats.filter(combat => combat.status === 'running');
  if (nowSeconds >= match.phaseDeadline) {
    for (const combat of running) {
      // O motor avança em passos de até 50 ms; enviar 60 s de uma vez
      // seria truncado para 0,05 s e a partida ficaria travada nesta fase.
      let remaining = Math.max(0,RULES.battleSeconds-combat.battle.elapsed);
      while(remaining > 0 && combat.battle.phase === 'fighting') {
        const step = Math.min(.05,remaining);
        updateBattle(combat.battle,step);
        remaining-=step;
      }
      finishCombat(match, combat);
    }
  }

  if (!match.combats.some(combat => combat.status === 'running')
    && (!match.waitingForUnavailableUntil || nowSeconds >= match.waitingForUnavailableUntil)) {
    return finishCombatPhase(match, nowSeconds);
  }
  return match;
}

export function phaseRemainingSeconds(match, nowSeconds = 0) {
  if (!match?.phaseDeadline) return 0;
  return Math.max(0, Math.ceil(match.phaseDeadline - nowSeconds));
}

export function aliveCount(match) {
  return activePlayers(match).length;
}

export function combatForPlayer(match, playerId) {
  return match?.combats?.find(combat => combat.playerIds.includes(playerId)) || null;
}
