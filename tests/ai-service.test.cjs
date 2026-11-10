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
  const browser = {i18n:{detectLanguage:async()=>({isReliable:false,languages:[]})},runtime: {id:'test', getURL:path=>'moz-extension://test/'+path,
    onConnect:{addListener:()=>{}},sendMessage:async message=>states.push(message)}};
  const context = vm.createContext({browser, Worker, fetch:async url=>({json:async()=>url.endsWith('translation-model.json')?{id:'m2m-pinned',cache:'m2m-cache',languages:['en','tr']}:pin}), caches:{delete:async name=>deleted.push(name)}});
  vm.runInContext(fs.readFileSync('browser/extension/ai-service.js','utf8'),context);
  return {service:context.AionLocalAI, instances, deleted, states, browser};
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

test('translator uses a fixed model pin and refuses unreliable language detection', async () => {
  const f=fixture();
  await assert.rejects(f.service.call({action:'load',modelKind:'../../remote'}),/unknownAction/);
  const loading=f.service.call({action:'load',modelKind:'m2m'});await turn();
  const worker=f.instances[0],request=worker.messages[0];assert.equal(request.pin.id,'m2m-pinned');
  worker.onmessage({data:{id:request.id,result:{ready:true}}});await loading;
  await assert.rejects(f.service.call({action:'generate',text:'hello'}),/aiGeneralQwenOnly/);
  await assert.rejects(f.service.call({action:'translate',source:'auto',text:'hello'}),/aiSourceRequired/);
  assert.equal(worker.messages.length,1);
  await assert.rejects(f.service.call({action:'translate',source:'en',target:'xx',text:'hello'}),/aiTargetUnsupported/);
  const translation=f.service.call({action:'translate',source:'en',target:'tr',text:'hello'});await turn();
  const job=worker.messages[1];assert.equal(job.pin.id,'m2m-pinned');assert.equal(job.source,'en');
  worker.onmessage({data:{id:job.id,result:{text:'Merhaba'}}});assert.equal((await translation).text,'Merhaba');
  await f.service.call({action:'clear',modelKind:'m2m'});assert.deepEqual(f.deleted,['m2m-cache']);
});
test('a cancelled language detection cannot restart an unloaded model', async () => {
  const f=fixture();const load=f.service.call({action:'load',modelKind:'m2m'});await turn();
  const worker=f.instances[0];worker.onmessage({data:{id:worker.messages[0].id,result:{ready:true}}});await load;
  let finish;f.browser.i18n.detectLanguage=()=>new Promise(resolve=>{finish=resolve;});
  const task=f.service.call({action:'translate',source:'auto',text:'Hello'});await turn();
  await f.service.call({action:'unload'});finish({isReliable:true,languages:[{language:'en',percentage:99}]});
  await assert.rejects(task,/aiModelMissing/);assert.equal(worker.messages.length,1);
});

test('an old detection or worker callback cannot affect a reloaded model of the same kind', async () => {
  const f=fixture();
  async function load() { const task=f.service.call({action:'load',modelKind:'m2m'});await turn();const w=f.instances.at(-1);w.onmessage({data:{id:w.messages[0].id,result:{ready:true}}});await task;return w; }
  const old=await load();let finish;
  f.browser.i18n.detectLanguage=()=>new Promise(resolve=>{finish=resolve;});
  const task=f.service.call({action:'translate',source:'auto',target:'tr',text:'Hello'});await turn();
  const current=await load();
  old.onmessage({data:{type:'state',phase:'error',error:'stale'}});
  assert.equal((await f.service.call({action:'status'})).phase,'ready');
  finish({isReliable:true,languages:[{language:'en',percentage:99}]});
  await assert.rejects(task,/aiModelMissing/);assert.equal(current.messages.length,1);
});
