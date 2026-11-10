// SPDX-License-Identifier: MPL-2.0
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Aion=require('../browser/extension/shared.js');
test('ordinary language/vocabulary changes preserve the native Firefox theme; explicit Aion theme changes still apply and release it',async()=>{
  let settings=Aion.normalize({}),changes,resets=0;const updates=[];
  const browser={theme:{reset:async()=>resets++,update:async theme=>updates.push(theme)},storage:{onChanged:{addListener:fn=>changes=fn}},runtime:{onInstalled:{addListener:()=>{}},onStartup:{addListener:()=>{}}}};
  const c=vm.createContext({browser,Aion,console,readSettings:async()=>settings,matchMedia:()=>({matches:false,addEventListener:()=>{}})});
  vm.runInContext(fs.readFileSync('browser/extension/browser-integration.js','utf8'),c);const tick=()=>new Promise(resolve=>setImmediate(resolve));await tick();assert.equal(resets,0);
  let old=settings;settings=Aion.normalize({language:'tr',vocabulary:['cat']});changes({settings:{oldValue:old,newValue:settings}},'local');await tick();assert.equal(resets,0);assert.equal(updates.length,0);
  old=settings;settings={...settings,browserTheme:true};changes({settings:{oldValue:old,newValue:settings}},'local');await tick();assert.equal(updates.length,1);
  old=settings;settings={...settings,vocabulary:['cat','dog']};changes({settings:{oldValue:old,newValue:settings}},'local');await tick();assert.equal(updates.length,1);
  old=settings;settings={...settings,browserTheme:false};changes({settings:{oldValue:old,newValue:settings}},'local');await tick();assert.equal(resets,1);
});
