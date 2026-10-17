// Regulares genéricos e habilidades. Só a habilidade configura o alcance nativo
// (alcance = quantidade de células; dano = potência antes de Atk/SpA e defesas).
// animationPriority contém SOMENTE nomes de animações reais do PMDCollab.
export const ENERGY_PER_ATTACK = 5;

const define = (move) => Object.freeze({
  type:'Normal', energyCost:0, effect:'impact', projectile:false,
  projectileSpeed:0, ...move,
  animationPriority:Object.freeze([...move.animationPriority])
});
export const REGULAR_ATTACKS = Object.freeze([
  define({id:'disparo',name:'Disparo',kind:'regular',category:'atk',damage:24,description:'Disparo físico automático.',effect:'impact',color:'#ffd49a',projectile:true,projectileSpeed:490,animationPriority:['Shoot','Attack']}),
  define({id:'tapa',name:'Tapa',kind:'regular',category:'atk',damage:26,description:'Golpe físico corpo a corpo.',effect:'impact',color:'#ffd49a',animationPriority:['Strike','Scratch','Attack']}),
  define({id:'energia',name:'Energia',kind:'regular',category:'spa',damage:25,description:'Dano especial de contato.',effect:'pulse',color:'#80caff',animationPriority:['SpAttack','Charge','Attack']}),
  define({id:'tiro-energia',name:'Tiro de Energia',kind:'regular',category:'spa',damage:23,description:'Projétil especial de longo alcance.',effect:'pulse',color:'#81dcff',projectile:true,projectileSpeed:500,animationPriority:['Shoot','SpAttack','Attack']})
]);
export const CHARGED_ATTACKS = Object.freeze([
  define({id:'disparo-carregado',name:'Disparo Carregado',kind:'charged',category:'atk',damage:76,range:3,energyCost:20,description:'Disparo físico reforçado.',effect:'impact',color:'#ffbf65',projectile:true,projectileSpeed:540,animationPriority:['Shoot','Attack']}),
  define({id:'tapa-carregado',name:'Tapa Carregado',kind:'charged',category:'atk',damage:80,range:1,energyCost:20,description:'Golpe físico reforçado de contato.',effect:'impact',color:'#ffb669',animationPriority:['Strike','Charge','Attack']}),
  define({id:'energia-carregada',name:'Energia Carregada',kind:'charged',category:'spa',damage:77,range:1,energyCost:20,description:'Pulso especial reforçado de contato.',effect:'pulse',color:'#7bbdff',animationPriority:['SpAttack','Charge','Attack']}),
  define({id:'tiro-energia-carregado',name:'Tiro de Energia Carregado',kind:'charged',category:'spa',damage:72,range:3,energyCost:20,description:'Projétil especial reforçado.',effect:'pulse',color:'#4ae4ff',projectile:true,projectileSpeed:560,animationPriority:['Shoot','SpAttack','Attack']})
]);
export const SPECIES_ATTACKS = Object.freeze([
  define({id:'0001',name:'Tiro de Semente',kind:'charged',category:'spa',type:'Grama',spaCoefficient:.4,shots:3,shotInterval:.12,behavior:'seeds',range:4,energyCost:20,description:'Três sementes no mesmo alvo, com intervalo de 0,12 s. Cada acerto causa 40% do SpA antes das reduções (120% no total).',effect:'seed',color:'#8cd45b',projectile:true,projectileSpeed:490,animationPriority:['Shoot','Attack']}),
  define({id:'0002',name:'Chicote de Vinha',kind:'charged',category:'atk',type:'Grama',atkCoefficient:.8,behavior:'vines',coneHalfAngle:Math.PI/5,pullDistance:.55,range:2,energyCost:25,description:'Cone de vinhas: 80% do Atk antes das defesas, uma vez por inimigo. Agrupa os atingidos lateralmente em direção ao centro do cone.',effect:'vine',color:'#63c755',animationPriority:['Whip','Attack']}),
  define({id:'0003',name:'Morteiro de Pólen',kind:'charged',category:'spa',type:'Grama',spaCoefficient:1.1,healCoefficient:.55,areaRadius:1.5,behavior:'pollen',range:3,energyCost:30,description:'Mira a maior concentração de inimigos. Explosão de raio 1,5 célula: 110% do SpA em dano antes das reduções e cura de 55% do SpA para cada aliado vivo na área.',effect:'pollen',color:'#d5e66a',projectile:true,projectileSpeed:330,animationPriority:['Shoot','Charge','Attack']})
]);
export const ATTACKS = Object.freeze([...REGULAR_ATTACKS,...CHARGED_ATTACKS,...SPECIES_ATTACKS]);
