// SPDX-License-Identifier: MPL-2.0
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function fixture() {
  const instances = [], deleted = [], states = [];
  const pin = {cache: 'fire-axolotl-qwen-test', id:'pinned-model', revision:'pinned-revision'};
  class Worker {
    constructor() {instances.push(this); this.messages = [];}
    postMessage(message) {this.messages.push(message);}
    terminate() {this.terminated = true;}
  }
  const browser = {runtime: {id:'test', getURL:path=>'moz-extension://test/'+path,
    onConnect:{addListener:()=>{}},sendMessage:async message=>states.push(message)}};
  const context = vm.createContext({browser, Worker, fetch:async()=>({json:async()=>pin}), caches:{delete:async name=>deleted.push(name)}});
  vm.runInContext(fs.readFileSync('browser/extension/ai-service.js','utf8'),context);
  return {service:context.AionLocalAI, instances, deleted, states};
}
const turn = () => new Promise(resolve=>setImmediate(resolve));
test('one shared local AI rejects overlapping inference and uses only the packaged model pin', async () => {
  const f=fixture();
  const loading=f.service.call({action:'load',download:true,pin:{id:'attacker'}});
  await turn(); const worker=f.instances[0], request=worker.messages[0];
  assert.equal(request.pin.id,'pinned-model');
  await assert.rejects(f.service.call({action:'translate',text:'hello'}),/aiBusy/);
  worker.onmessage({data:{id:request.id,result:{ready:true}}}); await loading;
  assert.equal((await f.service.call({action:'status'})).phase,'ready');
});
test('cancel rejects the pending task, terminates its worker and does not delete cached weights', async () => {
  const f=fixture();const task=f.service.call({action:'load'});await turn();
  const rejected=assert.rejects(task,/aiCancelled/);
  await f.service.call({action:'cancel'});await rejected;
  assert.equal(f.instances[0].terminated,true);assert.deepEqual(f.deleted,[]);
  assert.equal((await f.service.call({action:'status'})).phase,'unloaded');
  await f.service.call({action:'clear'});
  assert.deepEqual(f.deleted,['fire-axolotl-qwen-test']);
});
