/* SPDX-License-Identifier: MPL-2.0 */
import {AionRunnerCard} from './runner/card.sys.mjs';
let card;
async function renderGame() {
  card?.destroy(); document.getElementById('runner').replaceChildren();
  if (!UI.settings.runner) return;
  const {aionRunnerBest = 0} = await browser.storage.local.get('aionRunnerBest');
  card = new AionRunnerCard(document, {language: UI.locale, best: aionRunnerBest, animations: UI.settings.animations}, {
    saveBest: score => browser.runtime.sendMessage({type: 'runnerBest', score}).catch(() => UI.status('operationFailed', true)),
    hide: () => UI.save({runner: false}).catch(() => UI.status('operationFailed', true))
  });
  document.getElementById('runner').append(card.host);
}
await UI.init(); await renderGame();
document.addEventListener('aion-settings', () => renderGame().catch(() => UI.status('operationFailed', true)));
document.getElementById('settings').onclick = () => browser.runtime.openOptionsPage();
document.getElementById('open-tabs').onclick = () => browser.sidebarAction.open();
document.getElementById('search-form').onsubmit = event => {
  event.preventDefault(); UI.run(() => browser.search.search({query: document.getElementById('search').value, disposition: 'CURRENT_TAB'}));
};
window.addEventListener('pagehide', () => card?.destroy());
