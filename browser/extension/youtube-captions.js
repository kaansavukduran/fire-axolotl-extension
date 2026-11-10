/* SPDX-License-Identifier: MPL-2.0 */
// Read only captions already exposed by the current YouTube player. No remote
// transcript endpoint, audio capture or account credentials.
(() => {
  'use strict';
  if (globalThis.AionYouTubeCaptions) return;
  let observed, text='', sequence=0, start=0, changed=0, lastTime=0, source='', sourceLanguage='', coverStyle, covered;
  const marker=crypto.randomUUID();
  const playerFor=v=>v?.closest('.html5-video-player') || (document.getElementById('movie_player')?.contains(v)?document.getElementById('movie_player'):null);
  const supports=v=>/(^|\.)youtube\.com$/.test(location.hostname) && !!playerFor(v);
  const pageKey=()=>{const url=new URL(location.href);return url.origin+url.pathname+'?v='+(url.searchParams.get('v') || '');};
  function language(player) {
    try {
      const code=player.wrappedJSObject?.getOption?.('captions','track')?.languageCode;
      if(typeof code==='string' && /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(code))return code;
    } catch {/* Language can always be chosen explicitly in Aion. */}
    return '';
  }
  function uncover() {
    coverStyle?.remove();coverStyle=undefined;
    if(covered?.getAttribute('data-aion-caption-cover')===marker)covered.removeAttribute('data-aion-caption-cover');
    covered=undefined;
  }
  function cover(v) {
    if(!supports(v))return;
    const player=playerFor(v);if(covered===player && coverStyle?.isConnected)return;
    uncover();covered=player;player.setAttribute('data-aion-caption-cover',marker);
    coverStyle=document.createElement('style');
    coverStyle.textContent=`[data-aion-caption-cover="${marker}"] .ytp-caption-window-container{opacity:0!important;pointer-events:none!important}`;
    (document.head || document.documentElement).append(coverStyle);
  }
  function read(v) {
    if(!supports(v))return null;
    const player=playerFor(v),button=player.querySelector('.ytp-subtitles-button'),key=pageKey(),code=language(player);
    const result={provider:'youtube',pageKey:key,language:code,tracks:[],cues:[],stable:false};
    if(observed!==v || source!==key || sourceLanguage!==code || v.currentTime<lastTime-.1 || Math.abs(v.currentTime-lastTime)>3) {text='';sequence++;observed=v;source=key;sourceLanguage=code;}
    lastTime=v.currentTime;
    const container=player.querySelector('.ytp-caption-window-container');
    const enabled=button?.getAttribute('aria-pressed')!=='false';
    let next='';
    if(enabled && container && !player.classList.contains('ad-showing') && !player.classList.contains('ad-interrupting')) {
      const visible=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';};
      if(visible(container) && (covered===player || Number(getComputedStyle(container).opacity)>0)) {
        const lines=[...container.querySelectorAll('.caption-visual-line')].filter(visible);
        const segments=lines.length?lines:[...container.querySelectorAll('.ytp-caption-segment')].filter(visible);
        next=segments.map(node=>node.textContent.trim()).filter(Boolean).join(lines.length?'\n':' ').replace(/\u200b/g,'').slice(0,2000);
      }
    }
    if(next!==text){text=next;sequence++;start=v.currentTime;changed=performance.now();}
    result.captionsEnabled=enabled;result.sourceId=sequence;result.stable=performance.now()-changed>=350;
    if(text)result.cues=[{start:Math.max(0,start),end:Math.max(start+.1,v.currentTime+2.5),text}];
    return result;
  }
  function prepare(v) {
    if(!supports(v))return null;
    const button=playerFor(v).querySelector('.ytp-subtitles-button');
    if(!button || button.disabled || button.getAttribute('aria-disabled')==='true' || getComputedStyle(button).display==='none')return {error:'youtubeCaptionsUnavailable'};
    if(button.getAttribute('aria-pressed')==='false')button.click();
    text='';observed=undefined;return read(v);
  }
  function stop(){uncover();observed=undefined;text='';source='';sourceLanguage='';sequence++;}
  globalThis.AionYouTubeCaptions={supports,prepare,read,cover,uncover,stop};
})();
