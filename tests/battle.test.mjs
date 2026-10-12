import test from 'node:test';
import assert from 'node:assert/strict';
import { POKEMON, getDirection,getFrame } from '../src/scripts/pokemon.mjs';
import { BOARD,DEFAULT_TEAMS,createBattle,startBattle,updateBattle,putPokemon,putPokemonAt,removePokemon,cellAtPixel,tilePosition,randomLineups,physicalOrSpecialDamage,attackInterval,moveSpeed,updateLoadout,attackRangePixels,effectiveAttackRange } from '../src/scripts/battle.mjs';
import { movePool,chooseMoveAnimation } from '../src/scripts/moves.mjs';
const rand=(()=>{let state=1234567;return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296)})();
test('v3 mantém nove Pokémon e seis atributos',()=>{
  assert.equal(POKEMON.length,9);for(const p of POKEMON)for(const k of ['vida','atk','spa','def','spd','vel'])assert.ok(p.stats[k]>0);
});
test('mundo 10x5, direções PMD e coordenadas contínuas',()=>{
  assert.equal(BOARD.columns,10);assert.equal(BOARD.rows,5);
  for(const [col,row] of [[0,0],[9,4],[4,3]]){const p=tilePosition(col,row);assert.deepEqual(cellAtPixel(p.x,p.y),{col,row});}
  assert.equal(getDirection(-1,0),2);assert.equal(getDirection(1,0),6);assert.equal(getDirection(0,1),0);
});
test('movimentos livres, restrições de equipe e colisão ao posicionar',()=>{
  const b=createBattle();assert.equal(b.units.length,6);
  assert.equal(putPokemon(b,0,'0004',0,0),false); // lotada
  assert.equal(removePokemon(b,0,1,1),true);
  assert.equal(putPokemonAt(b,0,'0004',210.5,174.2),true);
  assert.equal(b.lineups[0].find(u=>u.id==='0004').x,210.5);
  assert.equal(putPokemonAt(b,0,'0002',650,200),false); // território oposto
  assert.equal(putPokemonAt(b,0,'0004',b.lineups[0][0].x,b.lineups[0][0].y),false);
});
test('cada Pokémon possui dois ataques ativos e seis possíveis',()=>{
  const b=createBattle();
  for(const p of POKEMON){const pool=movePool(p.id);assert.equal(pool.length,8);assert.ok(pool.every(m=>m.damage>0&&m.range>0&&m.animationPriority.length));}
  const p=b.lineups[0][0],pool=movePool(p.id);
  assert.equal(p.activeMoves.length,2);
  assert.equal(updateLoadout(b,p.id,[pool[3].id,pool[6].id]),true);
  assert.deepEqual(b.units.find(u=>u.type.id===p.id).activeMoves,[pool[3].id,pool[6].id]);
  assert.equal(updateLoadout(b,p.id,[pool[3].id,pool[3].id]),false);
});
test('prioridades de animação respeitam disponibilidade e fallback padrão',()=>{
  const move=movePool('0004')[0];
  assert.equal(chooseMoveAnimation(move,{Scratch:{},Attack:{}}),'Scratch');
  assert.equal(chooseMoveAnimation(move,{Attack:{}}),'Attack');
  assert.equal(chooseMoveAnimation(move,{Idle:{}}),'Idle');
  assert.equal(getFrame([3,3],.055),1);
});
test('VEL altera velocidade real e intervalo de ataque',()=>{
  assert.ok(moveSpeed({vel:100})>moveSpeed({vel:45}));
  assert.ok(attackInterval({vel:100})<attackInterval({vel:45}));
  const a=POKEMON[5],b=POKEMON[8];
  assert.ok(physicalOrSpecialDamage(a,b,'atk',()=>.5,50)>0);
  const veryDefensive={...b,stats:{...b.stats,spd:600}};
  assert.ok(physicalOrSpecialDamage(a,veryDefensive,'spa',()=>.5,50)<physicalOrSpecialDamage(a,b,'spa',()=>.5,50));
  assert.ok(attackRangePixels(movePool('0006')[1])>attackRangePixels(movePool('0006')[0]));
  const unit=createBattle().units[0];assert.ok(effectiveAttackRange(unit,movePool('0001')[0])>=attackRangePixels(movePool('0001')[0]));
});
test('não começa automaticamente e não atualiza na preparação',()=>{
  const b=createBattle(),at=b.units[0].x;
  for(let i=0;i<600;i++)updateBattle(b,1/60,rand);
  assert.equal(b.phase,'setup');assert.equal(b.units[0].x,at);
});
test('início manual, deslocamento contínuo, ataques com projétil e vitória',()=>{
  const b=createBattle();assert.ok(startBattle(b));let moved=false,hit=false,shot=false,cast=false;
  for(let i=0;i<26000&&b.phase!=='finished';i++){
    updateBattle(b,1/60,rand);
    if(b.units.some(u=>u.distanceMoved>1))moved=true;
    if(b.units.some(u=>u.cast))cast=true;
    if(b.projectiles.length)shot=true;
    if(b.events.some(e=>e.type==='hit'))hit=true;
    for(const u of b.units){assert.ok(u.x>=BOARD.x&&u.x<=BOARD.x+10*BOARD.tile);assert.ok(u.y>=BOARD.y&&u.y<=BOARD.y+5*BOARD.tile);}
  }
  assert.ok(moved);assert.ok(cast);assert.ok(hit);assert.ok(shot);
  assert.equal(b.phase,'finished');assert.ok([0,1].includes(b.winner));
});
test('sorteio forma duas equipes de 3 sem repetir',()=>{
 const b=createBattle(randomLineups(rand));assert.equal(new Set(b.units.map(u=>u.type.id)).size,6);
 assert.equal(b.units.filter(u=>u.team===0).length,3);
});
