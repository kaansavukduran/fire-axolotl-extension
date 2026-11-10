/* SPDX-License-Identifier: MPL-2.0 */
globalThis.AionMedia = (() => {
  const touched = new Set();
  const queues = new Map();
  function command(tabId, action, valid = () => true) {
    const result = (queues.get(tabId) || Promise.resolve()).then(()=>performCommand(tabId,action,valid));
    const tail = result.catch(()=>{});
    queues.set(tabId,tail);
    tail.then(()=>{if(queues.get(tabId)===tail)queues.delete(tabId);});
    return result;
  }
  async function performCommand(tabId, command, valid) {
    if (!valid()) return {stale:true};
    const tab = await browser.tabs.get(tabId);
    if (!Aion.webURL(tab.url)) throw new Error('restrictedPage');
    await browser.tabs.executeScript(tabId, {file:'/aion/youtube-captions.js',allFrames:true}).catch(()=>{});
    await browser.tabs.executeScript(tabId, {file:'/aion/video.js',allFrames:true}).catch(()=>{});
    const frames = (await browser.webNavigation.getAllFrames({tabId})).map(frame=>frame.frameId);
    const send = (frameId, action) => browser.tabs.sendMessage(tabId,{type:'aionVideo',command:action},{frameId});
    const probes = await Promise.allSettled(frames.map(async frameId=>({frameId,info:await send(frameId,{action:'info'})})));
    const media = probes.filter(item=>item.status==='fulfilled' && !item.value.info.error).map(item=>item.value);
    if (!valid()) return {stale:true};
    touched.add(tabId);
    if (['closeOverlay','captureStop','clearDefaultSpeed','captionLoopStop'].includes(command.action)) {
      if (command.action === 'closeOverlay') AionCaptionStudy.revoke(tabId);
      await Promise.allSettled(frames.map(frame=>send(frame,command)));return {stopped:true};
    }
    if(command.action==='setDefaultSpeed'){const results=await Promise.allSettled(frames.map(frame=>send(frame,command)));if(results.some(item=>item.status==='fulfilled'&&!item.value.error))return {speed:command.value};throw new Error('noVideo');}
    if (!media.length) throw new Error('noVideo');
    media.sort((a,b)=>Number(b.info.kind==='video')-Number(a.info.kind==='video')||Number(a.info.paused)-Number(b.info.paused)||(b.info.area||0)-(a.info.area||0));
    if (['speed','quality','setDefaultSpeed'].includes(command.action)) {
      const results=await Promise.allSettled(media.map(frame=>send(frame.frameId,command)));
      const success=results.find(item=>item.status==='fulfilled'&&!item.value.error);
      if (!success) throw new Error(results.find(item=>item.status==='fulfilled')?.value.error||'operationFailed');
      return success.value;
    }
    const chosen = media[0].frameId;
    if (command.action === 'overlay') {
      const frame = (await browser.webNavigation.getAllFrames({tabId})).find(item=>item.frameId === chosen);
      if (!valid()) return {stale:true};
      if (!frame || !Aion.webURL(frame.url)) throw new Error('restrictedPage');
      const access=AionCaptionStudy.grant(tabId,frame,command.study || command.original);
      command = {...command,studyToken:access.token,studyRevision:access.revision};
    }
    return send(chosen,command);
  }
  async function remember(tabId,speed) {
    const tab=await browser.tabs.get(tabId);if(!Aion.webURL(tab.url))throw new Error('restrictedPage');
    await serial(async()=>{
      const {aionMediaSites:rules={}}=await browser.storage.local.get('aionMediaSites');
      const origin=new URL(tab.url).origin;
      if(speed===null)delete rules[origin];else rules[origin]=Math.max(.25,Math.min(4,Number(speed)));
      if(Object.keys(rules).length>200)throw new Error('siteRuleLimit');
      await browser.storage.local.set({aionMediaSites:rules});
    });
  }
  browser.tabs.onUpdated.addListener(async(tabId,change,tab)=>{
    if(change.status!=='complete'||!Aion.webURL(tab.url)||(await readSettings()).disabledModules.includes('video'))return;
    const {aionMediaSites:rules={}}=await browser.storage.local.get('aionMediaSites');
    const speed=rules[new URL(tab.url).origin];
    if(Number.isFinite(speed))command(tabId,{action:'setDefaultSpeed',value:speed}).catch(()=>{});
  });
  browser.tabs.onRemoved.addListener(tabId=>touched.delete(tabId));
  browser.commands.onCommand.addListener(async name=>{
    if(!['aion-speed-up','aion-speed-down','aion-speed-reset'].includes(name)||(await readSettings()).disabledModules.includes('video'))return;
    try{const tab=await activeTab();const info=await command(tab.id,{action:'info'});await command(tab.id,{action:'speed',value:name==='aion-speed-reset'?1:Math.max(.25,Math.min(4,info.speed+(name==='aion-speed-up' ? .25 : -.25)))});}catch{/* Protected/no-media tabs stay unchanged. */}
  });
  return {command,remember,clearAll:()=>Promise.allSettled([...touched].map(async tabId=>{for(const action of ['closeOverlay','captureStop','clearDefaultSpeed'])await command(tabId,{action});}))};
})();
