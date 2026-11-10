// SPDX-License-Identifier: MPL-2.0
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Aion=require('../browser/extension/shared.js');
function fixture() {
  const items=new Map([['uBlock0-subscribeToList',{id:'uBlock0-subscribeToList'}],['aion-image-search',{id:'aion-image-search'}]]),events={},opened=[],created=[];
  let settings=Aion.normalize({language:'en'}),identities=[{cookieStoreId:'firefox-container-1',name:'Work'},{cookieStoreId:'firefox-container-2',name:'Temporary'}];
  const event=key=>({addListener:fn=>events[key]=fn});
  const browser={menus:{create:(item,done)=>{items.set(item.id,item);done();},remove:async id=>{items.delete(id);for(const [key,item]of items)if(item.parentId===id)items.delete(key);},refresh:async()=>{},update:async(id,patch)=>Object.assign(items.get(id),patch),onClicked:event('click'),onShown:event('show')},
    runtime:{getURL:p=>'moz-extension://test/'+p,onInstalled:event('install'),onStartup:event('startup')},storage:{local:{get:async()=>({temporaryContainers:['firefox-container-2']})},onChanged:event('change')},contextualIdentities:{query:async()=>identities,onCreated:event('identityCreated'),onUpdated:event('identityUpdated'),onRemoved:event('identityRemoved')},i18n:{getUILanguage:()=> 'en'},tabs:{create:async details=>created.push(details)}};
  const context=vm.createContext({browser,Aion,console,readSettings:async()=>settings,openContainer:async(tab,id,url)=>{if(identities.some(i=>i.cookieStoreId===id))opened.push({tab,id,url});},openTemporaryContainer:async(tab,url,language)=>opened.push({tab,url,language,temporary:true}),fetch:async url=>({json:async()=>JSON.parse(fs.readFileSync('browser/extension/_locales/'+(url.includes('/tr/')?'tr':'en')+'/messages.json','utf8'))})});
  vm.runInContext(fs.readFileSync('browser/extension/container-menus.js','utf8'),context);
  return {items,events,opened,created,service:context.AionContainerMenus,setSettings:value=>settings=Aion.normalize(value),setIdentities:value=>identities=value};
}
test('container menus coexist with blocker/image menus, exclude old temporary identities and follow names/language/module state',async()=>{
  const f=fixture();await f.events.install();assert.ok(f.items.has('uBlock0-subscribeToList'));assert.ok(f.items.has('aion-image-search'));
  assert.equal(f.items.get('aion-container-open').title,'Aion · Open in container');assert.ok(f.items.get('aion-container-open').contexts.includes('selection'));assert.ok(f.items.has('aion-container-open-firefox-container-1'));assert.ok(!f.items.has('aion-container-open-firefox-container-2'));assert.equal(f.opened.length,0);
  f.setIdentities([{cookieStoreId:'firefox-container-1',name:'İş'}]);f.setSettings({language:'tr'});await f.events.identityUpdated();assert.equal(f.items.get('aion-container-open-firefox-container-1').title,'İş');assert.equal(f.items.get('aion-container-open').title,'Aion · Konteynerde aç');
  f.setSettings({disabledModules:['containers']});await f.service.synchronize();assert.ok(!f.items.has('aion-container-open'));assert.ok(f.items.has('aion-image-search'));assert.ok(f.items.has('uBlock0-subscribeToList'));
});
test('explicit context actions open the exact link/page; unsafe links, private tabs and disabled containers do nothing',async()=>{
  const f=fixture();await f.service.synchronize();const tab={id:7,url:'https://example.org/page',windowId:3,index:2};
  await f.events.click({menuItemId:'aion-container-open-firefox-container-1',linkUrl:'https://example.org/link'},tab);assert.equal(f.opened[0].url,'https://example.org/link');assert.equal(f.opened[0].tab.id,7);
  await f.events.click({menuItemId:'aion-container-temporary'},tab);assert.equal(f.opened[1].url,tab.url);assert.equal(f.opened[1].temporary,true);
  for(const linkUrl of ['javascript:alert(1)','file:///private','https://user:secret@example.org/'])await f.events.click({menuItemId:'aion-container-temporary',linkUrl},tab);
  await f.events.click({menuItemId:'aion-container-temporary'},{...tab,incognito:true});assert.equal(f.opened.length,2);
  await f.events.show({menuIds:['aion-container-open'],linkUrl:'mailto:a@example.org'},tab);assert.equal(f.items.get('aion-container-open').enabled,false);
  f.setSettings({disabledModules:['containers']});await f.events.click({menuItemId:'aion-container-temporary'},tab);assert.equal(f.opened.length,2);
});
