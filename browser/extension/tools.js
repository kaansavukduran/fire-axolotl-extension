/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
const $ = id => document.getElementById(id);
async function refreshTabs() {
  const previous = $('target-tab').value;
  const tabs = (await browser.tabs.query({currentWindow: true})).filter(tab => Aion.webURL(tab.url));
  tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
  $('target-tab').replaceChildren(...tabs.map(tab => {
    const option = document.createElement('option'); option.value = tab.id;
    option.textContent = tab.title || tab.url; return option;
  }));
  if (tabs.some(tab => String(tab.id) === previous)) $('target-tab').value = previous;
}
async function target() {
  if (!$('target-tab').value) throw new Error('restrictedPage');
  const tab = await browser.tabs.get(Number($('target-tab').value));
  if (!Aion.webURL(tab.url)) throw new Error('restrictedPage');
  return tab;
}
function action(id, fn) {$(id).addEventListener('click', () => UI.run(fn));}
(async () => {
  await UI.init(); await refreshTabs();
  action('refresh-tabs', refreshTabs);
  async function style(mode,reset=false,fontOnly=false){const tab=await target();await browser.runtime.sendMessage({type:'siteStyle',tabId:tab.id,mode:fontOnly?undefined:mode,font:reset?'original':fontOnly?$('site-font').value:undefined,remember:$('remember-style').checked,reset});UI.status('applied');}
  action('page-dark',()=>style('dark'));
  action('page-light',()=>style('light'));
  action('page-original',()=>style('default',true));
  action('apply-site-font',()=>style(undefined,false,true));
  action('qr-tab', async () => {$('qr-text').value = (await target()).url;});
  action('qr-create', () => {
    const text = $('qr-text').value;
    if (!text.trim() || text.length > 1000) throw new Error('textRequired');
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const url = qr.createDataURL(5, 20);
    $('qr-image').src = url; $('qr-image').hidden = false;
    $('qr-download').href = url; $('qr-download').hidden = false;
    $('qr-caption').textContent = text; UI.status('applied');
  });
  $('settings').onclick = () => browser.runtime.openOptionsPage();
})().catch(() => UI.status('operationFailed', true));
