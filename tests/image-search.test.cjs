/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Aion = require('../browser/extension/shared.js');

test('image search keeps image query parameters inside one chosen HTTPS provider URL', () => {
  const image = 'https://images.example.org/a.png?size=large&caption=ışık';
  for (const [provider, host, parameter] of [['google', 'lens.google.com', 'url'], ['bing', 'www.bing.com', 'imgurl'], ['tineye', 'tineye.com', 'url'], ['yandex', 'yandex.com', 'url']]) {
    const target = new URL(Aion.imageSearchURL(provider, image));
    assert.equal(target.protocol, 'https:'); assert.equal(target.hostname, host);
    assert.equal(target.searchParams.get(parameter), new URL(image).href);
  }
  for (const source of ['data:image/png;base64,abc', 'file:///private/photo.jpg', 'javascript:alert(1)', 'https://user:secret@example.org/a.png']) assert.equal(Aion.imageSearchURL('bing', source), null);
  assert.equal(Aion.imageSearchURL('__proto__', image), null);
});

test('context-menu search needs an explicit click, respects disable and preserves the source container', async () => {
  const menuItems = new Map(), tabs = [], events = {};
  let settings = Aion.normalize({language: 'en'});
  const browser = {
    menus: {remove: async id => {menuItems.delete(id); for (const [key, item] of menuItems) if (item.parentId === id) menuItems.delete(key);}, refresh: async () => {}, create: (item, done) => {menuItems.set(item.id, item); done();}, onClicked: {addListener: fn => events.click = fn}},
    runtime: {onInstalled: {addListener: fn => events.install = fn}, onStartup: {addListener: fn => events.startup = fn}},
    storage: {onChanged: {addListener: fn => events.change = fn}}, i18n: {getUILanguage: () => 'tr'},
    tabs: {create: async details => tabs.push(details)}
  };
  const context = vm.createContext({browser, Aion, console, readSettings: async () => settings, fetch: () => {throw new Error('Image search must not fetch in the background');}});
  vm.runInContext(fs.readFileSync('browser/extension/image-search.js', 'utf8'), context);
  menuItems.set("uBlock0-subscribeToList", {id:"uBlock0-subscribeToList"});
  await events.install();
  assert.equal(menuItems.size, 6); assert.equal(tabs.length, 0);
  assert.equal(menuItems.get('aion-image-search').title, 'Aion · Search by image');
  await events.click({menuItemId: 'aion-image-search-bing', srcUrl: 'https://images.example.org/a.png'}, {windowId: 3, cookieStoreId: 'firefox-container-2'});
  assert.equal(tabs.length, 1); assert.equal(tabs[0].cookieStoreId, 'firefox-container-2'); assert.equal(tabs[0].windowId, 3);
  settings = Aion.normalize({imageSearch: false});
  await events.startup(); assert.equal(menuItems.size, 1); assert.ok(menuItems.has("uBlock0-subscribeToList"));
  await events.click({menuItemId: 'aion-image-search-bing', srcUrl: 'https://images.example.org/a.png'}, {});
  assert.equal(tabs.length, 1);
});
