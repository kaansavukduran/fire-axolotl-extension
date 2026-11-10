/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
const $ = id => document.getElementById(id);
let generation = 0;
const selected = new Set();
let visible = [];
function renderSelection() {
  const count = new Intl.NumberFormat(UI.locale).format(selected.size);
  $('selected-count').textContent = UI.t('selectedTabs') + ': ' + count;
  $('close-selected').textContent = UI.t('closeSelectedTabs') + ' (' + count + ')';
  $('close-selected').disabled = !selected.size;
  $('clear-selection').disabled = !selected.size;
}
async function renderSessionPermission() {
  $('revoke-sessions').hidden = !(await browser.permissions.contains({permissions:['sessions']}));
}
function showCompanions(show) {
  $('companions').hidden = !show;
  $('characters-toggle').setAttribute('aria-expanded', String(show));
  $('companions').src = show ? 'characters.html' : 'about:blank';
}
async function renderTabs() {
  const current = ++generation;
  const tabs = await browser.tabs.query({currentWindow: true});
  const identities = await browser.contextualIdentities.query({});
  if (current !== generation) return;
  const filter = $('filter').value.toLocaleLowerCase(UI.locale);
  const focused = document.activeElement?.dataset.focusKey;
  const rows = [];
  visible = [];
  for (const tab of tabs) {
    if (filter && !`${tab.title} ${tab.url}`.toLocaleLowerCase(UI.locale).includes(filter)) continue;
    visible.push(tab.id);
    const row = document.createElement('li'); row.className = 'tab-row';
    const button = (text, label, action, key) => {
      const node = document.createElement('button'); node.textContent = text;
      node.setAttribute('aria-label', label); node.title = label;
      node.dataset.focusKey = tab.id + '-' + key;
      node.addEventListener('click', () => UI.run(action)); row.append(node); return node;
    };
    const checkbox = document.createElement('input');checkbox.type='checkbox';checkbox.checked=selected.has(tab.id);
    checkbox.dataset.focusKey=tab.id+'-check';checkbox.dataset.tabId=tab.id;
    checkbox.setAttribute('aria-label', UI.t('selectTab') + ': ' + (tab.title || UI.t('newTab')));
    checkbox.onchange=()=>{if(checkbox.checked)selected.add(tab.id);else selected.delete(tab.id);renderSelection();};
    row.prepend(checkbox);
    const identity = identities.find(item => item.cookieStoreId === tab.cookieStoreId);
    const title = (tab.pinned ? '◆ ' : '') + (tab.title || UI.t('newTab'));
    const select = button(title + (identity ? ' · ' + identity.name : ''), title,
      () => browser.tabs.update(tab.id, {active: true}), 'select');
    select.className = 'tab-select'; select.setAttribute('aria-current', String(tab.active));
    if (tab.active) row.classList.add('active');
    button('↑', UI.t('moveUp'), () => browser.tabs.move(tab.id, {index: Math.max(0, tab.index - 1)}), 'up').className = 'quiet';
    button('↓', UI.t('moveDown'), () => browser.tabs.move(tab.id, {index: Math.min(tabs.length - 1, tab.index + 1)}), 'down').className = 'quiet';
    button(tab.pinned ? '◇' : '◆', UI.t(tab.pinned ? 'unpin' : 'pin'), () => browser.tabs.update(tab.id, {pinned: !tab.pinned}), 'pin').className = 'quiet';
    button('×', UI.t('closeTab') + ': ' + title, () => browser.tabs.remove(tab.id), 'close').className = 'quiet';
    rows.push(row);
  }
  for (const id of selected) if (!visible.includes(id)) selected.delete(id);
  renderSelection();
  $('tabs').replaceChildren(...rows); $('empty').hidden = rows.length > 0;
  if (focused) [...$('tabs').querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === focused)?.focus();
}
(async () => {
  await UI.init(); await renderTabs();
  const stored = await browser.storage.local.get('aionSidebarCompanions');
  showCompanions(!!stored.aionSidebarCompanions);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.aionSidebarCompanions) showCompanions(!!changes.aionSidebarCompanions.newValue);
  });
  $('filter').addEventListener('input', () => {selected.clear();UI.run(renderTabs);});
  document.addEventListener('aion-settings', () => UI.run(renderTabs));
  for (const event of ['onCreated', 'onRemoved', 'onMoved', 'onActivated', 'onUpdated', 'onAttached', 'onDetached']) {
    browser.tabs[event].addListener(() => UI.run(renderTabs));
  }
  $('select-visible').onclick=()=>UI.run(async()=>{selected.clear();visible.forEach(id=>selected.add(id));await renderTabs();});
  $('clear-selection').onclick=()=>UI.run(async()=>{selected.clear();await renderTabs();});
  $('close-selected').onclick=()=>UI.run(async()=>{
    const tabs=await browser.tabs.query({currentWindow:true});
    const ids=tabs.filter(tab=>selected.has(tab.id)).map(tab=>tab.id);
    if (!ids.length) {await renderTabs();return;}
    if (!confirm(UI.t('confirmCloseTabs') + ' ' + ids.length)) return;
    await browser.tabs.remove(ids);selected.clear();await renderTabs();UI.status('selectedTabsClosed');
  });
  $('restore-tab').onclick=()=>{
    // Request the optional permission inside the explicit click gesture.
    const grant=browser.permissions.request({permissions:['sessions']});
    UI.run(async()=>{
      if (!await grant) throw new Error('sessionsPermissionDenied');
      await renderSessionPermission();
      const entries=await browser.sessions.getRecentlyClosed({maxResults:10});
      const entry=entries.find(item=>item.tab);
      if (!entry) throw new Error('noClosedTab');
      await browser.sessions.restore(entry.tab.sessionId);UI.status('closedTabRestored');
    });
  };
  $('revoke-sessions').onclick=()=>UI.run(async()=>{await browser.permissions.remove({permissions:['sessions']});await renderSessionPermission();UI.status('sessionsRevoked');});
  browser.permissions.onAdded.addListener(()=>renderSessionPermission().catch(()=>{}));
  browser.permissions.onRemoved.addListener(()=>renderSessionPermission().catch(()=>{}));
  await renderSessionPermission();
  $('new-tab').onclick = () => UI.run(() => browser.tabs.create({}));
  $('settings').onclick = () => browser.runtime.openOptionsPage();
  $('characters-toggle').onclick = () => {
    const show = $('companions').hidden; showCompanions(show);
    browser.storage.local.set({aionSidebarCompanions: show}).catch(() => UI.status('operationFailed', true));
  };
  document.body.dataset.ready='true';
})().catch(() => UI.status('operationFailed', true));
