/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
const $ = id => document.getElementById(id);
function renderModules() {
  const focused=document.activeElement?.dataset.layoutKey;
  $('module-list').replaceChildren(...UI.settings.moduleOrder.map((key,index)=>{
    const li=document.createElement('li');li.className='row';
    const label=document.createElement('label');label.className='toggle grow';
    const check=document.createElement('input');check.type='checkbox';check.dataset.module=key;check.dataset.layoutKey=key+'-toggle';check.checked=!UI.settings.disabledModules.includes(key);
    const text=document.createElement('span');text.textContent=UI.t('module-'+key);label.append(check,text);li.append(label);
    check.onchange=()=>UI.run(()=>save({disabledModules:check.checked?UI.settings.disabledModules.filter(v=>v!==key):[...UI.settings.disabledModules,key]}));
    for(const [delta,caption] of [[-1,'moveUp'],[1,'moveDown']]){
      const button=document.createElement('button');button.className='secondary';button.dataset.layoutKey=key+'-'+delta;button.textContent=UI.t(caption);button.setAttribute('aria-label',UI.t(caption)+': '+UI.t('module-'+key));
      button.disabled=index+delta<0||index+delta>=UI.settings.moduleOrder.length;
      button.onclick=()=>UI.run(()=>{const order=[...UI.settings.moduleOrder];[order[index],order[index+delta]]=[order[index+delta],order[index]];return save({moduleOrder:order});});li.append(button);
    }
    return li;
  }));
  if(focused){const next=[...$('module-list').querySelectorAll('[data-layout-key]')].find(node=>node.dataset.layoutKey===focused);(next?.disabled?$('module-list').querySelector('input[data-module="'+focused.split('-')[0]+'"]'):next)?.focus({preventScroll:true});}
}
function render() {
  renderModules();
  for (const element of document.querySelectorAll('[data-setting]')) {
    const value = UI.settings[element.dataset.setting];
    if (element.type === 'checkbox') element.checked = value; else element.value = value;
  }
  for (const key of ['scale', 'textSize']) $(key + '-number').value = UI.settings[key];
  for (const key of ['lineHeight', 'letterSpacing']) $(key + '-value').textContent = new Intl.NumberFormat(UI.locale).format(UI.settings[key]);
  $('endpoint').value = UI.settings.endpoint;
  document.querySelectorAll('[data-scale]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.scale) === UI.settings.scale));
  $('version').textContent = browser.runtime.getManifest().version + ' · ' + UI.t('developmentVersion');
  $('word-count').textContent = `${new Intl.NumberFormat(UI.locale).format(UI.settings.vocabulary.length)} ${UI.t('savedWords')}`;
  $('word-list').replaceChildren(...UI.settings.vocabulary.map(word => {const li = document.createElement('li'); li.textContent = word; return li;}));
}
function action(id, fn) {$(id).addEventListener('click', () => UI.run(fn));}
async function save(patch) {await UI.save(patch); render();}
(async () => {
  await UI.init(); render();
  $('sync-enabled').checked=!!(await browser.storage.local.get('aionSyncEnabled')).aionSyncEnabled;
  $('sync-enabled').onchange=()=>UI.run(()=>browser.storage.local.set({aionSyncEnabled:$('sync-enabled').checked}));
  action('sync-push',async()=>{await browser.runtime.sendMessage({type:'syncPush'});UI.status('syncSaved');});
  action('sync-pull',async()=>{await browser.runtime.sendMessage({type:'syncPull'});UI.status('syncRestored');});
  action('firefox-sync',()=>browser.tabs.create({url:'about:preferences#sync'}));
  action('reset-modules',()=>save({moduleOrder:[...Aion.defaults.moduleOrder]})); document.addEventListener('aion-settings', render);
  action('open-characters', async () => {const opened = browser.sidebarAction.open(); await browser.storage.local.set({aionSidebarCompanions: true}); await opened;});
  for (const element of document.querySelectorAll('[data-setting]')) {
    const update = () => UI.run(() => save({[element.dataset.setting]: element.type === 'checkbox' ? element.checked : ['range', 'number'].includes(element.type) ? Number(element.value) : element.value}));
    element.addEventListener(element.type === 'range' ? 'input' : 'change', update);
  }
  for (const key of ['scale', 'textSize']) $(key + '-number').addEventListener('change', () => UI.run(async () => {
    if (!$(key + '-number').checkValidity()) throw new Error('invalidScale');
    await save({[key]: Number($(key + '-number').value)});
  }));
  document.querySelectorAll('[data-scale]').forEach(button => button.addEventListener('click', () => UI.run(() => save({scale: Number(button.dataset.scale)}))));
  action('reset-scale', () => save({scale: 100})); action('reset-text', () => save({textSize: 100}));
  action('reset-progress', async () => {if (confirm(UI.t('confirmResetProgress'))) await save({milestones: []});});
  action('save-endpoint', async () => {
    const endpoint = Aion.translationEndpoint($('endpoint').value.trim());
    await save({endpoint: endpoint.url});
  });
  action('revoke-endpoint', () => save({endpoint: ''}));
  action('reset-runner', () => browser.storage.local.set({aionRunnerBest: 0}));
  action('open-blocker', () => browser.tabs.create({url: browser.runtime.getURL('dashboard.html')}));
  action('open-firefox', () => browser.tabs.create({url: 'about:preferences'}));
  action('open-ai', () => browser.tabs.create({url: browser.runtime.getURL('aion/ai.html')}));
  action('open-tools', () => browser.tabs.create({url: browser.runtime.getURL('aion/tools.html')}));
  action('export', async () => {
    const local = Aion.localPreferences(await browser.storage.local.get(['aionSiteStyles','aionMediaSites','aionRunnerBest','aionSidebarCompanions','aionDraft']));
    const blob = new Blob([JSON.stringify({format: 'fire-axolotl', version: 1, settings: UI.settings, local}, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'fire-axolotl-settings.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000); UI.status('exported');
  });
  $('import').addEventListener('change', () => UI.run(async () => {
    const file = $('import').files[0]; if (!file) return;
    if (file.size > 3 * 1024 * 1024) throw new Error('fileTooLarge');
    let data; try {data = JSON.parse(await file.text());} catch {throw new Error('invalidBackup');}
    if (data.format !== 'fire-axolotl' || data.version !== 1 || !data.settings || typeof data.settings !== 'object') throw new Error('invalidBackup');
    if (!confirm(UI.t('confirmImport'))) return;
    // Backups never grant network permission or replace a trusted endpoint.
    await save({...Aion.normalize(data.settings), endpoint: UI.settings.endpoint});
    if (data.local && typeof data.local==='object' && !Array.isArray(data.local)) await browser.storage.local.set(Aion.localPreferences(data.local));
    UI.status('imported');
    $('import').value = '';
  }));
  action('check-updates', async () => {
    $('check-updates').disabled = true; $('release-notes').textContent = ''; $('update-result').textContent = UI.t('checkingUpdates');
    try {
      const response = await browser.runtime.sendMessage({type: 'checkUpdates'});
      $('update-result').textContent = response.available ? `${UI.t('latestPublished')}: ${response.version}` : UI.t('noRelease');
      $('release-notes').textContent = response.notes || '';
    } finally {$('check-updates').disabled = false;}
  });
})().catch(() => UI.status('operationFailed', true));
