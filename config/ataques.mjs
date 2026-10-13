// APENAS quatro golpes globais: dois regulares e dois carregados; cada par inclui melee/ranged.
// Golpes carregados usam energia acumulada a 1 ponto/segundo. O custo é debitado ao começar.
export const ENERGY_PER_SECOND = 1;
export const BASE_REGENERATION_PER_SECOND = 0;
export const ATTACKS = Object.freeze([
  Object.freeze({id:'investida',name:'Investida',kind:'regular',type:'Normal',category:'atk',damage:25,range:.55,effect:'tackle',color:'#ffe3a4',projectile:false,projectileSpeed:0,energyCost:0,animationPriority:['Charge','Tackle','Rush','QuickStrike','Attack','Strike']}),
  Object.freeze({id:'disparo',name:'Disparo',kind:'regular',type:'Normal',category:'spa',damage:23,range:3.2,effect:'wave',color:'#99dcff',projectile:true,projectileSpeed:430,energyCost:0,animationPriority:['Shoot','SpAttack','Special','Attack']}),
  Object.freeze({id:'impacto',name:'Impacto',kind:'charged',type:'Normal',category:'atk',damage:75,range:.8,effect:'slash',color:'#f7c66b',projectile:false,projectileSpeed:0,energyCost:4,animationPriority:['Superpower','Punch','Strike','Slash','Attack']}),
  Object.freeze({id:'raio-energia',name:'Raio de Energia',kind:'charged',type:'Normal',category:'spa',damage:66,range:3.8,effect:'wave',color:'#55c6ff',projectile:true,projectileSpeed:560,energyCost:4,animationPriority:['Beam','Shoot','SpAttack','Special','Attack']})
]);
