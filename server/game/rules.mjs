import {ECONOMY} from '../../config/economia.mjs';
import {RARITY_ODDS,RARITY_POOL} from '../../config/raridades.mjs';
import {NIVEIS} from '../../config/niveis.mjs';
import {RARITY_PRICES} from '../../config/precos.mjs';
// Regras do GDD v0.4 para partidas locais; reutilizáveis futuramente pelo servidor.
// Não substituir decisões [A definir] por convenções definitivas.
export const RULES = Object.freeze({
  version:'chapters-1',
  minPlayers:3,
  maxPlayers:8,
  startingHp:ECONOMY.startingHp,
  startingGold:ECONOMY.startingGold,
  preparationSeconds:30,
  battleIntroSeconds:3,
  battleSeconds:30,
  shopSlots:ECONOMY.shopSlots,
  flexibleShopSlots:ECONOMY.flexibleShopSlots,
  bankSlots:ECONOMY.bankSlots,
  equippedMoves:2,
  availableMoves:4,
  baseRoundGold:ECONOMY.baseRoundGold,
  victoryBonusGold:ECONOMY.victoryBonusGold,
  rerollCostGold:ECONOMY.rerollCostGold,
  moveChangeCostGold:ECONOMY.moveChangeCostGold,
  maxInterestGold:ECONOMY.maxInterestGold,
  maxEquippedItems:2,
  fieldLimits:[1,1,1,2,2,2,2,3,3,3,4,4,4,5,5,5,5,6,6,6],
  rarityPrice:RARITY_PRICES,
  rarityPool:RARITY_POOL,
  flexibleOdds:Object.freeze({pokemon:ECONOMY.flexiblePokemonChance,item:0,estrutura:ECONOMY.flexibleStructureChance}),
  niveis:NIVEIS,
  shopRarityOdds:RARITY_ODDS
});
export const chapterForBattle = round => Math.floor((Math.max(1,round)-1)/10)+1;
export const stageForBattle = round => (Math.max(1,round)-1)%10+1;
export const STAGES = Object.freeze(['normal','gold','normal','quadruple','pve','normal','double','normal','quadruple','legendary']);
export const STAGE_NAMES = Object.freeze({normal:'Batalha normal',gold:'Batalha do ouro',pve:'PvE',double:'Dano dobrado',quadruple:'Batalha quádrupla',legendary:'Lendário'});
export const battleKind = round => STAGES[stageForBattle(round)-1];
export const fieldLimitForBattle = round => RULES.fieldLimits[Math.min(19,Math.max(0,round-1))];
export const basePlayerDamage = chapterForBattle;
export const roomModifier = count => Math.floor((count-3)/2);
export const defeatDamage = (round,survivors,modifier=0) => (modifier+chapterForBattle(round)+survivors.reduce((sum,u)=>sum+(chapterForBattle(round)>1&&u.health/u.maxHealth>.75?2:1),0))*(battleKind(round)==='double'?2:1);
export const placementDamage = (round,place,modifier=0) => place===1?0:modifier+chapterForBattle(round)+[0,0,1,4,9][place];
export const streakBonus = count => Math.min(3,Math.max(0,count-2));
export const bossIv = chapter => chapter===1?100:chapter===2?500:(chapter-2)*1000;
export const PVE_DIFFICULTIES=Object.freeze({easy:{name:'Fácil',countOffset:-1,stats:.8,hp:.8,offense:.8,points:2},medium:{name:'Médio',countOffset:0,stats:1,hp:1,offense:1,points:4},hard:{name:'Difícil',countOffset:0,stats:1,hp:1.25,offense:1.25,points:6}});
export const interestForGold = gold => Math.min(RULES.maxInterestGold,Math.floor(Math.max(0,gold)/10));
// Etapas 1–5: início do capítulo; 6–10: segunda metade.
export const shopOddsForBattle = round => RULES.shopRarityOdds[Math.min(5,(Math.min(3,chapterForBattle(round))-1)*2+(stageForBattle(round)>5?1:0))];
