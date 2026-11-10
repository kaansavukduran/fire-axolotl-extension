/* SPDX-License-Identifier: MPL-2.0 */
/* Packaged Bergamot engine and EN/TR models; no native browser translation API. */
'use strict';
try {importScripts('binding.js');}
catch(error) {throw new Error('Bergamot binding import: '+error.message);}
const engine=new BergamotTranslatorWorker();
let pin,ready=false,busy=false;
const state=patch=>postMessage({type:'state',...patch});
const hex=bytes=>[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
async function prepare(message) {
  pin=message.pin;
  if(pin?.kind!=='bergamot'||pin.embedded!==true)throw new Error('aiRuntimeFailed');
  const base=new URL('./',self.location.href);
  const assets=new Map((message.assets||[]).map(item=>[new URL(item.name,base).href,item.data]));
  const wasm=assets.get(new URL(pin.runtimeWASM.file,base).href);
  if(!(wasm instanceof ArrayBuffer)||wasm.byteLength!==pin.runtimeWASM.size||hex(await crypto.subtle.digest('SHA-256',wasm))!==pin.runtimeWASM.sha256)throw new Error('aiHashMismatch');
  globalThis.fetch=(url,options={})=>{
    const value=new URL(typeof url==='string'?url:url.url||url.href,base).href;
    if(!assets.has(value))return Promise.reject(new Error('aiDownloadFailed'));
    const data=assets.get(value);
    return Promise.resolve(new Response(data,{headers:{'Content-Type':value.endsWith('.wasm')?'application/wasm':'application/octet-stream','Content-Length':String(data.byteLength)}}));
  };
  const total=Object.values(pin.files).reduce((sum,item)=>sum+item.size,0);let loaded=0;
  state({phase:'loading',loaded,total,backend:'wasm'});
  await engine.initialize({useNativeIntGemm:false,cacheSize:0});
  for(const pair of pin.pairs) {
    const buffers={};
    for(const key of ['model','shortlist','vocab']) {
      const name=pair[key];if(!/^[a-z0-9._-]+\.(bin|spm)$/.test(name))throw new Error('aiRuntimeFailed');
      const response=await fetch(new URL(name,base));if(!response.ok)throw new Error('aiModelMissing');
      const data=await response.arrayBuffer(),expected=pin.files[name];
      if(data.byteLength!==expected.size||hex(await crypto.subtle.digest('SHA-256',data))!==expected.sha256)throw new Error('aiHashMismatch');
      buffers[key]=data;loaded+=data.byteLength;state({phase:'loading',loaded,total,backend:'wasm'});
    }
    engine.loadTranslationModel({from:pair.source,to:pair.target},{model:buffers.model,shortlist:buffers.shortlist,vocabs:[buffers.vocab]});
  }
  assets.clear();ready=true;state({phase:'ready',loaded:total,total,backend:'wasm'});return {ready:true,backend:'wasm'};
}
function translate(message) {
  if(!ready)throw new Error('aiModelMissing');
  if(message.action!=='translate')throw new Error('aiGeneralQwenOnly');
  const text=String(message.text||'').trim();if(!text||text.length>4000)throw new Error('textRequired');
  const source=String(message.source||'').split('-')[0],target=String(message.target||'').split('-')[0];
  if(!pin.languages.includes(source)||!pin.languages.includes(target))throw new Error('aiBergamotPairUnsupported');
  if(source===target)return {text,backend:'wasm',local:true};
  const answer=engine.translate({models:[{from:source,to:target}],texts:[{text,html:false,qualityScores:false}]})[0]?.target?.text;
  if(typeof answer!=='string'||!answer.trim())throw new Error('aiInferenceFailed');
  return {text:answer.trim(),backend:'wasm',local:true};
}
onmessage=async({data})=>{
  if(busy){postMessage({id:data.id,error:'aiBusy'});return;}busy=true;
  try {const result=data.action==='load'?await prepare(data):translate(data);postMessage({id:data.id,result});}
  catch(error){postMessage({id:data.id,error:/^ai[A-Za-z]+$/.test(error.message)?error.message:'aiRuntimeFailed',detail:String(error.message).slice(0,600)});}
  finally {busy=false;}
};
