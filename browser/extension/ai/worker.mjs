/* SPDX-License-Identifier: GPL-3.0-or-later */
import {Qwen2Tokenizer, AutoModelForCausalLM, TextGenerationPipeline, env} from '@huggingface/transformers';
import {sha256} from '@noble/hashes/sha2.js';
const nativeFetch=globalThis.fetch.bind(globalThis);
let generator, pin, backend;
const state = patch => postMessage({type: 'state', ...patch});
const hex = bytes => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');

async function prepare(message) {
  pin = message.pin;
  backend = message.backend === 'webgpu' ? 'webgpu' : 'wasm';
  if (backend === 'webgpu') {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter?.features.has('shader-f16')) throw new Error('aiGPUUnavailable');
  }
  const cache = await caches.open(pin.cache);
  const base = `https://huggingface.co/${pin.id}/resolve/${pin.revision}/`;
  const names = Object.keys(pin.files).filter(name => !name.startsWith('onnx/') || name === pin.variants[backend].file);
  const total = names.reduce((sum, name) => sum + pin.files[name].size, 0);
  let complete = 0;
  for (const name of names) {
    const expected = pin.files[name], url = base + name;
    const cached = await cache.match(url);
    if (cached?.headers.get('x-aion-sha256') === expected.sha256 && Number(cached.headers.get('content-length')) === expected.size) {
      complete += expected.size;
      state({phase: 'downloading', loaded: complete, total, file: name}); continue;
    }
    if (!message.download && !message.files?.length) throw new Error('aiModelMissing');
    const local = message.files?.find(file => name === file.name || name.endsWith('/' + file.name));
    if (message.files?.length && !local) throw new Error('aiImportMissing');
    if (local && local.size !== expected.size) throw new Error('aiHashMismatch');
    let response;
    if (local) response = new Response(local.stream());
    else response = await fetch(url, {credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(3600000)});
    if (!response.ok || !response.body) throw new Error('aiDownloadFailed');
    const reader = response.body.getReader(), hash = sha256.create();
    let count = 0, last = 0;
    const body = new ReadableStream({
      async pull(controller) {
        try {
          const {done, value} = await reader.read();
          if (done) {
            if (count !== expected.size || hex(hash.digest()) !== expected.sha256) throw new Error('aiHashMismatch');
            controller.close(); return;
          }
          count += value.byteLength;
          if (count > expected.size) throw new Error('aiHashMismatch');
          hash.update(value); controller.enqueue(value);
          if (performance.now() - last > 200) {
            state({phase: 'downloading', loaded: complete + count, total, file: name}); last = performance.now();
          }
        } catch (error) {await reader.cancel().catch(() => {}); controller.error(error);}
      },
      cancel: reason => reader.cancel(reason)
    });
    try {
      await cache.put(url, new Response(body, {headers: {'content-length': String(expected.size), 'x-aion-sha256': expected.sha256}}));
    } catch {await cache.delete(url); throw new Error('aiDownloadFailed');}
    complete += expected.size;
    state({phase: 'downloading', loaded: complete, total, file: name});
  }
  state({phase: 'loading', loaded: total, total, backend});
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useBrowserCache = false;
  env.useFSCache = false;
  env.useWasmCache = false;
  env.useCustomCache = true;
  env.customCache = cache;
  // Inference can only read the verified cache. No text reaches a remote API.
  globalThis.fetch = (url,options) => {const value=String(url);if(value.startsWith(new URL('./ort/',import.meta.url).href))return nativeFetch(url,options);throw new Error('Uncached local runtime asset: '+value);};
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  const runtime = '.jsep';
  env.backends.onnx.wasm.wasmPaths = {
    mjs: new URL(`./ort/ort-wasm-simd-threaded${runtime}.mjs`, import.meta.url).href,
    wasm: new URL(`./ort/ort-wasm-simd-threaded${runtime}.wasm`, import.meta.url).href
  };
  const options = {revision: pin.revision, local_files_only: true, dtype: pin.variants[backend].dtype, device: backend, use_external_data_format: false, session_options: {graphOptimizationLevel:'disabled',enableCpuMemArena:false,enableMemPattern:false,extra:{session:{disable_prepacking:'1'}}}};
  const tokenizer = new Qwen2Tokenizer(await (await cache.match(base + 'tokenizer.json')).json(), await (await cache.match(base + 'tokenizer_config.json')).json());
  const model = await AutoModelForCausalLM.from_pretrained(pin.id, options);
  generator = new TextGenerationPipeline({task: 'text-generation', tokenizer, model});
  state({phase: 'ready', backend});
  return {ready: true, backend};
}

async function generate(message) {
  if (!generator) throw new Error('aiModelMissing');
  const text = String(message.text || '').trim();
  if (!text || text.length > 4000) throw new Error('textRequired');
  const translation = message.action === 'translate';
  const source = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(message.source) ? message.source : 'auto';
  const target = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(message.target) ? message.target : 'tr';
  const names = {tr:'Turkish',en:'English',de:'German',fr:'French',es:'Spanish',it:'Italian',pt:'Portuguese',ru:'Russian',ar:'Arabic',ja:'Japanese',ko:'Korean',zh:'Chinese',nl:'Dutch',pl:'Polish',uk:'Ukrainian',hi:'Hindi',fa:'Persian'};
  const system = translation
    ? 'You are a translation engine. Reply with the translated text only, without explanations or quotation marks.'
    : 'You are Aion, a helpful local assistant. You have no browser tools, network access or access to user data unless the user includes text in this prompt.';
  const example = {tr:'Teşekkür ederim.',en:'Thank you.',de:'Danke.',fr:'Merci.',es:'Gracias.',it:'Grazie.',pt:'Obrigado.',ru:'Спасибо.',ar:'شكراً.',ja:'ありがとうございます。',ko:'감사합니다.',zh:'谢谢。',nl:'Dank je.',pl:'Dziękuję.',uk:'Дякую.',hi:'धन्यवाद।',fa:'متشکرم.'}[target];
  const messages=[{role:'system',content:system}];
  if(translation&&example)messages.push({role:'user',content:`Translate from English into ${names[target] || target}:\nThank you.`},{role:'assistant',content:example});
  messages.push({role:'user',content:translation?`Translate ${source==='auto'?'the following text':`from ${names[source]||source}`} into ${names[target]||target}:\n${text}`:text});
  const output = await generator(messages, {
    max_new_tokens: Math.max(8, Math.min(256, Number(message.maxTokens) || 160)), do_sample: false,
    return_full_text: false
  });
  const result = output[0]?.generated_text;
  const answer = typeof result === 'string' ? result : result?.at(-1)?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('aiInferenceFailed');
  return {text: answer.trim(), backend, local: true};
}
let busy = false;
onmessage = async ({data}) => {
  if (busy) {postMessage({id: data.id, error: 'aiBusy'}); return;}
  busy = true;
  try {
    const result = data.action === 'load' ? await prepare(data) : await generate(data);
    postMessage({id: data.id, result});
  } catch (error) {
    postMessage({id: data.id, error: /^ai[A-Za-z]+$/.test(error.message) ? error.message : 'aiRuntimeFailed', detail: String(error.message).slice(0, 600)});
  } finally {busy = false;}
};
