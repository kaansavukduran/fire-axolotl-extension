/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
const $ = id => document.getElementById(id);
const send = message => browser.runtime.sendMessage(message);
let draftEdited = false;
const toolbarPopup=browser.extension.getViews({type:'popup'}).includes(window);
const entry=new URLSearchParams(location.hash.slice(1));
let activeModule=entry.get('section') || 'translation',modelState={phase:'unloaded',modelKind:'bergamot'};
const targetId=()=>$('target-tab').value==='active'?undefined:Number($('target-tab').value);
async function targetForLink() {
  const id=targetId();if(id!==undefined)return id;
  const [tab]=await browser.tabs.query({active:true,currentWindow:true});return Aion.webURL(tab?.url)?tab.id:undefined;
}
async function launch(page,options={}) {
  const id=await targetForLink(),params=new URLSearchParams(options);
  if(id!==undefined)params.set('target',id);
  await browser.tabs.create({url:browser.runtime.getURL('aion/'+page)+(params.size?'#'+params:'')});
  if(toolbarPopup)window.close();
}
async function targets() {
  const previous=$('target-tab').value || entry.get('target') || 'active';
  const auto=document.createElement('option');auto.value='active';auto.textContent=UI.t('panelActiveTab');
  const tabs=(await browser.tabs.query({currentWindow:true})).filter(tab=>Aion.webURL(tab.url));
  $('target-tab').replaceChildren(auto,...tabs.map(tab=>{const option=document.createElement('option');option.value=tab.id;option.textContent=tab.title || tab.url;return option;}));
  if(previous!=='active' && !tabs.some(tab=>String(tab.id)===previous)){const missing=document.createElement('option');missing.value=previous;missing.textContent=UI.t('targetTabMissing');missing.disabled=true;$('target-tab').append(missing);}
  $('target-tab').value=previous;
}
function renderModelStatus() {
  const names={bergamot:'Bergamot · EN ↔ TR',qwen:'Qwen 2.5 · 1.5B',m2m:'M2M100 · 418M'};
  const key=modelState.phase==='unloaded'&&modelState.modelKind==='bergamot'?'panelPackagedReady':modelState.phase==='unloaded'?'panelModelNeedsLoad':'aiState-'+modelState.phase;
  $('local-model-status').textContent=UI.t(key)+(modelState.phase==='unloaded'&&modelState.modelKind==='bergamot'?'':' · '+(names[modelState.modelKind]||''));
  $('translate-local').disabled=UI.settings.disabledModules.includes('ai') || ['loading','running','downloading'].includes(modelState.phase);
}
function languageChoices() {
  const names=new Intl.DisplayNames([UI.locale],{type:'language'});
  for(const [id,key] of [['popup-source','aiSource'],['popup-target','aiTarget']]) {
    const codes=[...(id==='popup-source'?['auto']:[]),'en','tr',UI.settings[key]].filter((code,i,all)=>all.indexOf(code)===i);
    $(id).replaceChildren(...codes.map(code=>{const o=document.createElement('option');o.value=code;o.textContent=code==='auto'?UI.t('autoDetect'):names.of(code);return o;}));$(id).value=UI.settings[key];
  }
}
$('source-text').addEventListener('input', () => {draftEdited = true; browser.storage.local.set({aionDraft: $('source-text').value}).catch(() => UI.status('operationFailed', true));});
async function refresh() {
  $('provider').textContent = UI.settings.endpoint ? `${UI.t('provider')}: ${UI.settings.endpoint} · ${UI.settings.targetLanguage}` : UI.t('noProvider');
  $('progress-section').hidden = toolbarPopup || !UI.settings.progress;
  $('progress-count').textContent = `${new Intl.NumberFormat(UI.locale).format(UI.settings.milestones.length)} / 3`;
  $('progress-bar').value = UI.settings.milestones.length;
  $('quality').value = UI.settings.quality;
  if(UI.settings.disabledModules.includes(activeModule))activeModule=UI.settings.moduleOrder.find(key=>!UI.settings.disabledModules.includes(key));
  for (const key of UI.settings.moduleOrder) {
    const section=document.querySelector(`[data-module="${key}"]`),button=document.querySelector(`[data-show-module="${key}"]`);
    if(section){section.hidden=UI.settings.disabledModules.includes(key)||(toolbarPopup&&activeModule!==key);document.querySelector('main').insertBefore(section,$('progress-section'));}
    if(button){button.hidden=UI.settings.disabledModules.includes(key);button.setAttribute('aria-pressed',String(key===activeModule));$('quick-nav').append(button);}
  }
  languageChoices();renderModelStatus();
}
async function containers() {
  if (UI.settings.disabledModules.includes('containers')) return;
  const select = $('container');
  const identities = await send({type: 'containers'});
  const previous=select.value;select.replaceChildren();
  for (const identity of identities) {
    const option = document.createElement('option'); option.value = identity.cookieStoreId; option.textContent = identity.name + (identity.temporary ? ` · ${UI.t('temporary')}` : ''); select.append(option);
  }
  if (!identities.length) {const option = document.createElement('option'); option.textContent = UI.t('noContainers'); select.append(option);}
  if(identities.some(identity=>identity.cookieStoreId===previous))select.value=previous;
  $('open-container').disabled = !identities.length;
}
function action(id, fn) {$(id).addEventListener('click', () => UI.run(fn));}
async function video(command) {
  const response = await send({type: 'video', tabId:targetId(),command,remember:command.action==='speed'&&$('remember-speed').checked});
  UI.status('applied'); return response;
}
async function fileCues(id) {
  const file = $(id).files[0];
  if (!file) return [];
  if (file.size > 2 * 1024 * 1024) throw new Error('fileTooLarge');
  const cues = Aion.parseVTT(await file.text());
  if (!cues.length) throw new Error('invalidCaptions');
  return cues;
}
(async () => {
  document.documentElement.dataset.surface=toolbarPopup?'popup':'workspace';
  if(toolbarPopup){
    const width=Math.max(240,Math.min(640,screen.availWidth-32));
    document.documentElement.style.width=width+'px';document.body.style.width=width+'px';
    // Keep the native panel's preferred width stable; fit its content if Firefox
    // constrains the anchored viewport. Viewport-sized roots cause resize loops.
    const fit=()=>{if(document.visibilityState==='visible'&&innerWidth>=240)document.body.style.width=Math.min(width,innerWidth)+'px';};
    window.addEventListener('resize',fit);document.addEventListener('visibilitychange',fit);
  }
  if(!toolbarPopup){document.body.classList.remove('popup');document.body.classList.add('workspace');}
  await UI.init();await targets();modelState=await send({type:'localAI',action:'status'});await refresh();await containers();
  $('open-workspace').hidden=!toolbarPopup;$('target-section').hidden=toolbarPopup;$('more-tools').open=!toolbarPopup;
  $('source-tools').open=!toolbarPopup;
  if(toolbarPopup)document.querySelector('main').insertBefore($('more-tools'),$('status'));
  action('open-workspace',()=>launch('popup.html',{section:activeModule || 'translation'}));
  for(const button of document.querySelectorAll('[data-show-module]'))button.onclick=()=>{
    activeModule=button.dataset.showModule;UI.run(async()=>{await refresh();document.querySelector(`[data-module="${activeModule}"]`)?.scrollIntoView({block:'start',behavior:'instant'});});
  };
  for(const [id,key] of [['popup-source','aiSource'],['popup-target','aiTarget']])$(id).onchange=()=>UI.run(()=>UI.save({[key]:$(id).value}));
  $('target-tab').onchange=()=>UI.status('panelTargetSelected');
  browser.runtime.onMessage.addListener((message,sender)=>{if(sender.id===browser.runtime.id&&message.type==='aionAIState'){modelState=message.state;renderModelStatus();}});
  browser.tabs.onRemoved.addListener(()=>UI.run(targets));
  const draft = (await browser.storage.local.get('aionDraft')).aionDraft;
  if (!draftEdited && typeof draft === 'string') $('source-text').value = draft.slice(0, 5000);
  action('open-game',()=>browser.tabs.create({url:browser.runtime.getURL('aion/newtab.html')}));
  action('open-tabs', () => browser.sidebarAction.open());
  action('open-ai',()=>launch('ai.html',{focus:'models'}));
  action('open-qwen',()=>launch('ai.html',{model:'qwen',focus:'models'}));
  action('open-video-ai',()=>launch('ai.html',{focus:'video'}));
  action('open-page-ai',()=>launch('ai.html',{focus:'page'}));
  action('open-wordbook', () => browser.tabs.create({url: browser.runtime.getURL('aion/wordbook.html')}));
  action('open-tools', () => browser.tabs.create({url: browser.runtime.getURL('aion/tools.html')}));
  action('open-blocker', async () => {
    const [tab] = await browser.tabs.query({active: true, currentWindow: true});
    await browser.tabs.create({url: browser.runtime.getURL('popup-fenix.html') + '?tabId=' + tab.id});
  });
  document.addEventListener('aion-settings', () => UI.run(async()=>{await refresh();await targets();await containers();}));
  action('settings', () => browser.runtime.openOptionsPage());
  action('open-characters', async () => {const opened = browser.sidebarAction.open(); await browser.storage.local.set({aionSidebarCompanions: true}); await opened;});
  $('container-form').addEventListener('submit', event => {event.preventDefault(); UI.run(async () => {
    const identity = await send({type: 'createContainer', name: $('container-name').value});
    $('container-name').value = ''; await containers(); $('container').value = identity.cookieStoreId; UI.status('created');
  });});
  action('open-container', async () => {await send({type: 'openContainer',tabId:targetId(),id: $('container').value}); UI.status('opened');});
  action('temporary-container', async () => {await send({type: 'temporaryContainer',tabId:targetId(),name: UI.locale === 'en' ? 'Temporary' : 'Geçici'}); UI.status('opened');});
  for (const [a, b] of [['speed', 'speed-number'], ['speed-number', 'speed']]) $(a).addEventListener('input', () => {$(b).value = $(a).value;});
  action('apply-speed', () => video({action: 'speed', value: Number($('speed-number').value)}));
  action('forget-speed',async()=>{await send({type:'forgetSpeed',tabId:targetId()});$('speed').value=$('speed-number').value=1;UI.status('applied');});
  action('reset-speed', async () => {$('speed').value = $('speed-number').value = 1; await video({action: 'speed', value: 1});});
  $('quality').addEventListener('change', () => UI.run(() => UI.save({quality: $('quality').value})));
  action('apply-quality', async () => {await video({action: 'quality', value: $('quality').value}); UI.status('qualityRequested');});
  action('read-resolution', async () => {
    const result = await video({action: 'info'});
    $('resolution').textContent = result.width && result.height ? `${UI.t('actualResolution')}: ${result.width} × ${result.height}` : UI.t('resolutionUnknown');
  });
  action('read-selection', async () => {$('source-text').value = await send({type: 'selection',tabId:targetId()}); await browser.storage.local.set({aionDraft: $('source-text').value}); UI.status($('source-text').value ? 'selectionRead' : 'textRequired');});
  action('read-caption', async () => {const response = await video({action: 'captions'}); $('source-text').value = response.text; await browser.storage.local.set({aionDraft: response.text}); UI.status(response.text ? 'selectionRead' : 'noCaptions');});
  action('translate-local',async()=>{$('translate-local').disabled=true;UI.status('aiState-running');try{const response=await send({type:'localAI',action:'translate',text:$('source-text').value,source:UI.settings.aiSource,target:UI.settings.aiTarget});$('translation-result').value=response.text;UI.status('translated');if(toolbarPopup)$('translation-result').scrollIntoView({block:'center'});}finally{renderModelStatus();}});
  action('translate', async () => {
    if (!UI.settings.endpoint) throw new Error('noProvider');
    $('translate').disabled = true; $('translation-result').value = ''; UI.status('translating');
    try {const response = await send({type: 'translate', text: $('source-text').value}); $('translation-result').value = response.text; UI.status('translated');}
    finally {$('translate').disabled = false;}
  });
  action('save-word', async () => {await send({type: 'word', word: $('source-text').value}); UI.status('wordSaved');});
  action('show-subtitles', async () => {
    const original = await fileCues('original-file'), translated = await fileCues('translated-file');
    if (!original.length && !translated.length) throw new Error('chooseSubtitle');
    await video({action: 'overlay', original, translated});
  });
  action('hide-subtitles', () => video({action: 'closeOverlay'}));
  if(!toolbarPopup && ['translation','video','ai','containers','characters'].includes(entry.get('section')))document.querySelector(`[data-module="${entry.get('section')}"]`)?.scrollIntoView({block:'start'});
  document.body.inert=false;document.body.removeAttribute('aria-busy');
  document.body.dataset.ready = 'true';
})().catch(() => {document.body.inert=false;document.body.removeAttribute('aria-busy');UI.status('operationFailed', true);});
