// Catálogo ÚNICO de ataques do protótipo. Todos os Pokémon compartilham estes 3.
// Dois golpes equipados simultaneamente; o terceiro é opção para substituição.
// Não adicionar golpes por espécie, buffs, status ou habilidades até decisão do criador.
export const MOVES = Object.freeze([
  Object.freeze({id:'disparo',name:'Disparo',type:'Normal',category:'spa',damage:30,range:3.0,effect:'wave',color:'#a8e5fa',projectile:true,projectileSpeed:430,animationPriority:['Shoot','SpAttack','Special','Attack']}),
  Object.freeze({id:'investida',name:'Investida',type:'Normal',category:'atk',damage:28,range:.38,effect:'tackle',color:'#f6cd89',projectile:false,projectileSpeed:0,animationPriority:['Charge','Tackle','Rush','Attack','Strike']}),
  Object.freeze({id:'ataque-legal',name:'Ataque Legal',type:'Normal',category:'atk',damage:34,range:.9,effect:'slash',color:'#fff4b9',projectile:false,projectileSpeed:0,animationPriority:['Slash','Cut','Scratch','Strike','Attack']})
]);
export const MOVES_BY_ID = Object.freeze(Object.fromEntries(MOVES.map(move => [move.id, move])));
export const movePool = (_speciesId) => MOVES;
export const initialLoadout = (_speciesId) => ['disparo','investida'];
export function chooseMoveAnimation(move, available) {
  for (const name of move.animationPriority) if (available?.[name]) return name;
  return available?.Attack ? 'Attack' : available?.Idle ? 'Idle' : 'Attack';
}
export const animationCandidates = () => [...new Set(MOVES.flatMap(move => move.animationPriority))];
