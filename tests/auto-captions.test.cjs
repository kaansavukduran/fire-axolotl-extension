// SPDX-License-Identifier: MPL-2.0
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Aion=require('../browser/extension/shared.js');
const turn=()=>new Promise(r=>setImmediate(r));
function fixture() {
  let settings=Aion.normalize(),tabs=[],timer,inference,reply={language:'en',cues:[{start:0,end:10,text:'The cat is sleeping.'}]};
  const calls=[],events={};
  const event=name=>({addListener:fn=>{events[name]=fn;}});
  const context=vm.createContext({Aion,Date,JSON,Map,console,setInterval:fn=>timer=fn,
    readSettings:async()=>settings,writeSettings:async patch=>{settings=Aion.normalize({...settings,...patch});},
    decorateMediaCommand:async command=>command,
    browser:{tabs:{query:async()=>tabs,get:async id=>tabs.find(t=>t.id===id),onActivated:event('active'),onUpdated:event('updated'),onRemoved:event('removed')},storage:{onChanged:event('storage')}},
    AionMedia:{command:async(id,command,guard=()=>true)=>{
      if(!guard())return {stale:true};calls.push({id,...command});
      if(command.action==='info')return tabs.find(t=>t.id===id)?.info || {error:'noVideo'};
      if(command.action==='captionWindow')return structuredClone(reply);
      return {};
    }},
    AionLocalAI:{call:message=>new Promise((resolve,reject)=>{inference={message,resolve,reject};})}});
  vm.runInContext(fs.readFileSync('browser/extension/auto-captions.js','utf8'),context);
  return {service:context.AionAutoCaptions,calls,events,setTabs:v=>tabs=v,setReply:v=>reply=v,inference:()=>inference,prefs:()=>settings,
    tick:async()=>{timer();await turn();await turn();},patch:async patch=>{settings=Aion.normalize({...settings,...patch});await context.AionAutoCaptions.reconcile();}};
}
const video=(id=1)=>({id,url:'https://example.org/video',title:'Video',active:true,info:{kind:'video',paused:false}});
test('one persistent switch waits for a video without reverting and discovers it automatically',async()=>{
  const f=fixture();await turn();await f.service.set(true);await f.tick();
  assert.equal(f.service.status().enabled,true);assert.equal(f.service.status().key,'autoCaptionWaiting');
  f.setTabs([video()]);f.events.active();await f.tick();
  assert.equal(f.inference().message.source,'en');assert.equal(f.inference().message.target,'tr');
  f.inference().resolve({text:'Kedi uyuyor.'});await f.tick();
  assert.equal(f.calls.filter(c=>c.action==='overlay').at(-1).translated[0].text,'Kedi uyuyor.');
  assert.equal(f.prefs().autoCaptions,true);
});
test('switching off while inference is pending cleans up and rejects late output',async()=>{
  const f=fixture();await turn();f.setTabs([video()]);await f.service.set(true);await f.tick();
  const pending=f.inference();await f.service.set(false);await turn();const before=f.calls.filter(c=>c.action==='overlay').length;
  pending.resolve({text:'Late'});await f.tick();
  assert.equal(f.service.status().enabled,false);assert.equal(f.calls.filter(c=>c.action==='overlay').length,before);
  assert.ok(f.calls.some(c=>c.action==='closeOverlay'));assert.ok(f.calls.some(c=>c.action==='captureStop'));
});
test('changed captions are reread before a translation is painted; navigation continues automatically',async()=>{
  const f=fixture();await turn();f.setTabs([video()]);await f.service.set(true);await f.tick();
  const first=f.inference();f.setReply({provider:'youtube',pageKey:'next',sourceId:2,language:'en',cues:[{start:0,end:2,text:'Next video.'}]});
  first.resolve({text:'Kedi uyuyor.'});await f.tick();
  assert.equal(f.calls.filter(c=>c.action==='overlay').at(-1).original[0].text,'Next video.');
  assert.equal(f.calls.filter(c=>c.action==='overlay').at(-1).translated.length,0);
  assert.equal(f.inference().message.text,'Next video.');
  f.inference().resolve({text:'Sonraki video.'});await f.tick();
  assert.equal(f.calls.filter(c=>c.action==='overlay').at(-1).translated[0].text,'Sonraki video.');
});
test('busy AI retries without turning the switch off; module disable prevents inference',async()=>{
  const f=fixture();await turn();f.setTabs([video()]);await f.service.set(true);await f.tick();
  f.inference().reject(new Error('aiBusy'));await turn();await f.tick();assert.equal(f.service.status().key,'autoCaptionBusy');
  assert.equal(f.service.status().enabled,true);const second=f.inference();assert.equal(second.message.action,'translate');
  await f.patch({disabledModules:['ai']});second.resolve({text:'late'});await f.tick();
  assert.equal(f.service.status().key,'moduleDisabled');await assert.rejects(f.service.set(true),/moduleDisabled/);
});
test('overlay close disables automatic mode, preserving unrelated settings and vocabulary',async()=>{
  const f=fixture();await turn();await f.patch({vocabulary:['hello'],captionOriginal:false,aiTarget:'en'});f.setTabs([video()]);
  await f.service.set(true);await f.tick();f.setReply({closed:true,cues:[]});await f.tick();
  assert.equal(f.prefs().autoCaptions,false);assert.equal(f.prefs().captionOriginal,false);assert.deepEqual([...f.prefs().vocabulary],['hello']);
});
