import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, getSpriteFrame, updateBattle } from '../src/scripts/battle.mjs';

test('a luta comeca com dois Pokemon distantes e com vida cheia', () => {
  const game = createBattle();
  assert.equal(game.fighters.length, 2);
  assert.equal(game.fighters[0].health, 100);
  assert.equal(game.fighters[1].health, 100);
  assert.equal(game.phase, 'approaching');
});

test('eles se aproximam, atiram e param quando um perde toda a vida', () => {
  const game = createBattle();
  const startingDistance = game.fighters[1].x - game.fighters[0].x;
  let shots = 0, hits = 0, finished = 0;
  for (let frame = 0; frame < 2000 && game.phase !== 'finished'; frame++) {
    updateBattle(game, 1 / 60, () => .6);
    shots += game.events.filter(e => e.type === 'shot').length;
    hits += game.events.filter(e => e.type === 'damage').length;
    finished += game.events.filter(e => e.type === 'finish').length;
  }
  assert.ok(game.fighters[1].x - game.fighters[0].x < startingDistance);
  assert.ok(shots > 0);
  assert.ok(hits > 0);
  assert.equal(finished, 1);
  assert.equal(game.phase, 'finished');
  assert.notEqual(game.winner, null);
  assert.equal(game.fighters[1 - game.winner].health, 0);
  const loser = game.fighters[1 - game.winner];
  updateBattle(game, 1, () => .6);
  assert.equal(loser.health, 0);
});

test('frames respeitam as duracoes PMD', () => {
  assert.equal(getSpriteFrame([2, 3, 1], 0), 0);
  assert.equal(getSpriteFrame([2, 3, 1], 2 / 60), 1);
  assert.equal(getSpriteFrame([2, 3, 1], 5 / 60), 2);
  assert.equal(getSpriteFrame([2, 3, 1], 6 / 60), 0);
  assert.equal(getSpriteFrame([2, 3, 1], 6 / 60, false), 2);
});
