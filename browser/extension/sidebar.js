/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
const $ = id => document.getElementById(id);
let generation = 0;
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
  for (const tab of tabs) {
    if (filter && !`${tab.title} ${tab.url}`.toLocaleLowerCase(UI.locale).includes(filter)) continue;
    const row = document.createElement('li'); row.className = 'tab-row';
    const button = (text, label, action, key) => {
      const node = document.createElement('button'); node.textContent = text;
      node.setAttribute('aria-label', label); node.title = label;
      node.dataset.focusKey = tab.id + '-' + key;
      node.addEventListener('click', () => UI.run(action)); row.append(node); return node;
    };
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
  $('tabs').replaceChildren(...rows); $('empty').hidden = rows.length > 0;
  if (focused) [...$('tabs').querySelectorAll('button')].find(node => node.dataset.focusKey === focused)?.focus();
}
(async () => {
  await UI.init(); await renderTabs();
  const stored = await browser.storage.local.get('aionSidebarCompanions');
  showCompanions(!!stored.aionSidebarCompanions);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.aionSidebarCompanions) showCompanions(!!changes.aionSidebarCompanions.newValue);
  });
  $('filter').addEventListener('input', () => UI.run(renderTabs));
  document.addEventListener('aion-settings', () => UI.run(renderTabs));
  for (const event of ['onCreated', 'onRemoved', 'onMoved', 'onActivated', 'onUpdated', 'onAttached', 'onDetached']) {
    browser.tabs[event].addListener(() => UI.run(renderTabs));
  }
  $('new-tab').onclick = () => UI.run(() => browser.tabs.create({}));
  $('settings').onclick = () => browser.runtime.openOptionsPage();
  $('characters-toggle').onclick = () => {
    const show = $('companions').hidden; showCompanions(show);
    browser.storage.local.set({aionSidebarCompanions: show}).catch(() => UI.status('operationFailed', true));
  };
})().catch(() => UI.status('operationFailed', true));
