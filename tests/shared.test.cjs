// SPDX-License-Identifier: MPL-2.0
const {test} = require('node:test');
const assert = require('node:assert/strict');
const Aion = require('../browser/extension/shared.js');

test('ready-on-install captions migrate the former default once and retain later choices', () => {
  const fresh=Aion.normalize();
  assert.equal(fresh.autoCaptions,true);assert.equal(fresh.captionOriginal,true);assert.equal(fresh.captionTranslated,true);
  assert.equal(fresh.aiSource,'auto');assert.equal(fresh.aiTarget,'tr');
  const migrated=Aion.normalize({autoCaptions:false,vocabulary:['Işık'],theme:'light',captionOriginal:false});
  assert.equal(migrated.autoCaptions,true);assert.deepEqual(migrated.vocabulary,['Işık']);assert.equal(migrated.theme,'light');assert.equal(migrated.captionOriginal,false);
  const off=Aion.normalize({...migrated,autoCaptions:false});
  assert.equal(Aion.normalize(JSON.parse(JSON.stringify(off))).autoCaptions,false);
});

test('subtitle appearance clamps numeric values and never accepts CSS or remote font input', () => {
  assert.deepEqual(Aion.captionStyle({captionSize:999,captionOpacity:-5,captionFont:'https://tracker/font',captionPosition:'left',captionColor:'red;display:none'}),
    {offset:0,size:48,opacity:0,font:'system',position:'bottom',color:'#ffffff',translationColor:'#85e7ff'});
  const settings=Aion.normalize({aiSource:'auto',aiTarget:'en',captionSize:32,captionPosition:'top',captionFont:'opendyslexic'});
  assert.equal(settings.aiSource,'auto');assert.equal(settings.aiTarget,'en');
  assert.equal(Aion.captionStyle(settings).font,'opendyslexic');
});

test('settings preserve Turkish text, unknown schema fields cannot leak into storage', () => {
  const value = Aion.normalize({scale: 135, textSize: 150, vocabulary: ['Işık, öğüt'], milestones: ['word', 'word', 'fake'], token: 'ignored'});
  assert.equal(value.scale, 135); assert.equal(value.textSize, 150);
  assert.deepEqual(value.vocabulary, ['Işık, öğüt']); assert.deepEqual(value.milestones, ['word']);
  assert.equal(value.token, undefined); assert.equal(Aion.normalize({scale: 400}).scale, 200);
  assert.equal(Aion.normalize({scale: 'invalid'}).scale, 100);
});
test('fresh profiles and resets never share mutable default progress or vocabulary', () => {
  const first = Aion.normalize(); first.milestones.push('word'); first.vocabulary.push('private');
  const second = Aion.normalize();
  assert.deepEqual(second.milestones, []); assert.deepEqual(second.vocabulary, []);
});
test('new profiles start dark and OpenDyslexic remains a supported independent choice', () => {
  assert.equal(Aion.normalize().theme, 'dark');
  assert.equal(Aion.normalize({theme: 'light', font: 'opendyslexic'}).theme, 'light');
  assert.equal(Aion.normalize({font: 'opendyslexic'}).font, 'opendyslexic');
});
test('supported device language is used, unsupported languages fall back to Turkish', () => {
  assert.equal(Aion.language({}, 'en-GB'), 'en'); assert.equal(Aion.language({}, 'tr-TR'), 'tr');
  assert.equal(Aion.language({}, 'de-DE'), 'tr'); assert.equal(Aion.language({language: 'en'}, 'tr'), 'en');
});
test('container navigation never accepts script, file or credential URLs', () => {
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'about:config', 'https://u:p@example.org', 'data:text/html,x']) assert.equal(Aion.webURL(url), null);
  assert.equal(Aion.webURL('https://example.org/öğren'), 'https://example.org/%C3%B6%C4%9Fren');
});
test('translation uses a reviewed HTTPS destination without redirects or URL secrets', () => {
  for (const url of ['http://example.org', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/', 'https://host.local/', 'https://u:p@example.org/', 'https://example.org/?key=x', 'https://example.org:8080']) assert.throws(() => Aion.translationEndpoint(url));
  assert.deepEqual(Aion.translationEndpoint('https://translate.example.org/translate'), {url: 'https://translate.example.org/translate', origin: 'https://translate.example.org/*'});
});
test('VTT and SRT cues retain timestamps and text while ignoring markup', () => {
  const vtt = 'WEBVTT\n\n00:01.000 --> 00:03.000\n<b>Hello</b>\n\n00:00:04.000 --> 00:00:05.000 align:center\nIşık';
  assert.deepEqual(Aion.parseVTT(vtt), [{start: 1, end: 3, text: 'Hello'}, {start: 4, end: 5, text: 'Işık'}]);
  assert.deepEqual(Aion.parseVTT('1\r\n00:00:01,500 --> 00:00:02,000\r\nMerhaba'), [{start: 1.5, end: 2, text: 'Merhaba'}]);
  assert.deepEqual(Aion.parseVTT('00:99.000 --> 00:99.100\ninvalid\n\n00:02 --> 00:01\nbackwards'), []);
});

test('subtitle timing offset is bounded, rounded and independent from imported cue times', () => {
  assert.equal(Aion.normalize().captionOffset,0);
  assert.equal(Aion.captionStyle({captionOffset:30}).offset,10);
  assert.equal(Aion.captionStyle({captionOffset:-30}).offset,-10);
  assert.equal(Aion.captionStyle({captionOffset:1.26}).offset,1.3);
  assert.equal(Aion.captionStyle({captionOffset:'bad'}).offset,0);
  assert.equal(Aion.captionStyle({captionOffset:Infinity}).offset,0);
});
