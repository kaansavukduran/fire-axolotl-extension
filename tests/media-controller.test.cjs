// SPDX-License-Identifier: MPL-2.0
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture() {
  const calls=[];let finish;
  const event={addListener:()=>{}};
  const browser={tabs:{get:async id=>({id,url:'https://example.org/'}),executeScript:async()=>{},onUpdated:event,onRemoved:event,
    sendMessage:async(id,{command})=>{
      if(command.action==='info')return {kind:'video',paused:false,area:100};
      calls.push([id,command.action]);
      if(command.action==='captionLoop')return new Promise((resolve,reject)=>{finish={resolve,reject};});
      return {stopped:true};
    }},webNavigation:{getAllFrames:async()=>[{frameId:0}]},commands:{onCommand:event}};
  const context=vm.createContext({browser,Aion:{webURL:()=>true},URL});
  vm.runInContext(fs.readFileSync('browser/extension/media-controller.js','utf8'),context);
  return {media:context.AionMedia,calls,finish:()=>finish};
}
test('cleanup waits for an in-flight media command in its tab while another tab stays usable',async()=>{
  const f=fixture();const starting=f.media.command(1,{action:'captionLoop'});await turn();
  const stopping=f.media.command(1,{action:'captionLoopStop'});
  await f.media.command(2,{action:'captionLoopStop'});
  assert.deepEqual(f.calls,[[1,'captionLoop'],[2,'captionLoopStop']]);
  f.finish().resolve({playing:true});await starting;await stopping;
  assert.deepEqual(f.calls,[[1,'captionLoop'],[2,'captionLoopStop'],[1,'captionLoopStop']]);
});
test('a failed media command does not prevent its queued cleanup or later controls',async()=>{
  const f=fixture();const failure=assert.rejects(f.media.command(1,{action:'captionLoop'}),/player failed/);await turn();
  const stopping=f.media.command(1,{action:'captionLoopStop'});f.finish().reject(new Error('player failed'));
  await failure;await stopping;await f.media.command(1,{action:'closeOverlay'});
  assert.deepEqual(f.calls,[[1,'captionLoop'],[1,'captionLoopStop'],[1,'closeOverlay']]);
});
