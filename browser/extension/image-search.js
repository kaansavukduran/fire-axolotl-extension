/* SPDX-License-Identifier: MPL-2.0 */
(() => {
  'use strict';
  const parent = 'aion-image-search';
  const providers = {google: 'Google Lens', bing: 'Bing', tineye: 'TinEye', yandex: 'Yandex'};
  let menuQueue = Promise.resolve();
  function createMenu(properties) {
    return new Promise((resolve, reject) => browser.menus.create(properties, () => {
      if (browser.runtime.lastError) reject(new Error('menuCreationFailed')); else resolve();
    }));
  }
  function synchronize() {
    menuQueue = menuQueue.catch(() => {}).then(async () => {
      const settings = await readSettings();
      try {await browser.menus.remove(parent);} catch { /* Absent on first install. */ }
      if (!settings.imageSearch) {await browser.menus.refresh(); return;}
      const language = Aion.language(settings, browser.i18n.getUILanguage());
      await createMenu({id: parent, title: language === 'en' ? 'Aion · Search by image' : 'Aion · Görselle ara', contexts: ['image'], documentUrlPatterns: ['https://*/*', 'http://*/*'], targetUrlPatterns: ['https://*/*', 'http://*/*']});
      for (const [provider, title] of Object.entries(providers)) await createMenu({id: `${parent}-${provider}`, parentId: parent, title, contexts: ['image']});
      await browser.menus.refresh();
    });
    menuQueue.catch(() => console.error('Aion image menu could not be updated'));
    return menuQueue;
  }
  async function search(info, tab) {
    const provider = Object.keys(providers).find(key => info.menuItemId === `${parent}-${key}`);
    if (!provider || !(await readSettings()).imageSearch) return;
    const url = Aion.imageSearchURL(provider, info.srcUrl);
    if (!url) return;
    const target = {url};
    if (Number.isInteger(tab?.windowId)) target.windowId = tab.windowId;
    if (typeof tab?.cookieStoreId === 'string') target.cookieStoreId = tab.cookieStoreId;
    await browser.tabs.create(target);
  }
  browser.menus.onClicked.addListener((info, tab) => search(info, tab).catch(() => console.error('Aion image search could not be opened')));
  browser.runtime.onInstalled.addListener(synchronize);
  browser.runtime.onStartup.addListener(synchronize);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const previous = Aion.normalize(changes.settings.oldValue);
    const next = Aion.normalize(changes.settings.newValue);
    if (previous.language !== next.language || previous.imageSearch !== next.imageSearch) synchronize();
  });
  // A waking event page must not rebuild the menu whose click woke it.
  globalThis.AionImageMenus = {synchronize};
})();
