/* SPDX-License-Identifier: MPL-2.0 */
globalThis.AionSiteStyles = (() => {
  const liveRules = new Map();
  const fonts = {system:'system-ui',lexend:'AionSiteLexend',opendyslexic:'AionSiteOpenDyslexic'};
  function fontCSS(font) {
    if (!fonts[font]) return '';
    const faces = `@font-face{font-family:AionSiteOpenDyslexic;src:url('${browser.runtime.getURL('aion/fonts/OpenDyslexic-Regular.otf')}')}@font-face{font-family:AionSiteLexend;src:url('${browser.runtime.getURL('aion/fonts/Lexend.ttf')}')}`;
    return faces + `html body p,html body li,html body article,html body h1,html body h2,html body h3,html body label,html body input,html body textarea{font-family:${fonts[font]},sans-serif!important}`;
  }
  async function apply(tabId, rule) {
    const [loaded] = await browser.tabs.executeScript(tabId,{code:'typeof globalThis.DarkReader === "object"'});
    if (rule.mode === 'dark' || rule.mode === 'light') {
      if (!loaded) await browser.tabs.executeScript(tabId,{file:'/aion/vendor/darkreader.js'});
      await browser.tabs.executeScript(tabId,{code:`DarkReader.disable();DarkReader.setFetchMethod(() => Promise.reject(new Error('Remote asset analysis disabled')));DarkReader.enable({mode:${rule.mode==='dark'?1:0},brightness:100,contrast:100});`});
    } else if (loaded) await browser.tabs.executeScript(tabId,{code:'DarkReader.disable();'});
    for (const key of Object.keys(fonts)) await browser.tabs.removeCSS(tabId,{code:fontCSS(key),cssOrigin:'user'}).catch(()=>{});
    if (fonts[rule.font]) await browser.tabs.insertCSS(tabId,{code:fontCSS(rule.font),cssOrigin:'user'});
    liveRules.set(tabId, rule);
  }
  async function configure(message) {
    const tabId=Number(message.tabId), tab=await browser.tabs.get(tabId);
    if (!Aion.webURL(tab.url)) throw new Error('restrictedPage');
    const origin=new URL(tab.url).origin;
    const {aionSiteStyles:stored={}}=await browser.storage.local.get('aionSiteStyles');
    const previous=liveRules.get(tabId)||stored[origin]||{mode:'default',font:'original'};
    const mode=['dark','light','default'].includes(message.mode)?message.mode:previous.mode;
    const font=message.font==='original'||Object.hasOwn(fonts,message.font)?message.font:previous.font;
    await apply(tabId,{mode,font});
    if (message.remember || message.reset) {
      await serial(async()=>{
        const {aionSiteStyles:all={}}=await browser.storage.local.get('aionSiteStyles');
        if (message.reset) delete all[origin]; else all[origin]={mode,font};
        if (Object.keys(all).length>200) throw new Error('siteRuleLimit');
        await browser.storage.local.set({aionSiteStyles:all});
      });
    }
    return true;
  }
  browser.tabs.onUpdated.addListener(async (tabId,change,tab)=>{
    if (change.status==='loading') liveRules.delete(tabId);
    if (change.status!=='complete' || !Aion.webURL(tab.url)) return;
    const {aionSiteStyles:all={}}=await browser.storage.local.get('aionSiteStyles');
    const rule=all[new URL(tab.url).origin];
    if (rule) apply(tabId,rule).catch(()=>console.error('Aion site appearance could not be restored'));
  });
  browser.tabs.onRemoved.addListener(tabId=>liveRules.delete(tabId));
  return {configure};
})();
