import {ACTION_PRICES} from './precos.mjs';
// Valores editáveis da economia e da loja de partida local.
export const ECONOMY = Object.freeze({
  startingHp:100,startingGold:9,shopSlots:6,flexibleShopSlots:2,bankSlots:10,
  rerollCostGold:ACTION_PRICES.reroll,moveChangeCostGold:ACTION_PRICES.changeMove,baseRoundGold:5,victoryBonusGold:1,
  maxInterestGold:3,flexiblePokemonChance:.6,flexibleStructureChance:.4
});
