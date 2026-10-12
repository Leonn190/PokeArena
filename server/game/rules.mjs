// Regras aprovadas no GDD v0.4. Fonte única para futuras fases competitivas.
// Não substituir decisões [A definir] por convenções definitivas.
export const RULES = Object.freeze({
  version:'0.4',
  minPlayers:3,
  maxPlayers:8,
  startingHp:100,
  startingGold:9,
  preparationSeconds:45,
  battleSeconds:60,
  shopSlots:6,
  flexibleShopSlots:2,
  bankSlots:10,
  equippedMoves:2,
  availableMoves:3,
  baseRoundGold:5,
  victoryBonusGold:1,
  rerollCostGold:2,
  moveChangeCostGold:2,
  maxInterestGold:3,
  maxEquippedItems:2,
  fieldLimits:[1,2,2,3,3,4,5,5,6,6],
  rarityPrice:Object.freeze({comum:1,incomum:2,raro:3,epico:4,mitico:5,lendario:6}),
  rarityPool:Object.freeze({comum:24,incomum:22,raro:20,epico:12,mitico:5,lendario:3}),
  flexibleOdds:Object.freeze({pokemon:.50,item:.25,estrutura:.25}),
  shopRarityOdds:Object.freeze([
    [70,25,5,0,0,0], [62,29,9,0,0,0], [52,32,14,2,0,0],
    [46,34,16,4,0,0], [40,32,20,7,1,0], [30,29,26,12,3,0],
    [24,26,29,16,4,1], [20,25,27,20,6,2], [16,22,27,22,9,4],
    [13,20,26,24,11,6]
  ])
});
export const fieldLimitForBattle = round => RULES.fieldLimits[Math.min(9,Math.max(0,round-1))];
export const basePlayerDamage = round => 1+Math.floor((Math.max(1,round)-1)/2);
export const defeatDamage = (round,survivors) => basePlayerDamage(round)+Math.max(0,survivors);
export const interestForGold = gold => Math.min(RULES.maxInterestGold,Math.floor(Math.max(0,gold)/10));
export const shopOddsForBattle = round => RULES.shopRarityOdds[Math.min(9,Math.max(0,round-1))];
