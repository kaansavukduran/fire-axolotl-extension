/* SPDX-License-Identifier: MPL-2.0 */
// The background page owns this session. Closing the toolbar popup is harmless.
globalThis.AionAutoCaptions = (() => {
  let settings, signature, session, latestReconcile, generation=0, settingsRevision=0, running=false, pending=false, lastProbe=0;
  let state={enabled:false,key:'autoCaptionOff',title:''};
  const cache=new Map();
  const status=()=>({...state});
  function report(key,title=session?.title || '') {
    state={enabled:!!settings?.autoCaptions,key,title};
  }
  const valid=s=>session===s && s.generation===generation && settings?.autoCaptions;
  async function media(s,command) {
    const result=await AionMedia.command(s.id,command,()=>valid(s));
    if(result.error)throw new Error(result.error);
    return result;
  }
  function reset() {
    const old=session;session=undefined;generation++;
    if(old) {
      // Queued cleanup runs before a subsequent session can paint in this tab.
      AionMedia.command(old.id,{action:'closeOverlay'}).catch(()=>{});
      AionMedia.command(old.id,{action:'captureStop'}).catch(()=>{});
    }
    lastProbe=0;
  }
  function reconcile() {
    const revision=++settingsRevision;
    const work=(async()=>{
      const next=await readSettings();
      // A storage event can overtake the explicit toggle's refresh. All callers
      // must await the newest refresh instead of returning the old checked state.
      if(revision!==settingsRevision)return latestReconcile;
      const nextSignature=JSON.stringify([next.autoCaptions,next.disabledModules,next.aiSource,next.aiTarget,Aion.captionStyle(next),next.captionOriginal,next.captionTranslated,next.language]);
      settings=next;
      if(signature!==nextSignature){signature=nextSignature;reset();report(next.autoCaptions?'autoCaptionWaiting':'autoCaptionOff','');}
      if(next.autoCaptions && next.disabledModules.some(x=>['ai','video','translation'].includes(x)))report('moduleDisabled','');
      return status();
    })();
    latestReconcile=work;
    return work;
  }
  async function set(enabled) {
    if(typeof enabled!=='boolean')throw new Error('unknownAction');
    const prefs=await readSettings();
    if(enabled && prefs.disabledModules.some(x=>['ai','video','translation'].includes(x)))throw new Error('moduleDisabled');
    await writeSettings({autoCaptions:enabled});await reconcile();
    void tick();return status();
  }
  async function discover() {
    // Only visible/recent candidates, not an unbounded scan of browsing history.
    const tabs=(await browser.tabs.query({})).filter(t=>Aion.webURL(t.url));
    tabs.sort((a,b)=>Number(b.active)-Number(a.active)||Number(b.audible)-Number(a.audible)||(b.lastAccessed||0)-(a.lastAccessed||0));
    let paused;
    for(const tab of tabs.slice(0,6)) {
      if(!settings.autoCaptions)return;
      try {
        const info=await AionMedia.command(tab.id,{action:'info'},()=>settings.autoCaptions);
        if(info.error || info.kind!=='video')continue;
        if(tab.id===session?.id && !info.paused)return;
        if(!info.paused){return tab;}
        if(tab.active && !paused)paused=tab;
      }catch{/* Protected pages and tabs without video are skipped. */}
    }
    if(!session)return paused;
  }
  async function paint(s,response) {
    if(!valid(s))return;
    const cues=response.cues || [];
    const key=cue=>JSON.stringify([response.language,settings.aiSource,settings.aiTarget,cue.text]);
    const translated=cues.filter(c=>cache.has(key(c))).map(c=>({...c,text:cache.get(key(c))}));
    await media(s,await decorateMediaCommand({action:'overlay',original:settings.captionOriginal?cues:[],translated:settings.captionTranslated?translated:[],study:cues},settings));
    if(!valid(s))return;
    report(!settings.captionOriginal&&!settings.captionTranslated?'autoCaptionHidden':cues.length?(translated.length || !settings.captionTranslated?'autoCaptionActive':'autoCaptionTranslating'):'autoCaptionNoCaptions');
    const cue=cues.find(c=>!cache.has(key(c)));
    if(!cue || pending || !settings.captionTranslated)return;
    pending=true;
    const source=settings.aiSource==='auto'?(response.language || 'auto'):settings.aiSource,target=settings.aiTarget,cacheKey=key(cue);
    AionLocalAI.call({action:'translate',text:cue.text,source,target}).then(result=>{
      if(!valid(s))return;
      cache.set(cacheKey,result.text);if(cache.size>100)cache.delete(cache.keys().next().value);
      s.error=undefined;
      // The next poll rereads current cues. A late result never paints old text.
    }).catch(error=>{
      if(valid(s)){s.error=error.message==='aiBusy'?'autoCaptionBusy':error.message;report(s.error);}
    }).finally(()=>{pending=false;});
  }
  async function tick() {
    if(running)return;
    running=true;
    try {
      if(!settings)await reconcile();
      if(!settings.autoCaptions || settings.disabledModules.some(x=>['ai','video','translation'].includes(x)))return;
      const token=generation;
      if(Date.now()-lastProbe>3000) {
        lastProbe=Date.now();const tab=await discover();
        if(token!==generation)return;
        if(tab && tab.id!==session?.id){reset();session={id:tab.id,title:tab.title || '',generation};}
      }
      const s=session;
      if(!s){report('autoCaptionWaiting','');return;}
      const tab=await browser.tabs.get(s.id);
      if(!Aion.webURL(tab.url)){reset();report('autoCaptionWaiting','');return;}
      if(s.url!==tab.url){s.url=tab.url;s.prepared=false;s.pageKey=undefined;}
      if(!s.prepared){await media(s,{action:'captionPrepare'});if(!valid(s))return;s.prepared=true;}
      const response=await media(s,{action:'captionWindow'});
      if(!valid(s))return;
      if(response.closed){await set(false);return;}
      // YouTube SPA navigation is followed automatically, without a new checkbox.
      if(s.pageKey && s.pageKey!==response.pageKey){s.prepared=false;}
      s.pageKey=response.pageKey;
      await paint(s,response);
      if(s.error)report(s.error);
    }catch(error){
      if(!settings?.autoCaptions || settings.disabledModules.some(x=>['ai','video','translation'].includes(x)))return;
      report(['noVideo','targetTabMissing'].includes(error.message)?'autoCaptionWaiting':error.message);
      if(error.message==='noVideo'){reset();}
    }finally{running=false;}
  }
  browser.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.settings)reconcile().then(()=>tick()).catch(()=>{});});
  browser.tabs.onActivated.addListener(()=>{lastProbe=0;void tick();});
  browser.tabs.onUpdated.addListener((id,change)=>{if(change.url || change.status==='complete' || change.audible!==undefined){lastProbe=0;if(session?.id===id&&change.status==='loading')reset();}});
  browser.tabs.onRemoved.addListener(id=>{if(session?.id===id){reset();report('autoCaptionWaiting','');}});
  setInterval(()=>{void tick();},500);
  reconcile().then(()=>tick()).catch(()=>{});
  return {status,set,reconcile,owns:id=>session?.id===id,stop:async()=>{if(settings?.autoCaptions)await set(false);}};
})();
