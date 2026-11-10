// SPDX-License-Identifier: MPL-2.0
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Aion = require('../browser/extension/shared.js');

function fixture(seed = {}) {
  const store = {...seed};
  const removed = [], createdTabs = [], listeners = {};
  let identities = [{name: 'Personal', cookieStoreId: 'firefox-container-1'}];
  let tabs = [{id: 7, url: 'https://example.org/', cookieStoreId: 'firefox-default'}];
  const browser = {
    runtime: {id: 'test@aion', getURL: p => 'moz-extension://test/' + p, onMessage: {addListener: fn => listeners.message = fn}, onStartup: {addListener: fn => listeners.startup = fn}},
    storage: {local: {get: async key => ({[key]: structuredClone(store[key])}), set: async patch => Object.assign(store, structuredClone(patch))}},
    contextualIdentities: {
      query: async () => identities,
      create: async details => {const identity = {...details, cookieStoreId: 'firefox-container-' + (identities.length + 1)}; identities.push(identity); return identity;},
      remove: async id => {removed.push(id); identities = identities.filter(i => i.cookieStoreId !== id);}
    },
    tabs: {query: async () => tabs, create: async tab => {createdTabs.push(tab); return {id: 8};}, onRemoved: {addListener: fn => listeners.removed = fn}},
    i18n: {getUILanguage: () => 'tr'},
    permissions: {contains: async () => false}
  };
  const context = vm.createContext({browser, Aion, console, setTimeout, clearTimeout, URL, fetch: () => {throw new Error('Unexpected network request');}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../browser/extension/background.js'), 'utf8'), context);
  const sender = {id: 'test@aion', url: 'moz-extension://test/aion/settings.html', tab: {id: 20}};
  return {store, removed, createdTabs, browser, listeners, send: message => listeners.message(message, sender), setTabs: value => tabs = value, setIdentities: value => identities = value};
}

test('options opened in a browser tab retain authority; web content cannot send privileged commands', async () => {
  const f = fixture();
  assert.equal((await f.send({type: 'settings'})).scale, 100);
  await assert.rejects(f.listeners.message({type: 'createContainer', name: 'attacker'}, {id: 'test@aion', url: 'https://example.org/', tab: {id: 7}}), /unauthorized/);
  await assert.rejects(f.listeners.message({type: 'settings'}, {id: 'other@addon', url: 'moz-extension://test/aion/settings.html'}), /unauthorized/);
});
test('opening a container creates a new tab and never rewrites the existing tab', async () => {
  const f = fixture();
  await f.send({type: 'openContainer', id: 'firefox-container-1'});
  assert.equal(f.createdTabs.length, 1);
  assert.equal(f.createdTabs[0].url, 'https://example.org/');
  assert.equal(f.createdTabs[0].cookieStoreId, 'firefox-container-1');
  assert.deepEqual(f.store.settings.milestones, ['container']);
});
test('repeating a real action awards a milestone only once, disabling progress keeps core functions working', async () => {
  const f = fixture();
  await f.send({type: 'word', word: 'Işık'}); await f.send({type: 'word', word: 'Işık'});
  assert.deepEqual(f.store.settings.vocabulary, ['Işık']); assert.deepEqual(f.store.settings.milestones, ['word']);
  await f.send({type: 'save', patch: {progress: false}});
  await f.send({type: 'createContainer', name: 'İş'});
  assert.deepEqual(f.store.settings.milestones, ['word']);
  assert.equal((await f.send({type: 'containers'})).at(-1).name, 'İş');
});
test('temporary cleanup deletes only owned containers with no live tabs', async () => {
  const f = fixture({temporaryContainers: ['firefox-container-2', 'firefox-container-3']});
  f.setIdentities([1, 2, 3].map(n => ({cookieStoreId: 'firefox-container-' + n})));
  f.setTabs([{id: 7, cookieStoreId: 'firefox-container-3'}]);
  f.listeners.removed();
  // A following serialized write waits for cleanup without a timing-based sleep.
  await f.send({type: 'save', patch: {scale: 135}});
  assert.deepEqual(f.removed, ['firefox-container-2']);
  assert.deepEqual(f.store.temporaryContainers, ['firefox-container-3']);
});
test('translation without the exact host permission never sends text', async () => {
  const f = fixture({settings: {...Aion.defaults, endpoint: 'https://translate.example.org/translate'}});
  await assert.rejects(f.send({type: 'translate', text: 'private sentence'}), /permissionRequired/);
});
test('disabled modules reject privileged actions while other enabled tools keep working', async () => {
  const f=fixture({settings:Aion.normalize({disabledModules:['containers']})});
  await assert.rejects(f.send({type:'createContainer',name:'hidden'}),/moduleDisabled/);
  await f.send({type:'word',word:'still works'});
  assert.deepEqual(f.store.settings.vocabulary,['still works']);
  await f.send({type:'save',patch:{disabledModules:[]}});
  await f.send({type:'createContainer',name:'enabled'});
  assert.equal((await f.send({type:'containers'})).at(-1).name,'enabled');
});

test('runner record writes serialize and reject invalid scores without corrupting a higher record', async () => {
  const f = fixture();
  await Promise.all([f.send({type: 'runnerBest', score: 12}), f.send({type: 'runnerBest', score: 3})]);
  assert.equal(f.store.aionRunnerBest, 12);
  for (const score of [-1, 1.25, 1000001, 'bad']) await assert.rejects(f.send({type: 'runnerBest', score}), /unknownAction/);
  assert.equal(f.store.aionRunnerBest, 12);
});
