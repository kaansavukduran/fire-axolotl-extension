/* SPDX-License-Identifier: MPL-2.0 */
globalThis.AionSync = (() => {
  const keys = ['language','theme','scale','textSize','font','lineHeight','letterSpacing','progress','animations','imageSearch','quality','runner','moduleOrder','disabledModules','captionSize','captionOpacity','captionFont','captionPosition','captionColor','captionTranslationColor','captionOriginal','captionTranslated','aiSource','aiTarget'];
  async function enabled() {if (!(await browser.storage.local.get('aionSyncEnabled')).aionSyncEnabled) throw new Error('syncDisabled');}
  async function push() {
    await enabled(); const all = await readSettings();
    const settings = Object.fromEntries(keys.map(key=>[key,all[key]]));
    const record = {version:1,settings};
    if (new TextEncoder().encode(JSON.stringify(record)).length > 7800) throw new Error('syncTooLarge');
    await browser.storage.sync.set({aionPreferences:record}); return true;
  }
  async function pull() {
    await enabled(); const {aionPreferences:record} = await browser.storage.sync.get('aionPreferences');
    if (!record || record.version !== 1 || !record.settings || typeof record.settings !== 'object') throw new Error('syncEmpty');
    const safe = Aion.normalize(record.settings);
    await writeSettings(Object.fromEntries(keys.filter(key=>Object.hasOwn(record.settings,key)).map(key=>[key,safe[key]])));
    return true;
  }
  return {push,pull};
})();
