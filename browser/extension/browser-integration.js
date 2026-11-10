/* SPDX-License-Identifier: MPL-2.0 */
(() => {
  'use strict';
  let themeQueue = Promise.resolve();
  let ownsTheme=false;
  async function applyTheme() {
    const settings = await readSettings();
    if (!settings.browserTheme) {if(ownsTheme){await browser.theme.reset();ownsTheme=false;}return;}
    const dark = settings.theme === 'dark' || settings.theme === 'contrast' ||
      (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const contrast = settings.theme === 'contrast';
    await browser.theme.update({colors: {
      frame: contrast ? '#000000' : dark ? '#171829' : '#eeeaf6',
      tab_background_text: dark ? '#ffffff' : '#211c31',
      toolbar: contrast ? '#000000' : dark ? '#25253a' : '#faf8ff',
      toolbar_text: dark ? '#ffffff' : '#211c31',
      tab_selected: dark ? '#383650' : '#ffffff',
      tab_text: dark ? '#ffffff' : '#211c31',
      toolbar_field: dark ? '#10101c' : '#ffffff',
      toolbar_field_text: dark ? '#ffffff' : '#211c31',
      icons: contrast ? '#ffff00' : dark ? '#b8e8ed' : '#5a436f',
      sidebar: dark ? '#171829' : '#faf8ff', sidebar_text: dark ? '#ffffff' : '#211c31'
    }});
    ownsTheme=true;
  }
  const synchronize = () => {themeQueue = themeQueue.catch(() => {}).then(applyTheme); themeQueue.catch(console.error);};
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings)return;
    const before=Aion.normalize(changes.settings.oldValue),after=Aion.normalize(changes.settings.newValue);
    if(before.theme!==after.theme || before.browserTheme!==after.browserTheme)synchronize();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', synchronize);
  browser.runtime.onInstalled.addListener(synchronize);
  browser.runtime.onStartup.addListener(synchronize);
  synchronize();
})();
