// Configure raridades e pool em um único lugar. A ordem segue as seis raridades do jogo.
export const RARITY_ORDER = Object.freeze(['comum','incomum','raro','epico','mitico','lendario']);
export const RARITY_ODDS = Object.freeze([
  Object.freeze([33,31,26,9,1,0]),
  Object.freeze([28,31,27,11,2,1]),
  Object.freeze([24,26,29,15,4,2])
]);
export const RARITY_POOL = Object.freeze({comum:24,incomum:22,raro:20,epico:12,mitico:5,lendario:3});
