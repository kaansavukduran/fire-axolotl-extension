/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
let queue = Promise.resolve();
const wordUndo = new Map();
function serial(fn) {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
}
async function readSettings() {return Aion.normalize((await browser.storage.local.get('settings')).settings);}
async function writeSettings(patch) {
  return serial(async () => {
    const settings = Aion.normalize({...await readSettings(), ...patch});
    await browser.storage.local.set({settings});
    if (settings.disabledModules.includes('video')) await globalThis.AionMedia?.clearAll();
    if (settings.disabledModules.includes('ai')) await globalThis.AionLocalAI?.call({action: 'unload'});
    if (patch && (Object.hasOwn(patch, 'imageSearch') || Object.hasOwn(patch, 'language'))) await globalThis.AionImageMenus?.synchronize();
    if (patch && (Object.hasOwn(patch,'disabledModules') || Object.hasOwn(patch,'language'))) await globalThis.AionContainerMenus?.synchronize();
    return settings;
  });
}
async function milestone(name) {
  return serial(async () => {
    const settings = await readSettings();
    if (settings.progress && !settings.milestones.includes(name)) {
      settings.milestones.push(name);
      await browser.storage.local.set({settings});
    }
  });
}
async function activeTab() {
  const [tab] = await browser.tabs.query({active: true, currentWindow: true});
  if (!tab || !Aion.webURL(tab.url)) throw new Error('restrictedPage');
  return tab;
}
async function sourceTab(id) {
  if (id === undefined) return activeTab();
  if (!Number.isSafeInteger(id) || id < 0) throw new Error('targetTabMissing');
  let tab;try {tab=await browser.tabs.get(id);}catch {throw new Error('targetTabMissing');}
  if (!Aion.webURL(tab.url)) throw new Error('restrictedPage');
  return tab;
}
function containerTarget(tab,url,cookieStoreId) {
  const target=Aion.webURL(url);
  if (!target || tab?.incognito) throw new Error('restrictedPage');
  const details={url:target,cookieStoreId};
  if (Number.isInteger(tab?.windowId)) details.windowId=tab.windowId;
  if (Number.isInteger(tab?.index)) details.index=tab.index+1;
  return details;
}
async function openContainer(tab,id,url=tab.url) {
  if (!(await browser.contextualIdentities.query({})).some(identity=>identity.cookieStoreId===id)) throw new Error('containerMissing');
  const created=await browser.tabs.create(containerTarget(tab,url,id));await milestone('container');return {id:created.id};
}
async function openTemporaryContainer(tab,url=tab.url,language='tr') {
  const details=containerTarget(tab,url,'');
  return serial(async()=>{
    const identity=await browser.contextualIdentities.create({name:language==='en'?'Aion · Temporary':'Aion · Geçici',color:'turquoise',icon:'circle'});
    const temporary=(await browser.storage.local.get('temporaryContainers')).temporaryContainers || [];
    await browser.storage.local.set({temporaryContainers:[...temporary,identity.cookieStoreId]});
    try {await browser.tabs.create({...details,cookieStoreId:identity.cookieStoreId});}
    catch(error) {await browser.contextualIdentities.remove(identity.cookieStoreId);await browser.storage.local.set({temporaryContainers:temporary});throw error;}
    return true;
  });
}
async function saveWord(text) {
  if (typeof text !== 'string') throw new Error('textRequired');
  const word = String(text || '').trim();
  if (!word) throw new Error('textRequired');
  if (word.length > 300) throw new Error('wordTooLong');
  await serial(async () => {
    const settings = await readSettings();
    if (!settings.vocabulary.includes(word)) {
      if (settings.vocabulary.length >= 5000) throw new Error('wordLimit');
      settings.vocabulary.push(word);
    }
    await browser.storage.local.set({settings:Aion.normalize(settings)});
  });
  await milestone('word');
  return true;
}
async function manageWords(message) {
  return serial(async () => {
    const settings = await readSettings();
    if (message.action === 'remove') {
      const word = message.word;
      if (typeof word !== 'string' || !word.trim() || word.length > 300) throw new Error('textRequired');
      const positions = settings.vocabulary.flatMap((value,index) => value === word ? [index] : []);
      if (!positions.length) throw new Error('wordMissing');
      settings.vocabulary = settings.vocabulary.filter(value => value !== word);
      await browser.storage.local.set({settings});
      const token = crypto.randomUUID();wordUndo.set(token,{word,positions});
      if (wordUndo.size > 20) wordUndo.delete(wordUndo.keys().next().value);
      return {token};
    }
    if (message.action === 'undo') {
      const entry = wordUndo.get(message.token);
      if (!entry) throw new Error('wordUndoExpired');
      if (!settings.vocabulary.includes(entry.word)) {
        if (settings.vocabulary.length + entry.positions.length > 5000) throw new Error('wordLimit');
        for (const index of entry.positions) settings.vocabulary.splice(Math.min(index,settings.vocabulary.length),0,entry.word);
        await browser.storage.local.set({settings});
      }
      wordUndo.delete(message.token);return true;
    }
    if (message.action === 'import') {
      const words = Aion.wordBackup(message.backup), seen = new Set(settings.vocabulary);
      const additions = words.filter(word => !seen.has(word));
      if (settings.vocabulary.length + additions.length > 5000) throw new Error('wordLimit');
      settings.vocabulary.push(...additions);
      await browser.storage.local.set({settings});
      return {added:additions.length,duplicates:message.backup.words.length-additions.length,total:settings.vocabulary.length};
    }
    throw new Error('unknownAction');
  });
}
async function onMessage(message, sender) {
  if (message.type === 'captionStudy') return AionCaptionStudy.handle(message,sender);
  // General container/storage/network actions remain extension-page only.
  const allowedPages = ['popup.html', 'settings.html', 'characters.html', 'sidebar.html', 'newtab.html', 'tools.html', 'ai.html', 'wordbook.html'].map(page => browser.runtime.getURL('aion/' + page));
  if (sender.id !== browser.runtime.id || !allowedPages.includes(String(sender.url || '').split('#')[0])) throw new Error('unauthorized');
  const modules = {containers: 'containers', temporaryContainer: 'containers', createContainer: 'containers', openContainer: 'containers', video: 'video', mediaTab: 'video', forgetSpeed: 'video', selection: 'translation', translate: 'translation', word: 'translation', localAI: 'ai'};
  const module = modules[message.type];
  if (message.type === 'pageTranslation' && message.command?.action !== 'restore' && (await readSettings()).disabledModules.some(name => ['ai','translation'].includes(name))) throw new Error('moduleDisabled');
  if (module && (await readSettings()).disabledModules.includes(module) && !(message.type === 'localAI' && ['status','cancel','unload','clear'].includes(message.action)) && !(['video','mediaTab'].includes(message.type) && ['closeOverlay','captureStop','captionLoopStop'].includes(message.command?.action))) throw new Error('moduleDisabled');
  switch (message.type) {
    case 'settings': return readSettings();
    case 'save': return writeSettings(message.patch);
    // Data management remains available when translation is disabled.
    case 'wordbook': return manageWords(message);
    case 'localAI': return AionLocalAI.call(message);
    case 'pageTranslation': {
      const tab = await browser.tabs.get(Number(message.tabId));
      if (!Aion.webURL(tab.url)) throw new Error('restrictedPage');
      if (!['scan','apply','restore'].includes(message.command?.action)) throw new Error('unknownAction');
      await browser.tabs.executeScript(tab.id, {file:'/aion/page-translator.js',frameId:0});
      const result = await browser.tabs.sendMessage(tab.id, {type:'aionPageTranslation',command:message.command}, {frameId:0});
      if (result.error) throw new Error(result.error);
      return result;
    }
    case 'syncPush': return AionSync.push();
    case 'syncPull': return AionSync.pull();
    case 'siteStyle': return AionSiteStyles.configure(message);
    case 'runnerBest': return serial(async () => {
      const best = Number(message.score);
      if (!Number.isSafeInteger(best) || best < 0 || best > 1000000) throw new Error('unknownAction');
      const stored = (await browser.storage.local.get('aionRunnerBest')).aionRunnerBest || 0;
      await browser.storage.local.set({aionRunnerBest: Math.max(best, stored)});
      return Math.max(best, stored);
    });
    case 'containers': {
      const temporary = (await browser.storage.local.get('temporaryContainers')).temporaryContainers || [];
      return (await browser.contextualIdentities.query({})).map(identity => ({...identity, temporary: temporary.includes(identity.cookieStoreId)}));
    }
    case 'temporaryContainer': {
      return openTemporaryContainer(await sourceTab(message.tabId),undefined,message.name==='Temporary'?'en':'tr');
    }
    case 'createContainer': {
      const name = String(message.name || '').trim().slice(0, 80);
      if (!name) throw new Error('nameRequired');
      const identity = await browser.contextualIdentities.create({name, color: 'pink', icon: 'fingerprint'});
      await milestone('container');
      return identity;
    }
    case 'openContainer': {
      return openContainer(await sourceTab(message.tabId),message.id);
    }
    case 'forgetSpeed': {const tab=await sourceTab(message.tabId);await AionMedia.remember(tab.id,null);await AionMedia.command(tab.id,{action:'clearDefaultSpeed'});return AionMedia.command(tab.id,{action:'speed',value:1});}
    case 'mediaTab':
    case 'video': {
      const tab = await sourceTab(message.type==='mediaTab'?Number(message.tabId):message.tabId);
      const settings = await readSettings();
      const command = {...message.command, style: Aion.captionStyle(settings), language: Aion.language(settings, browser.i18n.getUILanguage())};
      if (command.action === 'overlay') {
        const messages = await (await fetch(browser.runtime.getURL(`aion/_locales/${command.language}/messages.json`))).json();
        const keys = ['captionStudy','captionStudyHelp','captionStudyContinue','captionStudyTranslate','captionStudySave','captionStudySaved','captionStudySentence','captionStudySource','captionStudyTarget','captionStudyLocal','captionStudyPending','aiBusy','aiSourceRequired','aiBergamotPairUnsupported','aiTargetUnsupported','moduleDisabled','operationFailed','wordLimit','wordTooLong'];
        command.studyUI = {source:settings.aiSource,target:settings.aiTarget,labels:Object.fromEntries(keys.map(key=>[key,messages[key]?.message || key]))};
      }
      const result = await AionMedia.command(tab.id, command);
      if(message.remember && command.action==='speed'){await AionMedia.remember(tab.id,command.value);await AionMedia.command(tab.id,{action:'setDefaultSpeed',value:command.value});}
      if (result.error) throw new Error(result.error);
      if (command.action === 'speed') await milestone('video');
      return result;
    }
    case 'selection': {
      const tab = await sourceTab(message.tabId);
      const result = await browser.tabs.executeScript(tab.id, {allFrames:true,code: `(()=>{const e=document.activeElement;return ((e?.tagName==='TEXTAREA'||(e?.tagName==='INPUT'&&e.type!=='password'))&&Number.isInteger(e.selectionStart)?e.value.slice(e.selectionStart,e.selectionEnd):window.getSelection().toString()).slice(0,5000)})()`});
      return result.find(text=>text?.trim()) || '';
    }
    case 'translate': {
      const settings = await readSettings();
      const text = String(message.text || '').trim();
      if (!text || text.length > 5000) throw new Error('textRequired');
      const endpoint = Aion.translationEndpoint(settings.endpoint);
      if (!await browser.permissions.contains({origins: [endpoint.origin]})) throw new Error('permissionRequired');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({q: text, source: 'auto', target: settings.targetLanguage, format: 'text'}),
          signal: controller.signal
        });
        if (!response.ok) throw new Error('translationFailed');
        const data = await response.json();
        if (typeof data.translatedText !== 'string' || data.translatedText.length > 20000) throw new Error('translationFailed');
        return {text: data.translatedText};
      } catch {throw new Error('translationFailed');}
      finally {clearTimeout(timeout);}
    }
    case 'word': {
      return saveWord(message.word);
    }
    case 'checkUpdates': {
      // GitHub's /latest excludes all developer previews and can return 404
      // even while this project's usable preview packages are published.
      const response = await fetch('https://api.github.com/repos/kaansavukduran/fire-axolotl-extension/releases?per_page=20', {credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000)});
      if (response.status === 404) return {available: false};
      if (!response.ok) throw new Error('updateFailed');
      const releases = await response.json();
      if (!Array.isArray(releases)) throw new Error('updateFailed');
      const release = releases.filter(item => item && item.draft === false && /^v\d+\.\d+\.\d+(?:-preview\.\d+)?$/.test(item.tag_name) && typeof item.published_at === 'string' && Number.isFinite(Date.parse(item.published_at)))
        .sort((a,b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
      if (!release) return {available:false};
      return {available: true, version: release.tag_name, notes: String(release.body || '').slice(0, 4000), url: 'https://github.com/kaansavukduran/fire-axolotl-extension/releases/tag/' + encodeURIComponent(release.tag_name)};
    }
    default: throw new Error('unknownAction');
  }
}
browser.runtime.onMessage.addListener(onMessage);
async function cleanTemporaryContainers() {
  return serial(async () => {
    const temporary = (await browser.storage.local.get('temporaryContainers')).temporaryContainers || [];
    const live = new Set((await browser.tabs.query({})).map(tab => tab.cookieStoreId));
    const identities = new Set((await browser.contextualIdentities.query({})).map(identity => identity.cookieStoreId));
    const keep = [];
    for (const id of temporary) {
      if (live.has(id)) keep.push(id);
      else if (identities.has(id)) {
        try {await browser.contextualIdentities.remove(id);} catch {keep.push(id);}
      }
    }
    await browser.storage.local.set({temporaryContainers: keep});
  });
}
browser.tabs.onRemoved.addListener(() => {cleanTemporaryContainers().catch(console.error);});
browser.runtime.onStartup.addListener(() => {cleanTemporaryContainers().catch(console.error);});
