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
  define({id:'0003',name:'Morteiro de Pólen',kind:'charged',category:'spa',type:'Grama',spaCoefficient:1.1,healCoefficient:.55,areaRadius:1.5,behavior:'pollen',range:3,energyCost:30,description:'Mira a maior concentração de inimigos. Explosão de raio 1,5 célula: 110% do SpA em dano antes das reduções e cura de 55% do SpA para cada aliado vivo na área.',effect:'pollen',color:'#d5e66a',projectile:true,projectileSpeed:330,animationPriority:['Shoot','Charge','Attack']}),
  define({id:'0004',name:'Pancada',kind:'charged',category:'atk',atkCoefficient:1.2,range:1,energyCost:20,description:'Golpe direto em um inimigo: 120% do Atk antes da defesa física.',effect:'pound',color:'#ffd49a',animationPriority:['Kick','Strike','Attack']}),
  define({id:'0005',name:'Bola de Fogo',kind:'charged',category:'spa',type:'Fogo',spaCoefficient:1.25,splashCoefficient:.7,areaRadius:1.2,behavior:'fireball',range:4,energyCost:25,description:'125% do SpA no alvo principal e 70% nos outros inimigos em raio de 1,2 célula. O alvo principal não recebe o dano secundário.',effect:'fire',color:'#ff8c36',projectile:true,projectileSpeed:380,animationPriority:['Shoot','Attack']}),
  define({id:'0006',name:'Lança-Chamas',kind:'charged',category:'spa',type:'Fogo',spaCoefficient:2,behavior:'flamethrower',duration:3,tickInterval:.1,beamWidth:.55,range:3,energyCost:30,description:'Fluxo fixo de fogo durante 3 s: 200% do SpA por inimigo exposto por toda a duração; dano proporcional ao contato.',effect:'fire',color:'#ff8c36',animationPriority:['Charge','Attack']}),
  define({id:'0007',name:'Giro Aquático',kind:'charged',category:'spa',type:'Água',spaCoefficient:1,behavior:'water-spin',duration:2,tickInterval:.5,areaRadius:1.3,reductionBase:.15,reductionPerAtk:.0015,reductionCap:.4,range:1,energyCost:20,description:'Quatro ondas em 2 s, somando 100% do SpA por inimigo em raio de 1,3 célula. Reduz dano recebido em 15% + 0,15 ponto percentual por Atk (máximo 40%) durante o giro.',effect:'water',color:'#75d8ff',animationPriority:['Withdraw','Attack']}),
  define({id:'0008',name:'Ricochete de Concha',kind:'charged',category:'atk',type:'Água',atkCoefficient:.65,defCoefficient:.3,behavior:'ricochet',maxTargets:3,dashSpeed:650,range:3,energyCost:25,description:'Desloca a concha até três inimigos diferentes: 65% do Atk + 30% da Def por acerto, antes da defesa física do alvo. Prioriza o próximo inimigo alcançável mais próximo.',effect:'water',color:'#75d8ff',animationPriority:['Ricochet','Attack']}),
  define({id:'0009',name:'Jato Duplo',kind:'charged',category:'spa',type:'Água',spaCoefficient:4,behavior:'double-jet',duration:1.5,tickInterval:.1,range:4,energyCost:35,description:'Dois jatos simultâneos por 1,5 s em um único alvo: 400% do SpA no total combinado. Encerra se o alvo morrer, sem transferir o dano.',effect:'water',color:'#75d8ff',animationPriority:['Shoot','Attack']})
]);
export const ATTACKS = Object.freeze([...REGULAR_ATTACKS,...CHARGED_ATTACKS,...SPECIES_ATTACKS]);
