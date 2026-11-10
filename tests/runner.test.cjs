/* SPDX-License-Identifier: MPL-2.0 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const source = import('../browser/extension/runner/world.sys.mjs');

test('runner starts explicitly, pauses without advancing and resets on replay', async () => {
  const {RunnerWorld} = await source;
  const world = new RunnerWorld(() => 0);
  world.step(1 / 60); assert.equal(world.time, 0);
  world.jump(); assert.equal(world.velocity, 0);
  world.start(); world.jump(); world.step(1 / 60); assert.ok(world.y < 0);
  const velocity = world.velocity; world.jump(); assert.equal(world.velocity, velocity);
  world.pause(); const snapshot = JSON.stringify(world); world.step(1 / 60); assert.equal(JSON.stringify(world), snapshot);
  world.start(); assert.ok(world.y < 0);
  world.status = 'ice'; world.start(); assert.equal(world.score, 0); assert.equal(world.y, 0);
});

test('both obstacles collide on the body and can be cleared with a normal jump', async () => {
  const {RunnerWorld} = await source;
  for (const type of ['ice', 'fire']) {
    const hit = new RunnerWorld(); hit.start(); hit.obstacles.push({x: 149, type}); hit.step(1 / 120); assert.equal(hit.status, type);
    const jump = new RunnerWorld(); jump.start(); jump.obstacles.push({x: 210, type}); jump.jump();
    for (let frame = 0; frame < 120; frame++) jump.step(1 / 120);
    assert.equal(jump.status, 'running'); assert.equal(jump.score, 1); assert.equal(jump.y, 0);
  }
});

test('realistic obstacle spacing stays clearable across frame rates and later speeds', async () => {
  const {RunnerWorld} = await source;
  for (const fps of [30, 60, 120]) {
    const world = new RunnerWorld(() => 0.25); world.start(); world.score = 40;
    for (let frame = 0; frame < fps * 25; frame++) {
      if (world.obstacles.some(o => o.x > 150 && o.x < 240)) world.jump();
      world.step(1 / fps);
      assert.equal(world.status, 'running');
    }
    assert.ok(world.score > 45);
  }
});
