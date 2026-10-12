import { RULES } from './rules.mjs';

// Modelo serializável que poderá ser salvo em Postgres. DOM/Canvas não entram aqui.
export function createParticipant({id,name,isBot}) {
  return {
    id,name,isBot,hp:RULES.startingHp,gold:RULES.startingGold,
    bench:Array(RULES.bankSlots).fill(null),board:[],shop:Array(RULES.shopSlots).fill(null),
    shopLocked:false,items:[],structures:[],fieldEffects:[],eliminated:false,
    // Na etapa da loja, reservar ofertas e preservar proveniência do pool aqui.
    unitInventory:[],reservedOffers:[]
  };
}

// Operações de dados do Modo Teste legado. São funções explícitas, sem DOM.
// Não reutilizar sorteios locais como fonte de verdade no competitivo.
export function createSandboxState() {
  return {
    round:1,gold:Infinity,infiniteGold:true,
    playerBench:Array(RULES.bankSlots).fill(null),
    enemyBench:Array(RULES.bankSlots).fill(null),
    playerBoard:[],enemyBoard:[],shop:Array(RULES.shopSlots).fill(null)
  };
}
export function createSandboxPokemon(speciesId,team,instanceId,random=Math.random) {
  return {
    instanceId,speciesId,team,iv:Math.floor(random()*101),
    activeMoves:['disparo','investida'],slots:2,
    col:team?5:4,row:team?2:7,x:0,y:0
  };
}
export function removeFromSandbox(state,unit) {
  for(const bench of [state.playerBench,state.enemyBench]) {
    const slot=bench.indexOf(unit);
    if(slot!==-1)bench[slot]=null;
  }
  for(const board of [state.playerBoard,state.enemyBoard]) {
    const index=board.indexOf(unit);
    if(index!==-1)board.splice(index,1);
  }
}
export function nextSandboxFusion(units,evolvesTo) {
  const groups=new Map();
  for(const unit of units) {
    if(!evolvesTo[unit.speciesId])continue;
    const group=groups.get(unit.speciesId)||[];
    group.push(unit);
    groups.set(unit.speciesId,group);
  }
  // APENAS para as três linhas de iniciantes do sandbox original.
  // O competitivo segue a tabela de fusão POR ESPÉCIE do GDD §5.4.
  return [...groups.entries()].find(([,group])=>group.length>=3)||null;
}

// Fundação de sessão em memória para o protótipo OFFLINE das etapas 01–11.
// O estado usa o mesmo participante e regras do domínio; não representa
// uma partida competitiva oficial e não depende de HTTP, DOM ou Node.
export function createLocalMatchState(playerCount, sessionId) {
  if (!Number.isInteger(playerCount) || playerCount < RULES.minPlayers || playerCount > RULES.maxPlayers) {
    throw new RangeError(`A partida local aceita ${RULES.minPlayers} a ${RULES.maxPlayers} participantes.`);
  }
  const ownerId = `${sessionId}-player`;
  const players = [createParticipant({id:ownerId,name:'Jogador',isBot:false})];
  for (let i=1; i<playerCount; i++) {
    players.push(createParticipant({id:`${sessionId}-bot-${i}`,name:`Bot ${i}`,isBot:true}));
  }
  return {
    id:sessionId,ownerId,ruleset:RULES.version,revision:0,round:1,
    phase:'awaiting-match-engine',players,
    outcomes:[],championId:null,pool:{},pairings:[],phaseDeadline:null,
    localOnly:true
  };
}

// Ponte mínima jogável entre as etapas 02 e 04: ofertas limitadas aos três
// iniciais que já possuem PNGs locais. Não representa a loja completa de
// raridades, slots flexíveis, estoque e IA prevista nas etapas 04–06.
// As operações são puras em relação à plataforma (sem DOM ou HTTP).
import { BY_ID, STARTER_SHOP_IDS } from './pokemon.mjs';
import { fieldLimitForBattle, interestForGold } from './rules.mjs';

function localShopRoll(random = Math.random) {
  return Array.from({length:RULES.shopSlots}, () =>
    STARTER_SHOP_IDS[Math.min(STARTER_SHOP_IDS.length-1,Math.floor(random()*STARTER_SHOP_IDS.length))]);
}
export function refreshLocalShop(match, participant, random = Math.random, paid = false) {
  if (match.phase !== 'preparation' || participant.eliminated || participant.shopLocked) return false;
  if (paid) {
    if (participant.gold < RULES.rerollCostGold) return false;
    participant.gold -= RULES.rerollCostGold;
  }
  participant.shop = localShopRoll(random);
  return true;
}
export function purchaseLocalOffer(match, participant, index, random = Math.random) {
  if (match.phase !== 'preparation' || participant.eliminated) return null;
  if (!Number.isInteger(index) || index < 0 || index >= RULES.shopSlots) return null;
  const speciesId = participant.shop[index];
  const type = BY_ID[speciesId];
  if (!type || !STARTER_SHOP_IDS.includes(speciesId)) return null;
  const benchSlot = participant.bench.findIndex(item => !item);
  if (benchSlot < 0 || participant.gold < type.price) return null;
  // Política provisória de pool até Etapa 04: debitar só na compra.
  const available = match.pool[speciesId] ?? RULES.rarityPool[type.rarity];
  if (available <= 0) return null;
  match.pool[speciesId] = available-1;
  participant.gold -= type.price;
  const unit = createSandboxPokemon(speciesId,0,`${match.id}-unit-${++match.nextUnitId}`,random);
  unit.purchaseCost = type.price;
  participant.bench[benchSlot] = unit;
  participant.shop[index] = null;
  match.revision++;
  return unit;
}
export function sellLocalUnit(match, participant, unit) {
  if (match.phase !== 'preparation' || participant.eliminated || !unit) return false;
  const index = participant.bench.indexOf(unit);
  const boardIndex = participant.board.indexOf(unit);
  if (index < 0 && boardIndex < 0) return false;
  if (index >= 0) participant.bench[index] = null;
  if (boardIndex >= 0) participant.board.splice(boardIndex,1);
  // Nesta etapa as únicas compras competitivas são iniciais não evoluídos.
  const type = BY_ID[unit.speciesId];
  participant.gold += unit.purchaseCost ?? type.price;
  match.pool[unit.speciesId] = (match.pool[unit.speciesId] ?? RULES.rarityPool[type.rarity]) + 1;
  match.revision++;
  return true;
}
function botPrepare(match, bot, random = Math.random) {
  const limit = fieldLimitForBattle(match.round);
  // IA econômica preliminar, sem unidades gratuitas ou acesso à loja do humano.
  const target = Math.min(limit+1,3);
  let attempts = 0;
  while (bot.board.length + bot.bench.filter(Boolean).length < target && attempts++ < 12) {
    let offer = bot.shop.findIndex(speciesId => speciesId && bot.gold >= BY_ID[speciesId].price
      && (match.pool[speciesId] ?? RULES.rarityPool[BY_ID[speciesId].rarity]) > 0);
    if (offer < 0) {
      if (!refreshLocalShop(match,bot,random,true)) break;
      continue;
    }
    const unit = purchaseLocalOffer(match,bot,offer,random);
    if (!unit) break;
  }
  while (bot.board.length < limit) {
    const benchIndex = bot.bench.findIndex(Boolean);
    if (benchIndex < 0) break;
    const unit = bot.bench[benchIndex];
    bot.bench[benchIndex] = null;
    unit.col = 3+(bot.board.length % 4);
    unit.row = 8+Math.floor(bot.board.length / 4);
    bot.board.push(unit);
  }
}
export function prepareLocalRound(match, random = Math.random) {
  if (match.phase !== 'preparation') return;
  match.nextUnitId ??= 0;
  for (const player of match.players) {
    if (player.eliminated) continue;
    if (!player.shopLocked) refreshLocalShop(match,player,random);
  }
  for (const bot of match.players.filter(player => player.isBot && !player.eliminated)) botPrepare(match,bot,random);
}
export function awardLocalRoundIncome(match) {
  for (const participant of match.players) {
    if (participant.eliminated) continue;
    const won = match.combats.some(c => c.result?.winnerId === participant.id);
    // Consulta de juros ANTES da renda: convenção provisória da etapa 02.
    participant.gold += RULES.baseRoundGold + (won ? RULES.victoryBonusGold : 0) + interestForGold(participant.gold);
  }
}
