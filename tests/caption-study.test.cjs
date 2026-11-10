// SPDX-License-Identifier: MPL-2.0
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto').webcrypto;
const Aion=require('../browser/extension/shared.js');
function fixture() {
  const calls=[],saved=[],listeners={};let disabledModules=[];
  const browser={runtime:{id:'aion@test'},tabs:{onRemoved:{addListener:fn=>listeners.removed=fn}},webNavigation:{onCommitted:{addListener:fn=>listeners.committed=fn}}};
  const context=vm.createContext({browser,Aion,crypto,readSettings:async()=>({disabledModules,aiSource:'en',aiTarget:'tr'}),saveWord:async text=>saved.push(text),AionLocalAI:{call:async message=>{calls.push(message);return {text:'Kedi'};}}});
  vm.runInContext(fs.readFileSync('browser/extension/caption-study.js','utf8'),context);
  const service=context.AionCaptionStudy,frame={frameId:3,url:'https://example.org/video'};
  const sender={id:'aion@test',tab:{id:7},frameId:3,url:frame.url};
  const {token,revision}=service.grant(7,frame,[{text:'The cat is sleeping.'}]);
  return {service,calls,saved,listeners,sender,frame,token,disable:modules=>disabledModules=modules,setAI:fn=>context.AionLocalAI.call=fn,send:(patch={},who=sender)=>service.handle({type:'captionStudy',token,revision,action:'translate',text:'cat',...patch},who)};
}
test('caption capability binds source words to one sender, frame and session; it cannot download, read settings or translate page text',async()=>{
  const f=fixture();
  for(const who of [{...f.sender,id:'other'}, {...f.sender,frameId:0}, {...f.sender,tab:{id:8}}, {...f.sender,url:'https://example.org/other'}])await assert.rejects(f.send({},who),/unauthorized/);
  await assert.rejects(f.send({token:'guess'}),/unauthorized/);
  for(const action of ['settings','load','generate','download'])await assert.rejects(f.send({action}),/unauthorized/);
  for(const text of ['unrelated private page text','cats','a'.repeat(301)])await assert.rejects(f.send({text}),/textRequired/);
  assert.equal(f.calls.length,0);assert.equal((await f.send()).text,'Kedi');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)),[{action:'translate',text:'cat',source:'en',target:'tr'}]);
  await f.send({action:'save'});assert.deepEqual(f.saved,['cat']);
});
test('navigation, close, source replacement and module disabling revoke caption operations',async()=>{
  for(const module of ['video','translation','ai']){const f=fixture();f.disable([module]);await assert.rejects(f.send(),/moduleDisabled/);assert.equal(f.calls.length,0);}
  const f=fixture();f.service.grant(7,f.frame,[{text:'Another line'}]);await assert.rejects(f.send(),/textRequired/);
  const access=f.service.grant(7,f.frame,[{text:'cat'}]);await f.send({action:'close',revision:access.revision});await assert.rejects(f.send(),/unauthorized/);
  for(const event of ['removed','committed']){const f=fixture();f.listeners[event](event==='removed'?7:{tabId:7,frameId:3});await assert.rejects(f.send(),/unauthorized/);}
  const nested=fixture();nested.listeners.committed({tabId:7,frameId:0});await assert.rejects(nested.send(),/unauthorized/);
});
test('closing or replacing an overlay during inference discards the old answer and busy requests do not queue',async()=>{
  const f=fixture();let finish;f.setAI(()=>new Promise(resolve=>finish=resolve));
  const first=f.send();await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(f.send(),/aiBusy/);
  f.service.revoke(7);const {token}=f.service.grant(7,f.frame,[{text:'cat'}]);assert.notEqual(token,f.token);
  finish({text:'stale'});await assert.rejects(first,/unauthorized/);
  assert.equal(f.saved.length,0);
});
test('a delayed close from an earlier overlay cannot revoke the refreshed card',async()=>{
  const f=fixture();const access=f.service.grant(7,f.frame,[{text:'cat'}]);assert.equal(access.token,f.token);
  await f.send({action:'close'});assert.equal((await f.send()).text,'Kedi');
  await f.send({action:'close',revision:access.revision});await assert.rejects(f.send(),/unauthorized/);
});
