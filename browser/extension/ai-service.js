/* SPDX-License-Identifier: MPL-2.0 */
globalThis.AionLocalAI = (() => {
  let worker, next = 0, pending, pins = {}, modelKind = 'qwen';
  let status = {phase: 'unloaded', backend: 'wasm', modelKind: 'qwen'};
  const publish = patch => {
    status = {...status, ...patch};
    browser.runtime.sendMessage({type: 'aionAIState', state: status}).catch(() => {});
  };
  async function manifest(kind) {
    if (!['qwen','m2m'].includes(kind)) throw new Error('unknownAction');
    return pins[kind] ||= await (await fetch(browser.runtime.getURL(kind === 'm2m' ? 'aion/ai/translation-model.json' : 'aion/ai/model.json'))).json();
  }
  function stop() {
    worker?.terminate(); worker = undefined;
    pending?.reject(new Error('aiCancelled')); pending = undefined;
    publish({phase: 'unloaded', error: '', detail: '', loaded:0,total:0,file:''});
  }
  function start() {
    worker = new Worker(browser.runtime.getURL('aion/ai/worker.mjs'), {type: 'module'});
    worker.onmessage = ({data}) => {
      if (data.type === 'state') {publish(data); return;}
      if (!pending || data.id !== pending.id) return;
      const current = pending; pending = undefined;
      if (data.error) {publish({phase: status.phase === 'running' ? 'ready' : 'error', error: data.error, detail: data.detail || ''}); current.reject(new Error(data.error));}
      else {publish({phase: 'ready', error: '', detail: ''}); current.resolve(data.result);}
    };
    worker.onerror = event => {
      pending?.reject(new Error('aiRuntimeFailed')); pending = undefined;
      publish({phase: 'error', error: 'aiRuntimeFailed', detail: String(event.message).slice(0, 600)});
    };
  }
  async function call(message) {
    const kind = message.action === 'load' || message.action === 'clear' ? (message.modelKind || 'qwen') : modelKind;
    const model = await manifest(kind);
    if (message.action === 'status') return {...status, model, modelKind};
    if (message.action === 'cancel' || message.action === 'unload') {stop(); return status;}
    if (message.action === 'clear') {stop(); await caches.delete(model.cache); return status;}
    if (!['load', 'translate', 'generate'].includes(message.action)) throw new Error('unknownAction');
    if (pending) throw new Error('aiBusy');
    if (message.action !== 'load' && status.phase !== 'ready') throw new Error('aiModelMissing');
    if (message.action === 'load') {stop(); modelKind = kind; start();}
    if (kind === 'm2m' && message.action === 'generate') throw new Error('aiGeneralQwenOnly');
    let source = message.source;
    if (kind === 'm2m' && message.action === 'translate' && (!source || source === 'auto')) {
      const detected = await browser.i18n?.detectLanguage?.(String(message.text || '').slice(0, 4000)).catch(() => null);
      if (!detected) throw new Error('aiSourceRequired');
      if (!detected.isReliable || !detected.languages?.length || detected.languages[0].percentage < 50) throw new Error('aiSourceRequired');
      source = detected.languages[0].language;
      if (pending) throw new Error('aiBusy');
      if (status.phase !== 'ready' || modelKind !== kind || !worker) throw new Error('aiModelMissing');
    }
    if (kind === 'm2m' && message.action === 'translate') {
      if (!model.languages?.includes(String(source || '').split('-')[0])) throw new Error('aiSourceRequired');
      if (!model.languages?.includes(String(message.target || '').split('-')[0])) throw new Error('aiTargetUnsupported');
    }
    publish({phase: message.action === 'load' ? 'loading' : 'running', modelKind, error: '', detail: ''});
    const id = ++next;
    return new Promise((resolve, reject) => {
      pending = {id, resolve, reject};
      worker.postMessage({id, action: message.action, text: message.text, source, target: message.target,
        maxTokens: message.maxTokens, pin: model, backend: message.backend, download: message.download === true, files: message.files});
    });
  }
  // Closing the controller must stop its video overlay and restore native tracks.
  browser.runtime.onConnect.addListener(port => {
    if (port.name !== 'aion-ai-video' || port.sender?.id !== browser.runtime.id || port.sender?.url !== browser.runtime.getURL('aion/ai.html')) return;
    let target;
    port.onMessage.addListener(message => {if (Number.isInteger(message.tabId)) target = message.tabId; else if (message.tabId===null) target=undefined;});
    port.onDisconnect.addListener(() => {
      if (!target) return;
      AionMedia.command(target, {action:'closeOverlay'}).catch(() => {});
      AionMedia.command(target, {action:'captureStop'}).catch(() => {});
    });
  });
  return {call};
})();
