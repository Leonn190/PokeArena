import test from 'node:test';
import assert from 'node:assert/strict';
import { POKEMON, getDirection, getFrame } from '../src/scripts/pokemon.mjs';
import { BOARD, DEFAULT_TEAMS, createBattle, startBattle, updateBattle, cloneLineups, putPokemon, removePokemon, tilePosition, cellAtPixel, randomLineups, physicalOrSpecialDamage } from '../src/scripts/battle.mjs';

test('elenco contém os 9 iniciais e seis atributos',()=>{
  assert.deepEqual(POKEMON.map(p=>p.name), ['Bulbasaur','Ivysaur','Venusaur','Charmander','Charmeleon','Charizard','Squirtle','Wartortle','Blastoise']);
  for(const p of POKEMON)for(const prop of ['vida','atk','spa','def','spd','vel'])assert.ok(p.stats[prop]>0);
});
test('PMD: esquerda é linha 2, direita 6, norte 4, sul 0',()=>{
  assert.equal(getDirection(-1,0),2);assert.equal(getDirection(1,0),6);
  assert.equal(getDirection(0,-1),4);assert.equal(getDirection(0,1),0);
  assert.equal(getDirection(1,-1),5);assert.equal(getDirection(-1,-1),3);
});
test('quadrados clicáveis respeitam metades e lacuna',()=>{
  for(const gap of [0,36]){
    for(const [col,row]of [[0,0],[7,7],[4,3],[2,4]]){
      const at=tilePosition(col,row,gap);assert.deepEqual(cellAtPixel(at.x,at.y,gap),{col,row});
    }
  }
  assert.equal(BOARD.rows,8);
});
test('escalações permitem remover, adicionar e impedem quarta unidade por equipe',()=>{
  const b=createBattle();
  assert.equal(b.units.length,6);
  assert.equal(putPokemon(b,0,'0004',0,0),false);
  assert.equal(putPokemon(b,0,'0004',5,6),false);
  assert.equal(removePokemon(b,0,2,1),true);
  assert.equal(putPokemon(b,0,'0004',2,1),true);
  assert.equal(b.lineups[0].some(x=>x.id==='0004'),true);
  assert.equal(startBattle(b),true);
  assert.equal(putPokemon(b,0,'0001',3,0),false);
});
test('sorteio inclui seis Pokémon diferentes',()=>{
  const lineups=randomLineups(()=>.6);
  const ids=lineups.flat().map(x=>x.id);
  assert.equal(new Set(ids).size,6);
});
test('ataque físico usa DEF, especial usa SPD, os seis stats têm impacto',()=>{
  const a=POKEMON[5],b=POKEMON[8];
  assert.ok(physicalOrSpecialDamage(a,b,'atk',()=>.5)>0);
  assert.ok(physicalOrSpecialDamage(a,b,'spa',()=>.5)>0);
  const mod={...b,stats:{...b.stats,spd:999}};
  assert.ok(physicalOrSpecialDamage(a,mod,'spa',()=>.5)<physicalOrSpecialDamage(a,b,'spa',()=>.5));
});
test('batalha 3v3 une as duas metades, anda, ataca e acaba com um vencedor',()=>{
  const battle=createBattle();
  assert.ok(startBattle(battle));
  let moved=false,projectile=false,hit=false,seenJoin=false;
  let seed=123456789;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<15000&&battle.phase!=='finished';i++){
    updateBattle(battle,1/60,rand);
    if(battle.phase==='fighting')seenJoin=true;
    if(battle.units.some(u=>u.moveCount>0))moved=true;
    if(battle.projectiles.length)projectile=true;
    if(battle.events.some(e=>e.type==='hit'))hit=true;
  }
  assert.ok(seenJoin);assert.ok(moved);assert.ok(projectile);assert.ok(hit);
  assert.equal(battle.gap,0);
  assert.equal(battle.phase,'finished');
  assert.ok(battle.winner===0||battle.winner===1);
  assert.equal(battle.units.filter(u=>!u.dead&&u.team!==battle.winner).length,0);
});
test('frame loop respeita durações',()=>{
  assert.equal(getFrame([3,3],0),0);
  assert.equal(getFrame([3,3],.055),1);
  assert.equal(getFrame([3,3],.1),0);
});
