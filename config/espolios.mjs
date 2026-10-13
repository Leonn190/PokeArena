// Quantidade de pontos e recompensas mantidas do sistema atual.
export const LOOT_TIERS = Object.freeze({
  gray:Object.freeze({points:1,gold:[1,4],balls:['pokeball'],rarities:['comum','incomum'],cap:5}),
  blue:Object.freeze({points:2,gold:[5,10],balls:['greatball','ultraball'],rarities:['incomum','raro'],cap:12}),
  yellow:Object.freeze({points:4,gold:[12,18],balls:['ultraball','masterball'],rarities:['raro','epico','mitico'],cap:20})
});
export const BALL_CONFIG=Object.freeze({
  pokeball:Object.freeze({name:'Pokébola',value:2,chances:[1,.5,0,0,0,0]}),
  greatball:Object.freeze({name:'Great Ball',value:5,chances:[1,1,.5,0,0,0]}),
  ultraball:Object.freeze({name:'Ultra Ball',value:8,chances:[1,1,1,.5,0,0]}),
  masterball:Object.freeze({name:'Master Ball',value:12,chances:[1,1,1,1,0,0]})
});
