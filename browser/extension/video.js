/* SPDX-License-Identifier: MPL-2.0 */
(() => {
  'use strict';
  if (globalThis.__aionVideoInstalled) return;
  globalThis.__aionVideoInstalled = true;
  let overlay, stopOverlay, capturedTrack, capturedMode, defaultSpeed, mediaObserver, localCaptionSource, stopLoop, refreshOverlay;
  let captionsClosed=false;
  const speedListeners=new Map();
  function video(action) {
    const videos = [...document.querySelectorAll('video')].filter(v => v.getBoundingClientRect().width > 0);
    if (!videos.length && ['speed','info','setDefaultSpeed','clearDefaultSpeed'].includes(action)) return [...document.querySelectorAll('audio')].sort((a,b)=>Number(a.paused)-Number(b.paused))[0];
    return videos.sort((a, b) => Number(b === document.pictureInPictureElement) - Number(a === document.pictureInPictureElement) || Number(!b.paused) - Number(!a.paused) || b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  }
  function showOverlay(v, original, translated, language, preferences = {}, sourceCues = original, studyUI = {}, studyToken, studyRevision) {
    const offset = Number.isFinite(preferences.offset) ? Math.max(-10, Math.min(10, preferences.offset)) : 0;
    // Shift both tracks together; keep the caller's source/export timestamps intact.
    const shift = cues => cues.filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start)
      .map(c => ({...c, start: Math.max(0, c.start + offset), end: c.end + offset})).filter(c => c.end > c.start);
    original = shift(original); translated = shift(translated);
    const signature = JSON.stringify([language,preferences,studyUI]);
    if (refreshOverlay?.video === v && refreshOverlay.token === studyToken && refreshOverlay.signature === signature) {
      refreshOverlay.update(original,translated,sourceCues,studyRevision);return;
    }
    const size = Number.isFinite(preferences.size) ? Math.max(16, Math.min(48, preferences.size)) : 24;
    const opacity = Number.isFinite(preferences.opacity) ? Math.max(0, Math.min(100, preferences.opacity)) / 100 : .9;
    const color = /^#[0-9a-f]{6}$/i.test(preferences.color) ? preferences.color : '#ffffff';
    const secondaryColor = /^#[0-9a-f]{6}$/i.test(preferences.translationColor) ? preferences.translationColor : '#85e7ff';
    const top = preferences.position === 'top';
    const font = {opendyslexic: 'AionOpenDyslexic', lexend: 'AionLexend'}[preferences.font] || 'system-ui';
    if (stopOverlay) stopOverlay(false);
    localCaptionSource = {video:v, cues:sourceCues};
    let studyCues=shift(sourceCues);
    overlay = document.createElement('div');
    overlay.setAttribute('data-aion-captions', '');
    // Fixed host remains visible when video is inside an arbitrary site layout.
    overlay.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none';
    const shadow = overlay.attachShadow({mode: 'closed'});
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}section{position:relative;width:max-content;box-sizing:border-box;max-width:calc(100% - 16px);margin:auto;padding:10px 62px 10px 16px;background:#06152ff0;color:white;border-radius:12px;font:clamp(16px,2.5vw,28px)/1.5 system-ui;text-align:center;white-space:pre-line;overflow-wrap:anywhere}p{margin:0}p+p{color:#85e7ff}button{position:absolute;top:8px;right:8px;pointer-events:auto;color:white;background:#18355b;border:1px solid white;border-radius:6px;min-width:36px;min-height:36px;font:inherit}button:focus-visible{outline:3px solid #ff83b9}';
    style.textContent += `section{font:${size}px/1.5 ${font},sans-serif;background:rgba(6,21,47,${opacity});color:${color}}p+p{color:${secondaryColor}}`;
    const fontRules = `@font-face{font-family:AionOpenDyslexic;src:url('${browser.runtime.getURL('aion/fonts/OpenDyslexic-Regular.otf')}')}@font-face{font-family:AionLexend;src:url('${browser.runtime.getURL('aion/fonts/Lexend.ttf')}')}`;
    style.textContent += fontRules;
    style.textContent += '.learn{position:static;display:block;margin:8px auto 0;font:14px/1.4 system-ui;padding:4px 10px}.study{pointer-events:auto;font:14px/1.5 system-ui;text-align:start;max-width:560px;max-height:55vh;overflow:auto;white-space:normal}.study[hidden]{display:none}.study p{margin:8px 0;color:white}.study button{position:static;font:inherit;padding:5px 8px;margin:3px;border-color:#87a9d2}.words button{min-width:0;min-height:32px;padding:0 3px;margin:0;border:0;background:transparent;color:#fff;text-decoration:underline;text-decoration-style:dotted}.words button[aria-pressed=true]{background:#516a91}.study select{color:#fff;background:#18355b;font:inherit;max-width:160px;margin:4px;padding:5px}.study label{display:inline-block}.study output{display:block;color:#85e7ff;white-space:pre-wrap}.study [role=status]{min-height:1.5em;color:#ffcae1}.study button:disabled{opacity:.55}.study .local{font-size:12px;color:#a7c6e9}';
    style.textContent += '.learn[hidden]{display:none}section[data-studying]>p{display:none}';
    const nativeStyle = document.createElement('style');
    nativeStyle.textContent = fontRules + `video::cue(#aion-native){font-size:${size}px;color:${color};background-color:rgba(6,21,47,${opacity})}video::cue(#aion-native-translated){font-size:${size}px;color:${secondaryColor};background-color:rgba(6,21,47,${opacity})}`;
    (document.head || document.documentElement).append(nativeStyle);
    const section = document.createElement('section');
    const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', language === 'en' ? 'Close subtitles' : 'Altyazıyı kapat');
    const first = document.createElement('p'), second = document.createElement('p');
    const learn = document.createElement('button');learn.className='learn';learn.textContent=studyUI.labels?.captionStudy || 'Learn';
    const study = document.createElement('div');study.className='study';study.hidden=true;study.setAttribute('role','region');study.setAttribute('aria-label',learn.textContent);
    const labels=studyUI.labels || {}, t=key=>labels[key] || labels.operationFailed || key;
    const help=document.createElement('p');help.textContent=t('captionStudyHelp');
    const words=document.createElement('div');words.className='words';
    const selected=document.createElement('p'), result=document.createElement('output'), feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    const source=document.createElement('select'), target=document.createElement('select');
    const languageNames=new Intl.DisplayNames([language==='en'?'en':'tr'],{type:'language'});
    for(const [select,initial,key] of [[source,studyUI.source || 'auto','captionStudySource'],[target,studyUI.target || 'tr','captionStudyTarget']]) {
      select.setAttribute('aria-label',t(key));
      const codes=[...(select===source?['auto']:[]),'en','tr',initial].filter((code,index,all)=>all.indexOf(code)===index);
      for(const code of codes){const option=document.createElement('option');option.value=code;option.textContent=code==='auto'?'Auto':languageNames.of(code);select.append(option);}
      select.value=initial;
    }
    const makeButton=key=>{const b=document.createElement('button');b.textContent=t(key);return b;};
    const sentence=makeButton('captionStudySentence'), translate=makeButton('captionStudyTranslate'), save=makeButton('captionStudySave'), resume=makeButton('captionStudyContinue');
    const sourceLabel=document.createElement('label');sourceLabel.append(t('captionStudySource'),source);
    const targetLabel=document.createElement('label');targetLabel.append(t('captionStudyTarget'),target);
    const local=document.createElement('p');local.className='local';local.textContent=t('captionStudyLocal');
    study.append(help,words,sentence,selected,sourceLabel,targetLabel,translate,save,result,feedback,local,resume);
    section.append(close, first, second, learn, study);shadow.append(style, section);
    let selectedText='', studySentence='', studyGeneration=0;
    const selectText=text=>{
      studyGeneration++;selectedText=text;selected.textContent=text;result.textContent='';feedback.textContent='';
      translate.disabled=save.disabled=!text || text.length>300;
      for(const button of words.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.textContent===text));
    };
    const sendStudy=(action,options={})=>browser.runtime.sendMessage({type:'captionStudy',token:studyToken,revision:studyRevision,action,...options});
    const closeStudy=(resumePlayback=false)=>{
      studyGeneration++;study.hidden=true;section.removeAttribute('data-studying');learn.hidden=false;learn.focus();update();
      if(resumePlayback)v.play().catch(()=>{});
    };
    learn.onclick=event=>{
      if(!event.isTrusted || !studyToken)return;
      const current=studyCues.filter(c=>v.currentTime>=c.start&&v.currentTime<c.end);
      studySentence=String(current[0]?.text || '').trim();if(!studySentence)return;
      v.pause();stopLoop?.();words.replaceChildren();
      const pattern=/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;let end=0;
      for(const match of studySentence.matchAll(pattern)) {
        words.append(document.createTextNode(studySentence.slice(end,match.index)));
        const button=document.createElement('button');button.textContent=match[0];button.onclick=e=>{if(e.isTrusted)selectText(match[0]);};words.append(button);end=match.index+match[0].length;
      }
      words.append(document.createTextNode(studySentence.slice(end)));
      selectText(studySentence);study.hidden=false;section.setAttribute('data-studying','');learn.hidden=true;sentence.disabled=studySentence.length>300;update();
      (words.querySelector('button') || resume).focus();
    };
    sentence.onclick=event=>{if(event.isTrusted)selectText(studySentence);};
    for(const select of [source,target])select.onchange=()=>selectText(selectedText);
    const studyAction=async(action,event)=>{
      if(!event.isTrusted || !selectedText || selectedText.length>300)return;
      const generation=++studyGeneration;translate.disabled=save.disabled=true;feedback.textContent=t('captionStudyPending');
      try {
        const response=await sendStudy(action,{text:selectedText,source:source.value,target:target.value});
        if(generation!==studyGeneration || study.hidden || !overlay.isConnected)return;
        if(action==='translate')result.textContent=response.text;feedback.textContent=action==='save'?t('captionStudySaved'):'';
      } catch(error) {
        if(generation===studyGeneration && !study.hidden)feedback.textContent=t(String(error.message || '').replace(/^Error: /,''));
      } finally {if(generation===studyGeneration)translate.disabled=save.disabled=false;}
    };
    translate.onclick=event=>studyAction('translate',event);save.onclick=event=>studyAction('save',event);
    resume.onclick=event=>{if(event.isTrusted)closeStudy(true);};
    study.addEventListener('keydown',event=>{if(event.isTrusted && event.key==='Escape'){event.stopPropagation();closeStudy();}});
    // A video element's native fullscreen surface cannot display arbitrary DOM
    // children. Supply the same local cues through the browser's text renderer.
    const previousTracks = [...v.textTracks].filter(track => track.mode === 'showing');
    previousTracks.forEach(track => {track.mode = 'hidden';});
    const nativeElement = document.createElement('track');
    nativeElement.kind = 'subtitles'; nativeElement.label = 'Aion';
    nativeElement.srclang = language === 'en' ? 'en' : 'tr';
    v.append(nativeElement);
    const nativeTrack = nativeElement.track;
    nativeTrack.mode = 'disabled';
    const escapeCue = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    function updateNative() {
      // A disabled Firefox TextTrack exposes cues as null. Read its real list
      // while hidden so frequent live refreshes replace rather than accumulate.
      const previousMode=nativeTrack.mode;nativeTrack.mode='hidden';
      try {
      for(const cue of [...(nativeTrack.cues || [])])nativeTrack.removeCue(cue);
      for (const [cues, line, id] of [[original, top ? 8 : translated.length ? 78 : 88, 'aion-native'], [translated, top ? 18 : 88, 'aion-native-translated']]) {
      for (const item of cues) {
        if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.end <= item.start) continue;
        const cue = new VTTCue(item.start, item.end, escapeCue(item.text));
        cue.id = id; cue.snapToLines = false; cue.line = line; cue.align = 'center';
        nativeTrack.addCue(cue);
      }
      }
      } finally {nativeTrack.mode=previousMode;}
    }
    updateNative();
    function move() {
      const fullscreen = document.fullscreenElement;
      const nativeFullscreen = fullscreen === v;
      nativeTrack.mode = nativeFullscreen ? 'showing' : 'disabled';
      overlay.hidden = nativeFullscreen || (!!fullscreen && !fullscreen.contains(v));
      overlay.style.display = overlay.hidden ? 'none' : 'block';
      const parent = fullscreen && fullscreen !== v && fullscreen.contains(v) ? fullscreen : document.body;
      parent.append(overlay);
    }
    move();
    function textAt(cues) {return cues.filter(c => v.currentTime >= c.start && v.currentTime < c.end).map(c => c.text).join('\n');}
    function update() {
      if (!v.isConnected) {stopOverlay?.(); return;}
      first.textContent = textAt(original); second.textContent = textAt(translated);
      first.hidden = !first.textContent; second.hidden = !second.textContent;
      const rect = v.getBoundingClientRect();
      study.style.maxHeight = Math.max(120,Math.min(innerHeight*.65,rect.height-50)) + 'px';
      learn.hidden = !study.hidden || !studyToken || (!original.length && !translated.length) || !studyCues.some(c=>v.currentTime>=c.start&&v.currentTime<c.end);
      section.hidden = (study.hidden && !first.textContent && !second.textContent && learn.hidden) || rect.bottom < 0 || rect.top > innerHeight;
      const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
      overlay.style.left = left + 'px'; overlay.style.width = Math.max(0, right - left) + 'px';
      const height = overlay.getBoundingClientRect().height;
      overlay.style.top = Math.max(0, Math.min(innerHeight - height, top ? rect.top + 12 : rect.bottom - height - 12)) + 'px';
    }
    const timer = setInterval(update, 150); update();
    globalThis.AionYouTubeCaptions?.cover(v);
    refreshOverlay = {video:v,token:studyToken,signature,update:(nextOriginal,nextTranslated,nextSource,nextRevision)=>{
      original=nextOriginal;translated=nextTranslated;studyCues=shift(nextSource);studyRevision=nextRevision;localCaptionSource={video:v,cues:nextSource};updateNative();update();
    }};
    document.addEventListener('fullscreenchange', move);
    const onPageHide = () => {stopLoop?.();stopOverlay?.();};
    stopOverlay = (revoke=true) => {
      studyGeneration++;refreshOverlay=undefined;
      clearInterval(timer);
      document.removeEventListener('fullscreenchange', move);
      window.removeEventListener('pagehide', onPageHide);
      nativeTrack.mode = 'disabled'; nativeElement.remove(); nativeStyle.remove();
      previousTracks.forEach(track => {if (track.mode === 'hidden') track.mode = 'showing';});
      overlay.remove(); stopOverlay = null;
      localCaptionSource = undefined;
      globalThis.AionYouTubeCaptions?.uncover();
      if(revoke && studyToken)sendStudy('close').catch(()=>{});
    };
    close.onclick = () => {captionsClosed=true;stopLoop?.();stopOverlay?.();};
    window.addEventListener('pagehide', onPageHide, {once: true});
  }
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || message.type !== 'aionVideo') return undefined;
    const cmd = message.command || {};
    if(cmd.action==='closeOverlay'){stopLoop?.();stopOverlay?.();return Promise.resolve({stopped:true});}
    if(cmd.action==='captionLoopStop'){stopLoop?.();return Promise.resolve({stopped:true});}
    if(cmd.action==='captureStop'){stopLoop?.();globalThis.AionYouTubeCaptions?.stop();}
    if(cmd.action==='captureStop'&&!video('info')){if(capturedTrack&&capturedTrack.mode==='hidden')capturedTrack.mode=capturedMode;capturedTrack=null;return Promise.resolve({stopped:true});}
    if(cmd.action==='clearDefaultSpeed'){mediaObserver?.disconnect();mediaObserver=null;for(const [media,listener] of speedListeners)media.removeEventListener('loadedmetadata',listener);speedListeners.clear();defaultSpeed=undefined;return Promise.resolve({stopped:true});}
    if(cmd.action==='setDefaultSpeed'){
      const speed=Number(cmd.value);if(!Number.isFinite(speed)||speed<.25||speed>4)return Promise.resolve({error:'invalidSpeed'});
      defaultSpeed=speed;const scan=()=>document.querySelectorAll('video,audio').forEach(media=>{if(!speedListeners.has(media)){const apply=()=>{media.playbackRate=defaultSpeed;};speedListeners.set(media,apply);media.addEventListener('loadedmetadata',apply);apply();}});
      mediaObserver?.disconnect();mediaObserver=new MutationObserver(scan);mediaObserver.observe(document.documentElement,{childList:true,subtree:true});scan();for(const media of document.querySelectorAll('video,audio'))media.playbackRate=defaultSpeed;return Promise.resolve({speed});
    }
    const v = video(cmd.action);
    if (!v) return Promise.resolve({error: 'noVideo'});
    if(cmd.action==='captionPrepare'){captionsClosed=false;return Promise.resolve(globalThis.AionYouTubeCaptions?.prepare(v) || {provider:'texttrack'});}
    if (cmd.action === 'captureStop') {
      if (capturedTrack && capturedTrack.mode === 'hidden') capturedTrack.mode = capturedMode;
      capturedTrack = null;
      return Promise.resolve({stopped: true});
    }
    if (cmd.action === 'captionSources') return Promise.resolve({tracks:[...v.textTracks].filter(track=>track.label!=='Aion').map((track,id)=>({id,label:track.label,language:track.language})),local:localCaptionSource?.video===v && !!localCaptionSource.cues.length});
    if (['captionNavigate', 'captionCurrent', 'captionLoop'].includes(cmd.action)) {
      const tracks = [...v.textTracks].filter(track => track.label !== 'Aion');
      const selected = Number.isInteger(cmd.track) ? tracks[cmd.track] : tracks.find(track => track.mode === 'showing') || (tracks.includes(capturedTrack) ? capturedTrack : undefined) || tracks[0];
      const local = cmd.track === 'local';
      if(!local && !selected && globalThis.AionYouTubeCaptions?.supports(v)) {
        if(cmd.action==='captionCurrent')return Promise.resolve({text:globalThis.AionYouTubeCaptions.read(v).cues[0]?.text || ''});
        return Promise.resolve({error:'captionSeekUnavailable'});
      }
      if (local ? localCaptionSource?.video !== v || !localCaptionSource.cues.length : !selected) return Promise.resolve({error:'noCaptions'});
      const previousMode = local ? undefined : selected.mode;
      if (previousMode === 'disabled') selected.mode = 'hidden';
      const offset = Number.isFinite(cmd.style?.offset) ? Math.max(-10, Math.min(10, cmd.style.offset)) : 0;
      const source = local ? localCaptionSource.cues : [...(selected.cues || [])].map(c=>({start:c.startTime,end:c.endTime,text:c.text}));
      const cues = source.filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start)
        .map(c => ({start:Math.max(0,c.start + offset),end:c.end + offset,text:String(c.text || '').replace(/<[^>]*>/g,'').slice(0,2000)})).filter(c => c.end > c.start);
      if (previousMode === 'disabled') selected.mode = previousMode;
      const active = cues.findIndex(c => c.start <= v.currentTime && v.currentTime < c.end);
      if (cmd.action === 'captionCurrent') return Promise.resolve({text:active < 0 ? '' : cues[active].text});
      if (cmd.action !== 'captionLoop' && !['previous','repeat','next'].includes(cmd.direction)) return Promise.resolve({error:'invalidCaptions'});
      let index;
      if (cmd.action === 'captionLoop') index = active >= 0 ? active : cues.findLastIndex(c => c.start <= v.currentTime);
      else if (cmd.direction === 'next') index = cues.findIndex(c => c.start > v.currentTime + .001);
      else if (cmd.direction === 'previous') index = active >= 0 ? active - 1 : cues.findLastIndex(c => c.start < v.currentTime);
      else index = active >= 0 ? active : cues.findLastIndex(c => c.start <= v.currentTime);
      if (index < 0 || index >= cues.length) return Promise.resolve({error:'captionBoundary'});
      const cue = cues[index];
      if (!Number.isFinite(v.duration) || cue.start >= v.duration) return Promise.resolve({error:'captionSeekUnavailable'});
      stopLoop?.();
      try {v.currentTime = cue.start;} catch {return Promise.resolve({error:'captionSeekUnavailable'});}
      if (cmd.action === 'captionLoop') {
        const end = Math.min(cue.end, v.duration);
        const previousLoop = v.loop;v.loop=false;
        const rewind = () => {v.currentTime=cue.start;};
        const update = () => {
          if (!v.isConnected) {stopLoop?.();return;}
          if (!v.paused && !v.seeking && v.currentTime >= end) rewind();
        };
        const seeking = () => {if (v.currentTime < cue.start || v.currentTime >= end) stopLoop?.();};
        const ended = () => {rewind();v.play().catch(()=>stopLoop?.());};
        v.addEventListener('timeupdate',update);v.addEventListener('seeking',seeking);v.addEventListener('ended',ended);
        const pagehide = () => stopLoop?.();window.addEventListener('pagehide',pagehide,{once:true});
        stopLoop = () => {
          v.removeEventListener('timeupdate',update);v.removeEventListener('seeking',seeking);v.removeEventListener('ended',ended);
          window.removeEventListener('pagehide',pagehide);stopLoop=undefined;
          if(!v.loop)v.loop=previousLoop;
        };
      }
      let playing;
      try {playing = v.play();} catch {return Promise.resolve({time:cue.start,text:cue.text,playing:false});}
      return Promise.resolve(playing).then(() => ({time:cue.start,text:cue.text,playing:true}), () => ({time:cue.start,text:cue.text,playing:false}));
    }
    if (cmd.action === 'captionWindow') {
      if(captionsClosed)return Promise.resolve({closed:true,cues:[],tracks:[]});
      const tracks = [...v.textTracks].filter(track => track.label !== 'Aion');
      const selected = Number.isInteger(cmd.track) ? tracks[cmd.track] : tracks.find(track => track.mode === 'showing') || tracks[0];
      if (selected && capturedTrack !== selected) {
        if (capturedTrack && capturedTrack.mode === 'hidden') capturedTrack.mode = capturedMode;
        capturedTrack = selected; capturedMode = selected.mode;
        if (selected.mode === 'disabled') selected.mode = 'hidden';
      }
      const cues = [...(selected?.cues || [])].filter(cue => cue.endTime > v.currentTime && cue.startTime < v.currentTime + 20).slice(0, 4)
        .map(cue => ({start: cue.startTime, end: cue.endTime, text: String(cue.text || '').replace(/<[^>]*>/g, '').slice(0, 2000)}));
      if(!cues.length){const youtube=globalThis.AionYouTubeCaptions?.read(v);if(youtube)return Promise.resolve(youtube);}
      return Promise.resolve({time: v.currentTime, language: selected?.language || '', cues,
        tracks: tracks.map(track => ({label: track.label, language: track.language}))});
    }
    if (cmd.action === 'speed') {
      const speed = Number(cmd.value);
      if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) return Promise.resolve({error: 'invalidSpeed'});
      for(const media of document.querySelectorAll('video,audio'))media.playbackRate=speed;
      if (Math.abs(v.playbackRate - speed) > 0.001) return Promise.resolve({error: 'unsupportedSpeed'});
    } else if (cmd.action === 'quality') {
      const allowed = ['auto', 'best', 'hd720', 'hd1080', 'hd1440', 'hd2160'];
      if (!allowed.includes(cmd.value)) return Promise.resolve({error: 'unsupportedQuality'});
      if (!/(^|\.)youtube\.com$/.test(location.hostname)) return Promise.resolve({error: 'unsupportedQuality'});
      const player = document.getElementById('movie_player')?.wrappedJSObject;
      if (!player || typeof player.setPlaybackQualityRange !== 'function' || typeof player.getAvailableQualityLevels !== 'function') return Promise.resolve({error: 'unsupportedQuality'});
      const levels = Array.from(player.getAvailableQualityLevels());
      const order = ['highres', 'hd2880', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
      const requested = cmd.value === 'best' ? order.find(level => levels.includes(level)) : cmd.value;
      if (!requested || (requested !== 'auto' && !levels.includes(requested))) return Promise.resolve({error: 'unavailableQuality'});
      player.setPlaybackQualityRange(requested, requested);
      return Promise.resolve({requested, width: v.videoWidth, height: v.videoHeight});
    } else if (cmd.action === 'captions') {
      const youtube=globalThis.AionYouTubeCaptions?.read(v);if(youtube)return Promise.resolve({text:youtube.cues.map(c=>c.text).join('\n')});
      const cues = [...v.textTracks].flatMap(t => [...(t.activeCues || [])]).map(c => c.text || '').filter(Boolean);
      return Promise.resolve({text: cues.join('\n').slice(0, 5000)});
    } else if (cmd.action === 'overlay') {
      if (!Array.isArray(cmd.original) || !Array.isArray(cmd.translated)) return Promise.resolve({error: 'invalidCaptions'});
      showOverlay(v, cmd.original, cmd.translated, cmd.language, cmd.style, Array.isArray(cmd.study) ? cmd.study : cmd.original,cmd.studyUI,cmd.studyToken,cmd.studyRevision);
    } else if (cmd.action === 'closeOverlay') {if (stopOverlay) stopOverlay();}
    return Promise.resolve({speed: v.playbackRate, width: v.videoWidth || 0, height: v.videoHeight || 0, paused:v.paused, area:v.clientWidth*v.clientHeight, kind:v.tagName.toLowerCase()});
  });
})();
