/* SPDX-License-Identifier: MPL-2.0 */
(() => {
  'use strict';
  if (globalThis.aionPageTranslatorInstalled) return;
  globalThis.aionPageTranslatorInstalled = true;
  // Document-local references only. No automatic reading, network or storage.
  let snapshot;
  const excluded = 'script,style,noscript,template,textarea,input,select,option,pre,code,kbd,samp,svg,math,canvas,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[hidden],[aria-hidden="true"]';
  function restore() {
    let restored = 0, skipped = 0;
    for (const item of snapshot?.items || []) {
      if (item.applied === undefined) continue;
      if (item.node.isConnected && item.node.nodeValue === item.applied) {
        item.node.nodeValue = item.original; restored++;
      } else skipped++;
    }
    snapshot = undefined;
    return {restored, skipped};
  }
  function scan(scope) {
    restore();
    const items = []; let chars = 0, visited = 0, limited = false;
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (++visited > 30000) {limited = true; break;}
      const parent = node.parentElement, text = node.nodeValue.trim();
      if (!parent || !text || !/\p{L}/u.test(text) || parent.closest(excluded)) continue;
      if (scope === 'dialogs' && !parent.closest('dialog[open],[role="dialog"],[role="alertdialog"]')) continue;
      const style = getComputedStyle(parent);
      if (style.visibility === 'hidden' || style.visibility === 'collapse' || !parent.getClientRects().length) continue;
      let transparent = false;
      for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
        if (Number(getComputedStyle(ancestor).opacity) === 0) {transparent = true; break;}
      }
      if (transparent) continue;
      if (text.length > 1000) {limited = true; continue;}
      if (items.length >= 40 || chars + text.length > 12000) {limited = true; break;}
      items.push({node, original:node.nodeValue, text}); chars += text.length;
    }
    snapshot = {token:crypto.randomUUID(), items};
    return {token:snapshot.token, items:items.map((item,id) => ({id,text:item.text})), limited};
  }
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || message.type !== 'aionPageTranslation') return;
    const command = message.command || {};
    if (command.action === 'restore') return Promise.resolve(restore());
    if (command.action === 'scan' && ['page','dialogs'].includes(command.scope)) return Promise.resolve(scan(command.scope));
    if (command.action !== 'apply') return Promise.resolve({error:'unknownAction'});
    if (!snapshot || command.token !== snapshot.token) return Promise.resolve({error:'pageScanExpired'});
    const item = snapshot.items[command.id];
    if (!Number.isInteger(command.id) || !item || typeof command.text !== 'string' || !command.text.trim() || command.text.length > 8000) return Promise.resolve({error:'textRequired'});
    if (!item.node.isConnected || item.node.nodeValue !== item.original) return Promise.resolve({applied:false});
    const leading = item.original.match(/^\s*/)[0], trailing = item.original.match(/\s*$/)[0];
    item.applied = leading + command.text.trim() + trailing;
    item.node.nodeValue = item.applied;
    return Promise.resolve({applied:true});
  });
})();
