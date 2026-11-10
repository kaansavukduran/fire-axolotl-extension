/* SPDX-License-Identifier: MPL-2.0 */
globalThis.AionLocalAI = (() => {
  let worker, next = 0, pending, pins = {}, modelKind = 'bergamot', epoch = 0, preparation;
  let status = {phase: 'unloaded', backend: 'wasm', modelKind: 'bergamot'};
  const publish = patch => {
    status = {...status, ...patch};
    browser.runtime.sendMessage({type: 'aionAIState', state: status}).catch(() => {});
  };
  async function manifest(kind) {
    const names={qwen:'model.json',m2m:'translation-model.json',bergamot:'bergamot-model.json'};
    if (!Object.hasOwn(names,kind)) throw new Error('unknownAction');
    return pins[kind] ||= await (await fetch(browser.runtime.getURL('aion/ai/'+names[kind]))).json();
  }
  function stop() {
    epoch++;
    preparation?.abort();preparation=undefined;
    worker?.terminate(); worker = undefined;
    pending?.reject(new Error('aiCancelled')); pending = undefined;
    publish({phase: 'unloaded', error: '', detail: '', loaded:0,total:0,file:''});
  }
  async function deliver(instance,message) {
    if(message.action==='load'&&message.pin.kind==='bergamot') {
      // Firefox offline mode permits packaged fetches in the extension page
      // but can reject them in a classic worker. Read owned assets here and
      // transfer the actual bytes; inference still has no network route.
      const controller=preparation=new AbortController();
      const assets=[];
      const entries=[[message.pin.runtimeWASM.file,message.pin.runtimeWASM],...Object.entries(message.pin.files)];
      for(const [name,record] of entries) {
        if(worker!==instance||pending?.id!==message.id)return;
        if(!/^[a-z0-9._-]+\.(bin|spm|wasm)$/.test(name))throw new Error('aiRuntimeFailed');
        const response=await fetch(browser.runtime.getURL('aion/ai/bergamot/'+name),{signal:controller.signal});
        if(!response.ok)throw new Error('aiModelMissing');
        const data=await response.arrayBuffer();if(data.byteLength!==record.size)throw new Error('aiHashMismatch');
        assets.push({name,data});
      }
      if(worker!==instance||pending?.id!==message.id)return;
      preparation=undefined;
      instance.postMessage({...message,assets},assets.map(item=>item.data));return;
    }
    instance.postMessage(message);
  }
  function start(kind) {
    const instance = worker = new Worker(browser.runtime.getURL(kind==='bergamot'?'aion/ai/bergamot/worker.js':'aion/ai/worker.mjs'), {type: kind==='bergamot'?'classic':'module'});
    worker.onmessage = ({data}) => {
      if (worker !== instance) return;
      if (data.type === 'state') {publish(data); return;}
      if (!pending || data.id !== pending.id) return;
      const current = pending; pending = undefined;
      if (data.error) {publish({phase: status.phase === 'running' ? 'ready' : 'error', error: data.error, detail: data.detail || ''}); current.reject(new Error(data.error));}
      else {publish({phase: 'ready', error: '', detail: ''}); current.resolve(data.result);}
    };
    worker.onerror = event => {
      if (worker !== instance) return;
      pending?.reject(new Error('aiRuntimeFailed')); pending = undefined;
      publish({phase: 'error', error: 'aiRuntimeFailed', detail: String(event.message).slice(0, 600)});
    };
  }
  async function call(message) {
    if(['translate','generate'].includes(message.action)) {
      const text=String(message.text||'').trim();
      if(!text)throw new Error('textRequired');
      if(text.length>4000)throw new Error('aiTextTooLong');
      message={...message,text};
    }
    const kind = message.action === 'load' || message.action === 'clear' ? (message.modelKind || 'qwen') : modelKind;
    const model = await manifest(kind);
    if (message.action === 'status') return {...status, model, modelKind};
    if (message.action === 'cancel' || message.action === 'unload') {stop(); return status;}
    if (message.action === 'clear') {stop(); if(model.cache)await caches.delete(model.cache); return status;}
    if (!['load', 'translate', 'generate'].includes(message.action)) throw new Error('unknownAction');
    // A click on local translation can use the shipped EN/TR model without a
    // separate download/setup. Other models retain explicit load consent.
    if(message.action==='translate'&&kind==='bergamot'&&status.phase==='unloaded')await call({action:'load',modelKind:'bergamot'});
    if(message.action!=='load'&&kind!==modelKind)throw new Error('aiModelMissing');
    if (pending) throw new Error('aiBusy');
    if (message.action !== 'load' && status.phase !== 'ready') throw new Error('aiModelMissing');
    if (message.action === 'load') {stop(); modelKind = kind; start(kind);}
    if (kind !== 'qwen' && message.action === 'generate') throw new Error('aiGeneralQwenOnly');
    let source = message.source;
    if (kind !== 'qwen' && message.action === 'translate' && (!source || source === 'auto')) {
      const detectionEpoch = epoch;
      const detected = await browser.i18n?.detectLanguage?.(String(message.text || '').slice(0, 4000)).catch(() => null);
      if (!detected) throw new Error('aiSourceRequired');
      if (!detected.isReliable || !detected.languages?.length || detected.languages[0].percentage < 50) throw new Error('aiSourceRequired');
      source = detected.languages[0].language;
      if (pending) throw new Error('aiBusy');
      if (epoch !== detectionEpoch || status.phase !== 'ready' || modelKind !== kind || !worker) throw new Error('aiModelMissing');
    }
    if (kind !== 'qwen' && message.action === 'translate') {
      if (!model.languages?.includes(String(source || '').split('-')[0])) throw new Error(kind==='bergamot'?'aiBergamotPairUnsupported':'aiSourceRequired');
      if (!model.languages?.includes(String(message.target || '').split('-')[0])) throw new Error(kind==='bergamot'?'aiBergamotPairUnsupported':'aiTargetUnsupported');
    }
    publish({phase: message.action === 'load' ? 'loading' : 'running', modelKind, error: '', detail: ''});
    const id = ++next;
    return new Promise((resolve, reject) => {
      pending = {id, resolve, reject};
      const instance=worker;
      deliver(instance,{id, action: message.action, text: message.text, source, target: message.target,
        maxTokens: message.maxTokens, pin: model, backend: message.backend, download: message.download === true, files: message.files}).catch(error=>{
        if(worker!==instance||pending?.id!==id)return;
        const task=pending;pending=undefined;instance.terminate();worker=undefined;preparation=undefined;
        const key=/^ai[A-Za-z]+$/.test(error.message)?error.message:'aiRuntimeFailed';
        publish({phase:'error',error:key,detail:String(error.message).slice(0,600)});task.reject(new Error(key));
      });
    });
  }
  // Closing the controller must stop its video overlay and restore native tracks.
  browser.runtime.onConnect.addListener(port => {
    if (port.name !== 'aion-ai-video' || port.sender?.id !== browser.runtime.id || String(port.sender?.url || '').split('#')[0] !== browser.runtime.getURL('aion/ai.html')) return;
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
