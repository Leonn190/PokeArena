// Os oito ataques universais. O dano e o alcance estão em unidades do motor
// (alcance = quantidade de células; dano = potência antes de Atk/SpA e defesas).
// animationPriority contém SOMENTE nomes de animações reais do PMDCollab.
export const ENERGY_PER_SECOND = 1;
export const BASE_REGENERATION_PER_SECOND = 0;

const define = (move) => Object.freeze({
  type:'Normal', energyCost:0, effect:'impact', projectile:false,
  projectileSpeed:0, ...move,
  animationPriority:Object.freeze([...move.animationPriority])
});
export const REGULAR_ATTACKS = Object.freeze([
  define({id:'disparo',name:'Disparo',kind:'regular',category:'atk',damage:24,range:3.5,description:'Disparo físico de longo alcance.',effect:'impact',color:'#ffd49a',projectile:true,projectileSpeed:490,animationPriority:['Shoot','Attack']}),
  define({id:'tapa',name:'Tapa',kind:'regular',category:'atk',damage:26,range:.6,description:'Golpe físico corpo a corpo.',effect:'impact',color:'#ffd49a',animationPriority:['Strike','Scratch','Attack']}),
  define({id:'energia',name:'Energia',kind:'regular',category:'spa',damage:25,range:.6,description:'Dano especial de contato.',effect:'pulse',color:'#80caff',animationPriority:['SpAttack','Charge','Attack']}),
  define({id:'tiro-energia',name:'Tiro de Energia',kind:'regular',category:'spa',damage:23,range:3.5,description:'Projétil especial de longo alcance.',effect:'pulse',color:'#81dcff',projectile:true,projectileSpeed:500,animationPriority:['Shoot','SpAttack','Attack']})
]);
export const CHARGED_ATTACKS = Object.freeze([
  define({id:'disparo-carregado',name:'Disparo Carregado',kind:'charged',category:'atk',damage:76,range:3.5,energyCost:4,description:'Disparo físico reforçado.',effect:'impact',color:'#ffbf65',projectile:true,projectileSpeed:540,animationPriority:['Shoot','Attack']}),
  define({id:'tapa-carregado',name:'Tapa Carregado',kind:'charged',category:'atk',damage:80,range:.6,energyCost:4,description:'Golpe físico reforçado de contato.',effect:'impact',color:'#ffb669',animationPriority:['Strike','Charge','Attack']}),
  define({id:'energia-carregada',name:'Energia Carregada',kind:'charged',category:'spa',damage:77,range:.6,energyCost:4,description:'Pulso especial reforçado de contato.',effect:'pulse',color:'#7bbdff',animationPriority:['SpAttack','Charge','Attack']}),
  define({id:'tiro-energia-carregado',name:'Tiro de Energia Carregado',kind:'charged',category:'spa',damage:72,range:3.5,energyCost:4,description:'Projétil especial reforçado.',effect:'pulse',color:'#4ae4ff',projectile:true,projectileSpeed:560,animationPriority:['Shoot','SpAttack','Attack']})
]);
export const ATTACKS = Object.freeze([...REGULAR_ATTACKS,...CHARGED_ATTACKS]);
