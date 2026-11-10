/* SPDX-License-Identifier: MPL-2.0 */
globalThis.AionContainerMenus=(()=>{
  const parent='aion-container-open',temporary='aion-container-temporary',manage='aion-container-manage';
  let queue=Promise.resolve(),lastEnabled=true;
  const create=properties=>new Promise((resolve,reject)=>browser.menus.create(properties,()=>browser.runtime.lastError?reject(new Error('menuCreationFailed')):resolve()));
  function synchronize() {
    queue=queue.catch(()=>{}).then(async()=>{
      const settings=await readSettings();try {await browser.menus.remove(parent);}catch{/* First install. */}
      if(settings.disabledModules.includes('containers')){await browser.menus.refresh();return;}
      const language=Aion.language(settings,browser.i18n.getUILanguage());
      const messages=await(await fetch(browser.runtime.getURL(`aion/_locales/${language}/messages.json`))).json();
      const contexts=['page','link','selection','image','video','audio','tab'];
      await create({id:parent,title:messages.containerMenuTitle.message,contexts,documentUrlPatterns:['https://*/*','http://*/*']});
      lastEnabled=true;
      const ephemeral=(await browser.storage.local.get('temporaryContainers')).temporaryContainers || [];
      for(const identity of await browser.contextualIdentities.query({})) {
        if(ephemeral.includes(identity.cookieStoreId))continue;
        await create({id:parent+'-'+identity.cookieStoreId,parentId:parent,title:identity.name.replace(/[\r\n]/g,' ').slice(0,80),contexts});
      }
      await create({id:temporary,parentId:parent,title:messages.containerMenuTemporary.message,contexts});
      await create({id:manage,parentId:parent,title:messages.containerMenuManage.message,contexts});
      await browser.menus.refresh();
    });
    queue.catch(()=>console.error('Aion container menu could not be updated'));return queue;
  }
  async function click(info,tab) {
    if(typeof info.menuItemId!=='string' || !info.menuItemId.startsWith('aion-container-'))return;
    const settings=await readSettings();if(settings.disabledModules.includes('containers') || tab?.incognito)return;
    const url=Aion.webURL(info.linkUrl===undefined?tab?.url:info.linkUrl);if(!url)return;
    const language=Aion.language(settings,browser.i18n.getUILanguage());
    if(info.menuItemId===manage) {
      await browser.tabs.create({url:browser.runtime.getURL('aion/popup.html')+'#section=containers&target='+tab.id,windowId:tab.windowId});return;
    }
    if(info.menuItemId===temporary)return openTemporaryContainer(tab,url,language);
    const id=info.menuItemId.slice((parent+'-').length);
    return openContainer(tab,id,url);
  }
  browser.menus.onClicked.addListener((info,tab)=>click(info,tab).catch(()=>console.error('Aion container could not be opened')));
  browser.menus.onShown.addListener((info,tab)=>{
    if(!info.menuIds.includes(parent))return;
    const enabled=!!Aion.webURL(info.linkUrl===undefined?tab?.url:info.linkUrl)&&!tab?.incognito;
    if(enabled===lastEnabled)return;
    lastEnabled=enabled;
    browser.menus.update(parent,{enabled}).then(()=>browser.menus.refresh()).catch(()=>{});
  });
  for(const event of [browser.runtime.onInstalled,browser.runtime.onStartup,browser.contextualIdentities.onCreated,browser.contextualIdentities.onUpdated,browser.contextualIdentities.onRemoved])event.addListener(synchronize);
  browser.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    const before=Aion.normalize(changes.settings?.oldValue),after=Aion.normalize(changes.settings?.newValue);
    if(changes.temporaryContainers || (changes.settings && (before.language!==after.language || before.disabledModules.includes('containers')!==after.disabledModules.includes('containers'))))synchronize();
  });
  return {synchronize};
})();
