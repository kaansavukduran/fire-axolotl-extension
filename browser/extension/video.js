/* SPDX-License-Identifier: MPL-2.0 */
(() => {
  'use strict';
  if (globalThis.__aionVideoInstalled) return;
  globalThis.__aionVideoInstalled = true;
  let overlay, stopOverlay, capturedTrack, capturedMode, defaultSpeed, mediaObserver;
  const speedListeners=new Map();
  function video(action) {
    const videos = [...document.querySelectorAll('video')].filter(v => v.getBoundingClientRect().width > 0);
    if (!videos.length && ['speed','info','setDefaultSpeed','clearDefaultSpeed'].includes(action)) return [...document.querySelectorAll('audio')].sort((a,b)=>Number(a.paused)-Number(b.paused))[0];
    return videos.sort((a, b) => Number(b === document.pictureInPictureElement) - Number(a === document.pictureInPictureElement) || Number(!b.paused) - Number(!a.paused) || b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  }
  function showOverlay(v, original, translated, language, preferences = {}) {
    const offset = Number.isFinite(preferences.offset) ? Math.max(-10, Math.min(10, preferences.offset)) : 0;
    // Shift both tracks together; keep the caller's source/export timestamps intact.
    const shift = cues => cues.filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start)
      .map(c => ({...c, start: Math.max(0, c.start + offset), end: c.end + offset})).filter(c => c.end > c.start);
    original = shift(original); translated = shift(translated);
    const size = Number.isFinite(preferences.size) ? Math.max(16, Math.min(48, preferences.size)) : 24;
    const opacity = Number.isFinite(preferences.opacity) ? Math.max(0, Math.min(100, preferences.opacity)) / 100 : .9;
    const color = /^#[0-9a-f]{6}$/i.test(preferences.color) ? preferences.color : '#ffffff';
    const secondaryColor = /^#[0-9a-f]{6}$/i.test(preferences.translationColor) ? preferences.translationColor : '#85e7ff';
    const top = preferences.position === 'top';
    const font = {opendyslexic: 'AionOpenDyslexic', lexend: 'AionLexend'}[preferences.font] || 'system-ui';
    if (stopOverlay) stopOverlay();
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
    const nativeStyle = document.createElement('style');
    nativeStyle.textContent = fontRules + `video::cue(#aion-native){font-size:${size}px;color:${color};background-color:rgba(6,21,47,${opacity})}video::cue(#aion-native-translated){font-size:${size}px;color:${secondaryColor};background-color:rgba(6,21,47,${opacity})}`;
    (document.head || document.documentElement).append(nativeStyle);
    const section = document.createElement('section');
    const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', language === 'en' ? 'Close subtitles' : 'Altyazıyı kapat');
    const first = document.createElement('p'), second = document.createElement('p');
    section.append(close, first, second); shadow.append(style, section);
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
    for (const [cues, line, id] of [[original, top ? 8 : translated.length ? 78 : 88, 'aion-native'], [translated, top ? 18 : 88, 'aion-native-translated']]) {
      for (const item of cues) {
        if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.end <= item.start) continue;
        const cue = new VTTCue(item.start, item.end, escapeCue(item.text));
        cue.id = id; cue.snapToLines = false; cue.line = line; cue.align = 'center';
        nativeTrack.addCue(cue);
      }
    }
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
      section.hidden = (!first.textContent && !second.textContent) || rect.bottom < 0 || rect.top > innerHeight;
      const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
      overlay.style.left = left + 'px'; overlay.style.width = Math.max(0, right - left) + 'px';
      const height = overlay.getBoundingClientRect().height;
      overlay.style.top = Math.max(0, Math.min(innerHeight - height, top ? rect.top + 12 : rect.bottom - height - 12)) + 'px';
    }
    const timer = setInterval(update, 150); update();
    document.addEventListener('fullscreenchange', move);
    const onPageHide = () => stopOverlay?.();
    stopOverlay = () => {
      clearInterval(timer);
      document.removeEventListener('fullscreenchange', move);
      window.removeEventListener('pagehide', onPageHide);
      nativeTrack.mode = 'disabled'; nativeElement.remove(); nativeStyle.remove();
      previousTracks.forEach(track => {if (track.mode === 'hidden') track.mode = 'showing';});
      overlay.remove(); stopOverlay = null;
    };
    close.onclick = () => stopOverlay?.();
    window.addEventListener('pagehide', onPageHide, {once: true});
  }
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || message.type !== 'aionVideo') return undefined;
    const cmd = message.command || {};
    if(cmd.action==='closeOverlay'){stopOverlay?.();return Promise.resolve({stopped:true});}
    if(cmd.action==='captureStop'&&!video('info')){if(capturedTrack&&capturedTrack.mode==='hidden')capturedTrack.mode=capturedMode;capturedTrack=null;return Promise.resolve({stopped:true});}
    if(cmd.action==='clearDefaultSpeed'){mediaObserver?.disconnect();mediaObserver=null;for(const [media,listener] of speedListeners)media.removeEventListener('loadedmetadata',listener);speedListeners.clear();defaultSpeed=undefined;return Promise.resolve({stopped:true});}
    if(cmd.action==='setDefaultSpeed'){
      const speed=Number(cmd.value);if(!Number.isFinite(speed)||speed<.25||speed>4)return Promise.resolve({error:'invalidSpeed'});
      defaultSpeed=speed;const scan=()=>document.querySelectorAll('video,audio').forEach(media=>{if(!speedListeners.has(media)){const apply=()=>{media.playbackRate=defaultSpeed;};speedListeners.set(media,apply);media.addEventListener('loadedmetadata',apply);apply();}});
      mediaObserver?.disconnect();mediaObserver=new MutationObserver(scan);mediaObserver.observe(document.documentElement,{childList:true,subtree:true});scan();for(const media of document.querySelectorAll('video,audio'))media.playbackRate=defaultSpeed;return Promise.resolve({speed});
    }
    const v = video(cmd.action);
    if (!v) return Promise.resolve({error: 'noVideo'});
    if (cmd.action === 'captureStop') {
      if (capturedTrack && capturedTrack.mode === 'hidden') capturedTrack.mode = capturedMode;
      capturedTrack = null;
      return Promise.resolve({stopped: true});
    }
    if (cmd.action === 'captionWindow') {
      const tracks = [...v.textTracks].filter(track => track.label !== 'Aion');
      const selected = Number.isInteger(cmd.track) ? tracks[cmd.track] : tracks.find(track => track.mode === 'showing') || tracks[0];
      if (selected && capturedTrack !== selected) {
        if (capturedTrack && capturedTrack.mode === 'hidden') capturedTrack.mode = capturedMode;
        capturedTrack = selected; capturedMode = selected.mode;
        if (selected.mode === 'disabled') selected.mode = 'hidden';
      }
      const cues = [...(selected?.cues || [])].filter(cue => cue.endTime > v.currentTime && cue.startTime < v.currentTime + 20).slice(0, 4)
        .map(cue => ({start: cue.startTime, end: cue.endTime, text: String(cue.text || '').replace(/<[^>]*>/g, '').slice(0, 2000)}));
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
      const cues = [...v.textTracks].flatMap(t => [...(t.activeCues || [])]).map(c => c.text || '').filter(Boolean);
      return Promise.resolve({text: cues.join('\n').slice(0, 5000)});
    } else if (cmd.action === 'overlay') {
      if (!Array.isArray(cmd.original) || !Array.isArray(cmd.translated)) return Promise.resolve({error: 'invalidCaptions'});
      showOverlay(v, cmd.original, cmd.translated, cmd.language, cmd.style);
    } else if (cmd.action === 'closeOverlay') {if (stopOverlay) stopOverlay();}
    return Promise.resolve({speed: v.playbackRate, width: v.videoWidth || 0, height: v.videoHeight || 0, paused:v.paused, area:v.clientWidth*v.clientHeight, kind:v.tagName.toLowerCase()});
  });
})();
