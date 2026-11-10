/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
const $ = id => document.getElementById(id);
const callAI = (action, options = {}) => browser.runtime.sendMessage({type: 'localAI', action, ...options});
const videoPort = browser.runtime.connect({name: 'aion-ai-video'});
const languages = ["af", "am", "ar", "ast", "az", "ba", "be", "bg", "bn", "br", "bs", "ca", "ceb", "cs", "cy", "da", "de", "el", "en", "es", "et", "fa", "ff", "fi", "fr", "fy", "ga", "gd", "gl", "gu", "ha", "he", "hi", "hr", "ht", "hu", "hy", "id", "ig", "ilo", "is", "it", "ja", "jv", "ka", "kk", "km", "kn", "ko", "lb", "lg", "ln", "lo", "lt", "lv", "mg", "mk", "ml", "mn", "mr", "ms", "my", "ne", "nl", "no", "ns", "oc", "or", "pa", "pl", "ps", "pt", "ro", "ru", "sd", "si", "sk", "sl", "so", "sq", "sr", "ss", "su", "sv", "sw", "ta", "th", "tl", "tn", "tr", "uk", "ur", "uz", "vi", "wo", "xh", "yi", "yo", "zh", "zu"];
let modelState = {}, operation = 0, live = false, fileRunning = false, original = [], translated = [], downloadURL, targetId, loopTargetId;
let pageSnapshot, pageRunning = false, pageOperation = 0;
let loopStarting=false,loopGeneration=0,videoCleanup=Promise.resolve();
const translate = (text, detectedSource) => callAI('translate', {text, source: UI.settings.aiSource==='auto'&&detectedSource?detectedSource:UI.settings.aiSource, target: UI.settings.aiTarget});
const studyTrack = () => $('caption-track').value === 'local' ? 'local' : $('caption-track').value === 'auto' ? undefined : Number($('caption-track').value);
function renderModel(state) {
  modelState = state;
  $('ai-start-ready').disabled=['loading','running','downloading'].includes(state.phase);
  $('ai-start-ready').textContent=UI.t(state.phase==='ready'&&state.modelKind==='bergamot'?'aiGuideGoText':'aiGuideStart');
  $('ai-quick-state').textContent=UI.t('aiState-'+state.phase)+(state.modelKind?' · '+({bergamot:'Bergamot EN ↔ TR',qwen:'Qwen 2.5 1.5B',m2m:'M2M100 418M'}[state.modelKind]||''):'');
  if (state.phase === 'ready') $('aiModel').value = state.modelKind || 'qwen';
  const embedded=$('aiModel').value==='bergamot';
  $('aiBackend').querySelector('option[value=webgpu]').disabled = $('aiModel').value !== 'qwen';
  if ($('aiModel').value !== 'qwen') $('aiBackend').value = 'wasm';
  else $('aiBackend').value = UI.settings.aiBackend;
  $('model-download').hidden=embedded;$('model-files-details').hidden=embedded;
  $('model-load').textContent=UI.t(embedded?'aiLoadPackaged':'aiLoadCached');
  $('ai-model-help').textContent=UI.t(embedded?'aiBergamotHelp':$('aiModel').value==='qwen'?'aiQwenHelp':'aiM2MHelp');
  $('ai-state').textContent = UI.t(state.error || 'aiState-' + state.phase);
  if (state.phase === 'ready') $('ai-state').textContent += ` · ${state.backend === 'webgpu' ? 'WebGPU' : 'CPU / WASM'}`;
  $('ai-detail').textContent = state.detail || '';
  const busy = ['downloading', 'loading', 'running'].includes(state.phase);
  $('model-progress').hidden = state.phase !== 'downloading';
  if (state.total > 0) {
    $('model-progress').max = state.total; $('model-progress').value = state.loaded || 0;
    const unit=state.total<1e9?'MB':'GB',factor=unit==='MB'?1e6:1e9;
    const number=new Intl.NumberFormat(UI.locale,{maximumFractionDigits:unit==='MB'?1:2});
    $('model-bytes').textContent = `${number.format((state.loaded || 0) / factor)} / ${number.format(state.total / factor)} ${unit}${state.file?' · '+state.file:''}`;
  } else $('model-bytes').textContent='';
  for (const id of ['model-download', 'model-load', 'model-import', 'aiModel']) $(id).disabled = busy || pageRunning;
  $('ai-generate').disabled = state.modelKind !== 'qwen' || state.phase !== 'ready' || live || fileRunning || pageRunning;
  for (const id of ['ai-translate', 'translate-file']) $(id).disabled = state.phase !== 'ready' || live || fileRunning || pageRunning;
  $('live-mode').disabled = !live && (busy || pageRunning || fileRunning);
  $('page-translate').disabled = !pageSnapshot?.items.length || pageSnapshot.used || state.phase !== 'ready' || live || fileRunning || pageRunning;
  for (const id of ['page-scan','page-refresh','page-tab','page-scope']) $(id).disabled = pageRunning;
  $('page-stop').disabled = !pageRunning;
  $('caption-track').disabled = fileRunning;
  $('caption-loop').disabled=loopStarting;
}
function render() {
  for (const element of document.querySelectorAll('[data-setting]')) {
    const value = UI.settings[element.dataset.setting];
    if (element.type === 'checkbox') element.checked = value; else element.value = value;
  }
  $('aiBackend').querySelector('option[value=webgpu]').disabled = $('aiModel').value !== 'qwen';
  if ($('aiModel').value !== 'qwen') $('aiBackend').value = 'wasm';
  $('captionOffset-value').value = new Intl.NumberFormat(UI.locale, {maximumFractionDigits:1,signDisplay:'always'}).format(UI.settings.captionOffset) + ' s';
  for (const name of ['captionSize', 'captionOpacity']) $(name + '-value').value = UI.settings[name];
  const preview = $('caption-preview');
  preview.style.fontSize = UI.settings.captionSize + 'px'; preview.style.backgroundColor = `rgba(6,21,47,${UI.settings.captionOpacity / 100})`;
  preview.style.fontFamily = {opendyslexic:'OpenDyslexic',lexend:'Lexend',system:'system-ui'}[UI.settings.captionFont];
  preview.children[0].style.color = UI.settings.captionColor; preview.children[1].style.color = UI.settings.captionTranslationColor;
  preview.children[0].hidden = !UI.settings.captionOriginal; preview.children[1].hidden = !UI.settings.captionTranslated;
  renderModel(modelState);
}
async function video(command, tabId=targetId || Number($('video-tab').value)) {
  const token=operation;
  const tab = await browser.tabs.get(tabId);
  if(['overlay','captionPrepare','captionWindow'].includes(command.action) && token!==operation)throw new Error('aiCancelled');
  if (!Aion.webURL(tab.url)) throw new Error('restrictedPage');
  videoPort.postMessage({tabId: tab.id});
  const result = await browser.runtime.sendMessage({type:'mediaTab',tabId:tab.id,command});
  if (result.error) throw new Error(result.error);
  return result;
}
async function overlay() {
  if (!original.length && !translated.length && !live) return;
  await video({action: 'overlay', study:original, original: UI.settings.captionOriginal ? original : [], translated: UI.settings.captionTranslated ? translated : []});
  if (fileRunning && original.length && !$('caption-track').querySelector('option[value=local]')) {
    const option=document.createElement('option');option.value='local';option.textContent=UI.t('captionLocalSource');$('caption-track').append(option);$('caption-track').value='local';
  }
}
async function refreshCaptionTracks() {
  const previous=$('caption-track').value, result=await video({action:'captionSources'});
  const auto=document.createElement('option');auto.value='auto';auto.textContent=UI.t('autoDetect');
  $('caption-track').replaceChildren(auto,...result.tracks.map(track=>{const option=document.createElement('option');option.value=track.id;option.textContent=`${track.label || track.id+1} · ${track.language || '?'}`;return option;}));
  if (result.local) {const option=document.createElement('option');option.value='local';option.textContent=UI.t('captionLocalSource');$('caption-track').append(option);}
  if ([...$('caption-track').options].some(option=>option.value===previous)) $('caption-track').value=previous;
}
async function tabs() {
  const previous = $('video-tab').value;
  const items = (await browser.tabs.query({currentWindow: true})).filter(tab => Aion.webURL(tab.url));
  items.sort((a,b) => b.lastAccessed - a.lastAccessed);
  $('video-tab').replaceChildren(...items.map(tab => {const option = document.createElement('option'); option.value = tab.id; option.textContent = tab.title || tab.url; return option;}));
  if (items.some(tab => String(tab.id) === previous)) $('video-tab').value = previous;
  const pagePrevious = $('page-tab').value;
  $('page-tab').replaceChildren(...items.map(tab => {const option=document.createElement('option');option.value=tab.id;option.textContent=tab.title || tab.url;return option;}));
  if (items.some(tab => String(tab.id) === pagePrevious)) $('page-tab').value = pagePrevious;
  if (pageSnapshot && Number($('page-tab').value) !== pageSnapshot.tabId) clearPagePreview();
}
function clearPagePreview() {
  pageSnapshot=undefined; $('page-preview').value=''; $('page-result').textContent=''; renderModel(modelState);
}
function stopPage() {pageOperation++;pageRunning=false;renderModel(modelState);}
async function pageCommand(command, tabId=Number($('page-tab').value)) {
  const result=await browser.runtime.sendMessage({type:'pageTranslation',tabId,command});
  if (result?.error) throw new Error(result.error);
  return result;
}
async function translatePage() {
  const snapshot=pageSnapshot;
  if (!snapshot?.items.length || snapshot.used || pageRunning) throw new Error('pageScanRequired');
  const token=++pageOperation;snapshot.used=true;pageRunning=true;renderModel(modelState);
  let applied=0,skipped=0;
  const completed=new Map();
  $('page-progress').hidden=false;$('page-progress').max=snapshot.items.length;$('page-progress').value=0;
  try {
    let source=UI.settings.aiSource;
    if (source==='auto') {
      const detection=await browser.i18n.detectLanguage(snapshot.items.map(item=>item.text).join('\n').slice(0,4000));
      if (!detection.isReliable || !detection.languages?.length || detection.languages[0].percentage<50) throw new Error('aiSourceRequired');
      source=detection.languages[0].language;
    }
    for (const item of snapshot.items) {
      if (token!==pageOperation) break;
      let text=completed.get(item.text);
      if (!text) {
        const result=await callAI('translate',{text:item.text,source,target:UI.settings.aiTarget});
        text=result.text;completed.set(item.text,text);
      }
      if (token!==pageOperation) break;
      const result=await pageCommand({action:'apply',token:snapshot.token,id:item.id,text},snapshot.tabId);
      if (result.applied) applied++; else skipped++;
      $('page-progress').value=applied+skipped;
      $('page-result').textContent=UI.t('pageTranslatedCount')+': '+applied+' · '+UI.t('pageSkippedCount')+': '+skipped;
    }
  } finally {if(token===pageOperation){pageRunning=false;renderModel(modelState);}}
}
async function stopVideo() {
  loopGeneration++;
  const stoppedTarget=targetId,stoppedLoop=loopTargetId,token=++operation;
  live=false;fileRunning=false;$('live-mode').checked=false;
  // Clear owned references before awaiting. An older stop must never clear a
  // newer session's tab/port; new starts wait for this cleanup barrier.
  targetId=undefined;loopTargetId=undefined;
  $('caption-track').querySelector('option[value=local]')?.remove();
  videoCleanup=videoCleanup.catch(()=>{}).then(async()=>{
    let cleaned=true;
    const cleanup=async(tabId,action)=>{try{await video({action},tabId);}catch{cleaned=false;}};
    if(stoppedTarget){await cleanup(stoppedTarget,'closeOverlay');await cleanup(stoppedTarget,'captureStop');}
    if(stoppedLoop)await cleanup(stoppedLoop,'captionLoopStop');
    return cleaned;
  });
  const cleaned=await videoCleanup;
  // If an unloading document loses its API context, retain the background
  // port's target: its disconnect handler still owns the final cleanup.
  if(token===operation){if(cleaned)videoPort.postMessage({tabId:null});$('video-state').textContent=UI.t(cleaned?'aiVideoStopped':'aiVideoCleanupPending');renderModel(modelState);}
}
async function liveLoop(token) {
  const known = new Set(), cache=new Map(); let empty = 0, youtubePage, pendingDOM=false;
  while (live && token === operation) {
    const response = await video({action: 'captionWindow', track: $('caption-track').value === 'auto' ? undefined : Number($('caption-track').value)});
    if(!live || token!==operation)return;
    if(response.closed){await stopVideo();return;}
    if(response.provider==='youtube') {
      if(youtubePage && youtubePage!==response.pageKey)throw new Error('youtubeVideoChanged');
      youtubePage=response.pageKey;
      const cue=response.cues[0],key=cue?JSON.stringify([response.language,UI.settings.aiSource,UI.settings.aiTarget,cue.text]):'';
      original=cue?[cue]:[];translated=cue&&cache.has(key)?[{...cue,text:cache.get(key)}]:[];
      $('live-source').textContent=cue?.text || '';$('live-translation').textContent=translated[0]?.text || '';
      $('video-state').textContent=UI.t(cue?'youtubeCaptionActive':++empty>8?'youtubeCaptionMissing':'aiWaitingCaption');
      if(cue)empty=0;
      await overlay();
      // Poll source separately from inference. Never attach a late translation
      // to a newer caption, seek position or SPA video. Only one job is pending.
      if(cue && !cache.has(key) && !pendingDOM && UI.settings.captionTranslated) {
        pendingDOM=true;
        translate(cue.text,response.language).then(async result=>{
          if(!live || token!==operation)return;
          cache.set(key,result.text);if(cache.size>100)cache.delete(cache.keys().next().value);
          const current=await video({action:'captionWindow'});
          if(!live || token!==operation || current.closed || current.pageKey!==youtubePage || current.sourceId!==response.sourceId || !current.cues[0])return;
          original=[current.cues[0]];translated=[{...current.cues[0],text:result.text}];
          $('live-translation').textContent=result.text;await overlay();
        }).catch(async error=>{
          if(!live || token!==operation || error.message==='aiBusy')return;
          await stopVideo();UI.status(error.message in UI.messages?error.message:'operationFailed',true);
        }).finally(()=>{pendingDOM=false;});
      }
      await new Promise(resolve=>setTimeout(resolve,250));continue;
    }
    if ($('caption-track').options.length === 1) response.tracks.forEach((track, index) => {const option = document.createElement('option'); option.value = index; option.textContent = `${track.label || index + 1} · ${track.language || '?'}`; $('caption-track').append(option);});
    if (!response.cues.length) {
      $('video-state').textContent = UI.t(++empty > 8 ? 'aiNoReadableCaptions' : 'aiWaitingCaption');
    } else {
      empty = 0;
      for (const cue of response.cues) {
        if (!live || token !== operation) return;
        const key = `${cue.start}:${cue.end}:${cue.text}`;
        if (known.has(key)) continue;
        const result = await translate(cue.text,response.language);
        if (!live || token !== operation) return;
        known.add(key); original.push(cue); translated.push({...cue, text: result.text});
        if (original.length > 2000) {const removed=original.shift();translated.shift();known.delete(`${removed.start}:${removed.end}:${removed.text}`);}
        $('live-source').textContent = cue.text; $('live-translation').textContent = result.text;
        $('video-state').textContent = UI.t('aiVideoActive'); await overlay();
      }
    }
    await new Promise(resolve => setTimeout(resolve, 700));
  }
}
function downloadCaptions() {
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  const timestamp = value => {const ms = Math.round(value * 1000); return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(v=>String(v).padStart(2,'0')).join(':') + '.' + String(ms%1000).padStart(3,'0');};
  downloadURL = URL.createObjectURL(new Blob(['WEBVTT\n\n' + translated.map(cue => `${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text.replace(/-->/g, '→')}\n`).join('\n')], {type:'text/vtt;charset=utf-8'}));
  $('subtitle-download').href = downloadURL; $('subtitle-download').hidden = !translated.length;
}
function action(id, fn) {$(id).onclick = () => UI.run(fn);}
(async () => {
  await UI.init();
  $('open-wordbook').onclick=()=>UI.run(()=>browser.tabs.create({url:browser.runtime.getURL('aion/wordbook.html')}));
  const languageNames = new Intl.DisplayNames([UI.locale], {type:'language'});
  for (const id of ['aiSource', 'aiTarget','video-source','video-target']) for (const code of languages) {const option=document.createElement('option');option.value=code;option.textContent=languageNames.of(code) || code;$(id).append(option);}
  modelState = await callAI('status'); render(); await tabs();
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id === browser.runtime.id && message.type === 'aionAIState') renderModel(message.state);
  });
  document.addEventListener('aion-settings', () => {render(); if (targetId && (original.length || translated.length)) UI.run(overlay);});
  for (const element of document.querySelectorAll('[data-setting]')) element.addEventListener(element.type === 'range' ? 'input' : 'change', () => UI.run(async () => {
    const value = element.type === 'checkbox' ? element.checked : element.type === 'range' ? Number(element.value) : element.value;
    if (['aiSource','aiTarget','aiBackend'].includes(element.dataset.setting)) {stopPage();await stopVideo();}
    if (element.dataset.setting==='captionOffset' && loopTargetId) {loopGeneration++;await video({action:'captionLoopStop'},loopTargetId).catch(()=>{});loopTargetId=undefined;}
    await UI.save({[element.dataset.setting]: value});
  }));
  $('aiModel').onchange = () => UI.run(async () => {const selected = $('aiModel').value; stopPage();await stopVideo(); const state = await callAI('unload'); $('aiModel').value = selected; renderModel(state); if (selected !== 'qwen') await UI.save({aiBackend:'wasm'}); render();});
  action('reset-caption-offset', () => UI.save({captionOffset:0}));
  action('model-download', async () => {await navigator.storage.persist?.(); await callAI('load', {download: true, backend: $('aiModel').value !== 'qwen' ? 'wasm' : UI.settings.aiBackend, modelKind: $('aiModel').value});});
  action('model-load', () => callAI('load', {backend: $('aiModel').value !== 'qwen' ? 'wasm' : UI.settings.aiBackend, modelKind: $('aiModel').value}));
  action('ai-start-ready',async()=>{
    if(modelState.phase!=='ready'||modelState.modelKind!=='bergamot'){$('aiModel').value='bergamot';await callAI('load',{backend:'wasm',modelKind:'bergamot'});}
    const focus=entry.get('focus'),id=focus==='video'?'ai-video-section':focus==='page'?'ai-page-section':'ai-text-section';
    $(id).scrollIntoView({block:'start'});if(id==='ai-text-section')$('ai-text').focus({preventScroll:true});
  });
  action('model-import', async () => {await navigator.storage.persist?.(); await callAI('load', {backend: $('aiModel').value !== 'qwen' ? 'wasm' : UI.settings.aiBackend, modelKind: $('aiModel').value, files: [...$('model-files').files]});});
  action('model-cancel', async () => {stopPage();await stopVideo(); await callAI('cancel');});
  action('model-unload', async () => {stopPage();await stopVideo(); await callAI('unload');});
  action('model-delete', async () => {if (confirm(UI.t('aiConfirmDelete'))) {stopPage();await stopVideo(); await callAI('clear', {modelKind: $('aiModel').value});}});
  action('page-refresh',tabs);
  $('page-tab').onchange=()=>clearPagePreview();
  $('page-scope').onchange=()=>clearPagePreview();
  action('page-scan',async()=>{
    const tabId=Number($('page-tab').value),result=await pageCommand({action:'scan',scope:$('page-scope').value},tabId);
    pageSnapshot={...result,tabId};$('page-preview').value=result.items.map(item=>item.text).join('\n\n');
    $('page-result').textContent=UI.t('pageScannedCount')+': '+result.items.length+(result.limited?' · '+UI.t('pageScanLimited'):'');
    $('page-progress').hidden=true;renderModel(modelState);
  });
  action('page-translate',translatePage);
  action('page-stop',async()=>{stopPage();await callAI('cancel');});
  action('page-restore',async()=>{
    const running=pageRunning;stopPage();if(running)await callAI('cancel');
    const result=await pageCommand({action:'restore'});clearPagePreview();
    $('page-result').textContent=UI.t('pageRestoredCount')+': '+result.restored+' · '+UI.t('pageSkippedCount')+': '+result.skipped;
  });
  action('ai-translate', async () => {$('ai-result').value = (await translate($('ai-text').value)).text;});
  action('ai-generate', async () => {$('ai-answer').textContent = (await callAI('generate', {text: $('ai-prompt').value})).text;});
  action('video-refresh', tabs);
  action('caption-refresh',refreshCaptionTracks);
  $('video-tab').onchange = () => UI.run(async () => {await stopVideo(); $('study-text').value = ''; $('caption-track').replaceChildren($('caption-track').options[0]);});
  $('caption-track').onchange = () => UI.run(async () => {loopGeneration++;if(live)await stopVideo();else await video({action:'captionLoopStop'});$('study-text').value='';});
  $('live-mode').onchange = () => UI.run(async () => {
    if (!$('live-mode').checked) {await stopVideo(); return;}
    if ($('caption-track').value==='local') {$('live-mode').checked=false;throw new Error('captionNativeForLive');}
    targetId = Number($('video-tab').value); if (!targetId) throw new Error('restrictedPage');
    original = []; translated = []; live = true; const token = ++operation;
    $('live-source').textContent='';$('live-translation').textContent='';
    renderModel(modelState);
    try {
      const cleaned=await videoCleanup;if(cleaned===false)throw new Error('aiVideoCleanupPending');
      if(!live || token!==operation)return;
      await video({action:'captionPrepare'});
      if(!live || token!==operation)return;
      if(modelState.phase!=='ready') {
        if($('aiModel').value!=='bergamot')throw new Error('aiModelMissing');
        $('video-state').textContent=UI.t('aiState-loading');
        await callAI('load',{backend:'wasm',modelKind:'bergamot'});
      }
      if(!live || token!==operation)return;
    } catch(error) {if(token!==operation)return;await stopVideo();throw error;}
    liveLoop(token).catch(async error => {if (token === operation) {await stopVideo(); UI.status(error.message in UI.messages ? error.message : 'operationFailed', true);}});
  });
  action('stop-video', stopVideo);
  for (const direction of ['previous','repeat','next']) action('caption-'+direction, async () => {
    const result = await video({action:'captionNavigate',direction,track:studyTrack()});
    $('study-text').value = result.text.slice(0,300);
    UI.status(result.playing ? 'captionReplaying' : 'captionPositioned');
  });
  action('caption-read', async () => {
    const result = await video({action:'captionCurrent',track:studyTrack()});
    $('study-text').value = result.text.slice(0,300); UI.status(result.text ? 'selectionRead' : 'noCaptions');
  });
  action('caption-loop',async()=>{
    const generation=++loopGeneration,tabId=targetId||Number($('video-tab').value);loopTargetId=tabId;loopStarting=true;renderModel(modelState);
    try {
      const result=await video({action:'captionLoop',track:studyTrack()},tabId);
      if(generation!==loopGeneration){await video({action:'captionLoopStop'},tabId).catch(()=>{});return;}
      $('study-text').value=result.text.slice(0,300);UI.status(result.playing?'captionLooping':'captionPositioned');
    } finally {loopStarting=false;renderModel(modelState);}
  });
  action('caption-loop-stop',async()=>{loopGeneration++;await video({action:'captionLoopStop'},loopTargetId||targetId||Number($('video-tab').value));loopTargetId=undefined;UI.status('captionLoopStopped');});
  action('caption-save', async () => {await browser.runtime.sendMessage({type:'word',word:$('study-text').value});UI.status('wordSaved');});
  action('translate-file', async () => {
    await stopVideo(); const token = ++operation;
    const file = $('subtitle-file').files[0]; if (!file) throw new Error('chooseSubtitle');
    if (file.size > 2 * 1024 * 1024) throw new Error('fileTooLarge');
    original = Aion.parseVTT(await file.text()); if (!original.length) throw new Error('invalidCaptions');
    fileRunning = true; renderModel(modelState);
    translated = []; targetId = Number($('video-tab').value) || undefined;
    $('subtitle-progress').hidden = false; $('subtitle-progress').max = original.length; $('subtitle-progress').value = 0;
    try {for (const cue of original) {
      if (token !== operation) break;
      const result = await translate(cue.text); if (token !== operation) break;
      translated.push({...cue, text: result.text});
      $('subtitle-progress').value = translated.length; $('subtitle-count').textContent = `${translated.length} / ${original.length}`;
      $('live-source').textContent = cue.text; $('live-translation').textContent = result.text; downloadCaptions();
      if (targetId) await overlay();
    }} finally {fileRunning = false; renderModel(modelState);}
  });
  $('settings').onclick = () => browser.runtime.openOptionsPage();
  window.addEventListener('pagehide', () => {stopPage();stopVideo(); if (downloadURL) URL.revokeObjectURL(downloadURL);});
  const entry=new URLSearchParams(location.hash.slice(1)),target=entry.get('target');
  if(target && /^\d+$/.test(target))for(const id of ['video-tab','page-tab'])if([...$(id).options].some(option=>option.value===target))$(id).value=target;
  if(entry.get('model')==='qwen'){$('aiModel').value='qwen';await $('aiModel').onchange();$('ai-general-panel').open=true;}
  const destinations={models:'ai-model-section',video:'ai-video-section',page:'ai-page-section',text:'ai-text-section'};
  if(destinations[entry.get('focus')])$(destinations[entry.get('focus')]).scrollIntoView({block:'start'});
  document.body.inert=false;document.body.removeAttribute('aria-busy');
  document.body.dataset.ready = 'true';
})().catch(error => {document.body.inert=false;document.body.removeAttribute('aria-busy');UI.status(error.message in UI.messages ? error.message : 'aiRuntimeFailed', true);});
