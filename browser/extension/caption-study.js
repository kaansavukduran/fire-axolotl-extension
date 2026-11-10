/* SPDX-License-Identifier: MPL-2.0 */
// The only content-script capability: words from an explicitly opened overlay.
// No settings disclosure, arbitrary network access, downloads or general AI.
globalThis.AionCaptionStudy = (() => {
  const grants = new Map();
  const key = (tabId, frameId) => `${tabId}:${frameId}`;
  function revoke(tabId, frameId) {
    for (const [id, grant] of grants) if (grant.tabId === tabId && (frameId === undefined || grant.frameId === frameId)) grants.delete(id);
  }
  function grant(tabId, frame, cues) {
    const id = key(tabId, frame.frameId);
    let entry = grants.get(id);
    if (!entry || entry.url !== frame.url) {
      entry = {tabId, frameId:frame.frameId, url:frame.url, token:crypto.randomUUID(), terms:new Set()};
      grants.set(id, entry);
    }
    // Keep only this overlay's source. A word card can retain its own selected
    // term while live captions append lines; neither destination nor text comes
    // from arbitrary page selection or a window.postMessage bridge.
    const terms = new Set();
    for (const cue of (Array.isArray(cues) ? cues : []).slice(-10000)) {
      const text = String(cue.text || '').slice(0,2000).trim();
      if (text.length <= 300 && text) terms.add(text);
      for (const word of text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []) {
        if (word.length <= 300) terms.add(word);
        if (terms.size >= 40000) break;
      }
      if (terms.size >= 40000) break;
    }
    entry.terms = terms;
    entry.revision = (entry.revision || 0) + 1;
    return {token:entry.token,revision:entry.revision};
  }
  async function handle(message, sender) {
    const entry = grants.get(key(sender.tab?.id, sender.frameId));
    const valid = () => sender.id === browser.runtime.id && entry && grants.get(key(entry.tabId,entry.frameId)) === entry && sender.url === entry.url && Aion.webURL(sender.url) && message.token === entry.token;
    if (!valid()) throw new Error('unauthorized');
    // A delayed local close from a replaced overlay must not revoke its newer
    // live update. Background stop/navigation still revoke the entire grant.
    if (message.action === 'close') {if(message.revision === entry.revision)revoke(entry.tabId,entry.frameId);return true;}
    if (!['translate','save'].includes(message.action)) throw new Error('unauthorized');
    const settings = await readSettings();
    if (!valid()) throw new Error('unauthorized');
    if (settings.disabledModules.some(name => ['video','translation',...(message.action==='translate'?['ai']:[])].includes(name))) throw new Error('moduleDisabled');
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    if (!text || text.length > 300 || !entry.terms.has(text)) throw new Error('textRequired');
    if (message.action === 'save') {await saveWord(text);return true;}
    if (entry.busy) throw new Error('aiBusy');
    const source = message.source || settings.aiSource, target = message.target || settings.aiTarget;
    if (typeof source !== 'string' || typeof target !== 'string' || !(source === 'auto' || /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(source)) || !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(target)) throw new Error('aiSourceRequired');
    entry.busy = true;
    try {
      const result = await AionLocalAI.call({action:'translate',text,source,target});
      if (!valid() || !entry.terms.has(text)) throw new Error('unauthorized');
      return {text:String(result.text || '').slice(0,4000)};
    } finally {entry.busy = false;}
  }
  browser.tabs.onRemoved.addListener(tabId => revoke(tabId));
  browser.webNavigation.onCommitted.addListener(({tabId,frameId}) => revoke(tabId,frameId === 0 ? undefined : frameId));
  return {grant,revoke,handle};
})();
