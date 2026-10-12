// Cada espécie possui 8 golpes: 2 equipados + 6 possíveis para trocar/equipar.
// Os alcances são medidos a partir da borda do corpo (em células de 76px), não do centro.
// As prioridades são nomes exatos usados pelo PMDCollab em AnimData.xml.
const MOVE_BOOK={
 '0001':[['Investida','atk',25,.30,'tackle'],['Chicote de Vinha','atk',32,1.05,'vine'],['Folha Navalha','spa',36,3.15,'leaf'],['Semente','spa',28,2.8,'seed'],['Cabeçada','atk',36,.35,'tackle'],['Corte','atk',27,.55,'slash'],['Pó de Folha','spa',24,2.65,'leaf'],['Rajada Verde','spa',42,2.25,'leaf']],
 '0002':[['Chicote de Vinha','atk',35,1.10,'vine'],['Folha Navalha','spa',41,3.3,'leaf'],['Investida','atk',30,.30,'tackle'],['Semente','spa',34,2.8,'seed'],['Corte','atk',37,.6,'slash'],['Cabeçada','atk',43,.35,'tackle'],['Pó de Folha','spa',33,2.4,'leaf'],['Chuva Verde','spa',47,2.5,'leaf']],
 '0003':[['Pancada de Cipó','atk',54,.8,'vine'],['Raio Solar','spa',63,3.8,'beam'],['Folha Navalha','spa',50,3.25,'leaf'],['Investida','atk',45,.4,'tackle'],['Cabeçada','atk',58,.45,'tackle'],['Semente','spa',47,2.75,'seed'],['Rugido','spa',42,1.65,'wave'],['Furacão Floral','spa',62,2.7,'leaf']],
 '0004':[['Arranhão','atk',27,.35,'slash'],['Brasa','spa',31,3.05,'flame'],['Mordida','atk',29,.4,'bite'],['Investida','atk',25,.35,'tackle'],['Chama Curta','spa',28,1.55,'flame'],['Giro de Cauda','atk',31,.55,'spin'],['Faíscas','spa',25,2.5,'flame'],['Golpe Rápido','atk',27,.55,'slash']],
 '0005':[['Garra Flamejante','atk',41,.55,'slash'],['Lança-chamas','spa',46,3.35,'flame'],['Mordida','atk',37,.4,'bite'],['Giro de Cauda','atk',36,.65,'spin'],['Brasa','spa',38,3.15,'flame'],['Investida','atk',34,.35,'tackle'],['Explosão de Brasas','spa',48,2.15,'flame'],['Corte','atk',40,.65,'slash']],
 '0006':[['Garra de Dragão','atk',60,.60,'slash'],['Lança-chamas','spa',66,3.9,'flame'],['Golpe de Asa','atk',55,.75,'wing'],['Brasa','spa',41,3.1,'flame'],['Mordida','atk',52,.5,'bite'],['Giro Flamejante','spa',57,2.5,'spin'],['Investida','atk',49,.45,'tackle'],['Rajada de Fogo','spa',72,3.3,'flame']],
 '0007':[['Investida','atk',24,.34,'tackle'],['Jato d’Água','spa',32,3.1,'water'],['Bolhas','spa',26,3.2,'water'],['Cabeçada','atk',31,.45,'tackle'],['Giro','atk',32,.55,'spin'],['Mordida','atk',26,.42,'bite'],['Onda Curta','spa',29,1.5,'wave'],['Rajada Azul','spa',39,2.25,'water']],
 '0008':[['Giro Rápido','atk',39,.55,'spin'],['Jato d’Água','spa',43,3.35,'water'],['Mordida','atk',37,.45,'bite'],['Bolhas','spa',35,2.95,'water'],['Investida','atk',32,.32,'tackle'],['Cabeçada','atk',42,.5,'tackle'],['Onda Curta','spa',37,1.6,'wave'],['Rajada Azul','spa',48,2.3,'water']],
 '0009':[['Hidro Bomba','spa',66,4.0,'water'],['Giro de Casco','atk',59,.7,'spin'],['Jato d’Água','spa',49,3.3,'water'],['Mordida','atk',46,.55,'bite'],['Investida','atk',44,.4,'tackle'],['Cabeçada','atk',56,.5,'tackle'],['Onda Forte','spa',54,2.2,'wave'],['Bolhas','spa',40,3.0,'water']]
};
const ANIMS={
 tackle:['Charge','Tackle','Rush','Attack','Strike'],
 vine:['Whip','Stab','Strike','Attack'],
 leaf:['Shoot','SpAttack','Special','Attack'],
 seed:['Shoot','SpAttack','Attack'],
 beam:['SpAttack','Shoot','Special','Attack'],
 slash:['Slash','Cut','Scratch','Strike','Attack'],
 bite:['Bite','Chomp','Attack'],
 flame:['SpAttack','Shoot','Special','Attack'],
 wing:['WingAttack','Strike','Attack'],
 spin:['Spin','Roll','Attack'],
 water:['Shoot','SpAttack','Special','Attack'],
 wave:['SpAttack','Shoot','Attack']
};
const COLORS={leaf:'#8be568',seed:'#a7e572',vine:'#5acb72',beam:'#ffe88c',tackle:'#f6cd89',slash:'#fff4b9',bite:'#f8bc7e',flame:'#ff884e',wing:'#bdeff4',spin:'#d3d9fc',water:'#69d6ff',wave:'#aeddf7'};
export const MOVE_POOLS=Object.fromEntries(Object.entries(MOVE_BOOK).map(([id,list])=>[id,list.map(([name,category,damage,range,effect],i)=>({id:`${id}-${i}`,name,category,damage,range,effect,color:COLORS[effect],animationPriority:ANIMS[effect],projectile:['water','flame','leaf','seed','beam','wave'].includes(effect),projectileSpeed:effect==='beam'?640:effect==='seed'?340:430}))]));
export const MOVES_BY_ID=Object.fromEntries(Object.values(MOVE_POOLS).flat().map(m=>[m.id,m]));
export const movePool=id=>MOVE_POOLS[id]||[];
export const initialLoadout=id=>movePool(id).slice(0,2).map(m=>m.id);
export function chooseMoveAnimation(move,available){
  for(const name of move.animationPriority)if(available?.[name])return name;
  return available?.Attack?'Attack':available?.Idle?'Idle':'Attack';
}
export const animationCandidates=()=>[...new Set(Object.values(MOVE_POOLS).flatMap(pool=>pool.flatMap(move=>move.animationPriority)))];
