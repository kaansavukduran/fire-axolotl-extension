/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
const $ = id => document.getElementById(id);
const send = message => browser.runtime.sendMessage(message);
let page=0,busy=false,undoToken,backup,downloadURL,importResult;
const pageSize=50;
function number(value) {return new Intl.NumberFormat(UI.locale).format(value);}
function render() {
  document.title=`Fire Axolotl · ${UI.t('wordbook')}`;
  const focus=document.activeElement?.dataset.word;
  const fold=value=>value.normalize('NFC').toLocaleLowerCase(UI.locale);
  const query=fold($('word-search').value.trim());
  const words=[...UI.settings.vocabulary].reverse().filter(word=>fold(word).includes(query));
  const pages=Math.max(1,Math.ceil(words.length/pageSize));page=Math.max(0,Math.min(page,pages-1));
  $('words-count').textContent=`${UI.t('wordMatches')}: ${number(words.length)} / ${number(UI.settings.vocabulary.length)} · ${UI.t('wordCapacity')}: ${number(5000)}`;
  $('words-empty').hidden=!!words.length;
  $('words-empty').textContent=UI.t(query?'wordNoMatches':'wordbookEmpty');
  $('words').replaceChildren(...words.slice(page*pageSize,(page+1)*pageSize).map(word=>{
    const li=document.createElement('li'),text=document.createElement('p'),remove=document.createElement('button');
    text.textContent=word;remove.type='button';remove.className='secondary';remove.textContent=UI.t('wordRemove');remove.dataset.word=word;
    remove.setAttribute('aria-label',`${UI.t('wordRemove')}: ${word}`);remove.disabled=busy;
    remove.onclick=()=>run(async()=>{
      const response=await send({type:'wordbook',action:'remove',word});undoToken=response.token;await reload();UI.status('wordRemoved');
      return 'word-undo';
    });li.append(text,remove);return li;
  }));
  if(focus)[...$('words').querySelectorAll('button')].find(button=>button.dataset.word===focus)?.focus({preventScroll:true});
  $('word-page').textContent=`${number(page+1)} / ${number(pages)}`;
  $('word-previous').disabled=busy || page===0;$('word-next').disabled=busy || page===pages-1;
  $('word-undo').disabled=busy || !undoToken;
  const disabled=UI.settings.disabledModules.includes('translation');$('word-disabled').hidden=!disabled;
  $('word-add').disabled=busy || disabled;
  for(const id of ['word-export','word-import','word-import-cancel'])$(id).disabled=busy;
  $('word-import-apply').disabled=busy || !backup;
  $('word-preview').hidden=!backup;
  if(backup) {
    $('word-preview-count').textContent=`${number(backup.words.length)} ${UI.t('savedWords')}`;
    $('word-preview-list').replaceChildren(...backup.words.slice(0,5).map(word=>{const li=document.createElement('li');li.textContent=word;return li;}));
  }
  if(importResult)$('word-import-result').textContent=`${UI.t('wordImportAdded')}: ${number(importResult.added)} · ${UI.t('wordImportSkipped')}: ${number(importResult.duplicates)} · ${UI.t('wordTotal')}: ${number(importResult.total)}`;
}
async function reload() {await UI.apply(await send({type:'settings'}));render();}
function run(fn) {
  if(busy)return;
  busy=true;render();UI.status('wordWorking');
  return UI.run(async()=>{let focus;try {focus=await fn();}finally {busy=false;render();if(focus)$(focus).focus();}});
}
function clearPreview() {backup=undefined;$('word-import').value='';render();}
(async()=>{
  await UI.init();render();document.addEventListener('aion-settings',render);
  $('open-settings').onclick=()=>UI.run(()=>browser.runtime.openOptionsPage());
  $('word-search').oninput=()=>{page=0;render();};
  $('word-previous').onclick=()=>{page--;render();};$('word-next').onclick=()=>{page++;render();};
  $('word-form').onsubmit=event=>{event.preventDefault();run(async()=>{
    const text=$('word-input').value;await send({type:'word',word:text});
    // A later edit made while the request was pending must stay in the form.
    if($('word-input').value===text)$('word-input').value='';await reload();UI.status('wordSaved');
  });};
  $('word-undo').onclick=()=>run(async()=>{
    try {await send({type:'wordbook',action:'undo',token:undoToken});}
    catch(error) {if(String(error.message).includes('wordUndoExpired'))undoToken=undefined;throw error;}
    undoToken=undefined;await reload();UI.status('wordRestored');return 'word-search';
  });
  $('word-import').onchange=()=>run(async()=>{
    const file=$('word-import').files[0];backup=undefined;importResult=undefined;$('word-import-result').textContent='';render();if(!file)return;
    if(file.size>12*1024*1024)throw new Error('wordFileTooLarge');
    let data;try{data=JSON.parse((await file.text()).replace(/^\uFEFF/,''));}catch{throw new Error('invalidWordBackup');}
    Aion.wordBackup(data);backup={format:'fire-axolotl-vocabulary',version:1,words:data.words};render();UI.status('wordImportReady');
  });
  $('word-import-cancel').onclick=clearPreview;
  $('word-import-apply').onclick=()=>run(async()=>{
    const result=await send({type:'wordbook',action:'import',backup});importResult=result;clearPreview();await reload();UI.status('wordImported');return 'word-search';
  });
  $('word-export').onclick=()=>run(async()=>{
    const settings=await send({type:'settings'});
    if(downloadURL)URL.revokeObjectURL(downloadURL);
    const data={format:'fire-axolotl-vocabulary',version:1,words:settings.vocabulary};
    downloadURL=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    $('word-download').href=downloadURL;$('word-download').hidden=false;$('word-download').click();UI.status('exported');
  });
  window.addEventListener('pagehide',()=>{if(downloadURL)URL.revokeObjectURL(downloadURL);},{once:true});
  document.body.inert=false;document.body.removeAttribute('aria-busy');document.body.dataset.ready='true';
})().catch(()=>{document.body.inert=false;document.body.removeAttribute('aria-busy');UI.status('operationFailed',true);});
