/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../browser/extension/characters-shared.js');
const Aion = require('../browser/extension/shared.js');
const png = fs.readFileSync('tests/fixtures/icon-256.png');

test('character import accepts a real local PNG and rejects active/animated or damaged files', () => {
  assert.deepEqual(C.pngInfo(png), {width:256, height:256});
  assert.throws(() => C.pngInfo(Buffer.from('<svg onload="alert(1)"></svg>')), /characterInvalid/);
  assert.throws(() => C.pngInfo(png.subarray(0, png.length - 4)), /characterInvalid/);
  const enormous = Buffer.from(png); enormous.writeUInt32BE(100000, 16);
  assert.throws(() => C.pngInfo(enormous), /characterTooLarge/);
  const animation = Buffer.alloc(20); animation.writeUInt32BE(8, 0); animation.write('acTL', 4);
  assert.throws(() => C.pngInfo(Buffer.concat([png.subarray(0, 33), animation, png.subarray(33)])), /characterAnimatedPNG/);
});
test('sprite grid bounds prevent invalid crops and imported preferences cannot supply a URL', () => {
  assert.deepEqual(C.rectangles({width:256,height:256}, {columns:4,rows:4,row:1,frames:2,fps:6}), [[0,64,64,64],[64,64,64,64]]);
  for (const grid of [{columns:3}, {row:1}, {columns:2,frames:3}, {fps:0}, {fps:25}, {columns:17}]) assert.throws(() => C.grid({width:256,height:256},grid), /characterGridInvalid/);
  assert.equal(Aion.normalize({character:'https://tracker.example.org/remote.png'}).character,'aion');
  const id='custom-7cd27568-1953-4daf-b927-7e965a0e2b61';
  assert.equal(Aion.normalize({character:id}).character,id);
});
