// SPDX-License-Identifier: MPL-2.0
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Aion=require('../browser/extension/shared.js');
test('opt-in Sync uploads only preferences and remote data cannot overwrite private local content or endpoint',async()=>{
  let enabled=false,remote;
  let settings=Aion.normalize({vocabulary:['private word'],endpoint:'https://private.example.org/translate',theme:'dark'});
  const browser={storage:{local:{get:async()=>({aionSyncEnabled:enabled})},sync:{set:async value=>{remote=structuredClone(value);},get:async()=>remote}}};
  const context=vm.createContext({browser,Aion,TextEncoder,readSettings:async()=>settings,writeSettings:async patch=>{settings=Aion.normalize({...settings,...patch});}});
  vm.runInContext(fs.readFileSync('browser/extension/sync.js','utf8'),context);
  await assert.rejects(context.AionSync.push(),/syncDisabled/);assert.equal(remote,undefined);
  enabled=true;await context.AionSync.push();
  const value=JSON.stringify(remote);assert.ok(!value.includes('private word'));assert.ok(!value.includes('private.example'));
  remote.aionPreferences.settings.theme='light';remote.aionPreferences.settings.vocabulary=['remote overwrite'];remote.aionPreferences.settings.endpoint='https://attacker.example.org/translate';
  await context.AionSync.pull();assert.equal(settings.theme,'light');assert.deepEqual(settings.vocabulary,['private word']);assert.equal(settings.endpoint,'https://private.example.org/translate');
});
