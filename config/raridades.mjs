// Probabilidades exatas em %, seis faixas de meia etapa por capítulo.
export const RARITY_ORDER=Object.freeze(['comum','incomum','raro','epico','mitico','lendario']);
export const RARITY_ODDS=Object.freeze([
  [39,34,27,0,0,0],
  [36,33,30,1,0,0],
  [34,33,31,1.5,.5,0],
  [31,33,32,2.5,1.3,.2],
  [27,31,34,5.5,2,.5],
  [23,27,32,12,5,1]
].map(row=>Object.freeze(row)));
export const RARITY_POOL=Object.freeze({comum:24,incomum:22,raro:20,epico:12,mitico:5,lendario:3});
