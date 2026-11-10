/* SPDX-License-Identifier: MPL-2.0 */
((root) => {
  'use strict';
  const defaults = Object.freeze({
    schema: 1, language: '', theme: 'dark', scale: 100, textSize: 100,
    font: 'system', lineHeight: 1.5, letterSpacing: 0,
    progress: true, animations: true, sounds: false, imageSearch: true, browserTheme: false, runner: true,
    targetLanguage: 'tr', endpoint: '', vocabulary: [], milestones: [], quality: 'auto', character: 'aion', characterActivity: 'idle',
    captionSize: 24, captionOpacity: 90, captionFont: 'system', captionPosition: 'bottom', captionColor: '#ffffff', captionTranslationColor: '#85e7ff',
    captionOriginal: true, captionTranslated: true, aiSource: 'auto', aiTarget: 'tr', aiBackend: 'wasm',
    moduleOrder: ['containers', 'video', 'translation', 'ai', 'characters'], disabledModules: []
  });
  const clamp = (v, lo, hi, fallback) => Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : fallback;
  function normalize(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
    const out = {...defaults, vocabulary: [], milestones: [], moduleOrder: [...defaults.moduleOrder], disabledModules: []};
    if (Array.isArray(input.moduleOrder)) out.moduleOrder = [...new Set([...input.moduleOrder.filter(key => defaults.moduleOrder.includes(key)), ...defaults.moduleOrder])];
    if (Array.isArray(input.disabledModules)) out.disabledModules = [...new Set(input.disabledModules.filter(key => defaults.moduleOrder.includes(key)))];
    for (const key of ['progress', 'animations', 'sounds', 'imageSearch', 'browserTheme', 'runner', 'captionOriginal', 'captionTranslated']) if (typeof input[key] === 'boolean') out[key] = input[key];
    for (const [key, values] of Object.entries({language: ['', 'tr', 'en'], theme: ['system', 'light', 'dark', 'contrast'], font: ['system', 'sans', 'serif', 'dyslexic', 'opendyslexic'], quality: ['auto', 'best', 'hd720', 'hd1080', 'hd1440', 'hd2160']})) {
      if (values.includes(input[key])) out[key] = input[key];
    }
    out.scale = Math.round(clamp(input.scale ?? 100, 80, 200, 100));
    if (typeof input.character === 'string' && (/^(aion|sheep|wolf|owl)$/.test(input.character) || /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.character))) out.character = input.character;
    if (['idle', 'read', 'work'].includes(input.characterActivity)) out.characterActivity = input.characterActivity;
    out.textSize = Math.round(clamp(input.textSize ?? 100, 80, 200, 100));
    out.lineHeight = clamp(input.lineHeight ?? 1.5, 1, 2.5, 1.5);
    out.letterSpacing = clamp(input.letterSpacing ?? 0, 0, 0.2, 0);
    out.captionSize = Math.round(clamp(input.captionSize ?? 24, 16, 48, 24));
    out.captionOpacity = Math.round(clamp(input.captionOpacity ?? 90, 0, 100, 90));
    for (const [key, allowed] of Object.entries({captionFont: ['system', 'lexend', 'opendyslexic'], captionPosition: ['top', 'bottom'], aiBackend: ['wasm', 'webgpu']})) if (allowed.includes(input[key])) out[key] = input[key];
    for (const key of ['captionColor', 'captionTranslationColor']) if (typeof input[key] === 'string' && /^#[a-fA-F0-9]{6}$/.test(input[key])) out[key] = input[key];
    for (const key of ['aiSource', 'aiTarget']) if (typeof input[key] === 'string' && /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(input[key])) out[key] = input[key];
    if (input.aiSource === 'auto') out.aiSource = 'auto';
    if (typeof input.targetLanguage === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(input.targetLanguage)) out.targetLanguage = input.targetLanguage;
    if (typeof input.endpoint === 'string') out.endpoint = input.endpoint.slice(0, 2048);
    if (Array.isArray(input.vocabulary)) out.vocabulary = input.vocabulary.filter(v => typeof v === 'string' && v.trim()).map(v => v.slice(0, 300)).slice(0, 5000);
    if (Array.isArray(input.milestones)) out.milestones = [...new Set(input.milestones.filter(v => ['container', 'video', 'word'].includes(v)))];
    return out;
  }
  function language(settings, deviceLanguage = 'tr') {
    return settings.language || (/^en(?:-|$)/i.test(deviceLanguage) ? 'en' : 'tr');
  }
  function webURL(value) {
    try {const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;} catch {return null;}
  }
  function translationEndpoint(value) {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.port) throw new Error('invalidEndpoint');
    // An endpoint is deliberately user-selected. Never accept one from page content.
    if (u.hostname === 'localhost' || !u.hostname.includes('.') || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(':') || /\.(local|internal)$/.test(u.hostname)) throw new Error('invalidEndpoint');
    return {url: u.href, origin: u.origin + '/*'};
  }
  function imageSearchURL(provider, value) {
    const image = webURL(value);
    if (!image || image.length > 8192) return null;
    const providers = {
      google: ['https://lens.google.com/uploadbyurl', 'url'],
      bing: ['https://www.bing.com/images/searchbyimage', 'imgurl'],
      tineye: ['https://tineye.com/search', 'url'],
      yandex: ['https://yandex.com/images/search', 'url']
    };
    if (!Object.hasOwn(providers, provider)) return null;
    const [endpoint, parameter] = providers[provider];
    const target = new URL(endpoint);
    target.searchParams.set(parameter, image);
    if (provider === 'bing') target.searchParams.set('cbir', 'sbi');
    if (provider === 'yandex') target.searchParams.set('rpt', 'imageview');
    return target.href;
  }
  function parseVTT(raw) {
    const text = String(raw).replace(/^\uFEFF/, '').replace(/\r/g, '');
    const stamp = v => {
      const p = v.replace(',', '.').split(':').map(Number);
      if (p.some(n => !Number.isFinite(n) || n < 0) || p.length < 2 || p.length > 3 || p.at(-1) >= 60 || p.at(-2) >= 60) return NaN;
      return p.reduce((n, x) => n * 60 + x, 0);
    };
    const cues = [];
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.split('\n');
      const i = lines.findIndex(line => line.includes('-->'));
      if (i < 0) continue;
      const match = lines[i].match(/^\s*([\d:.,]+)\s+-->\s+([\d:.,]+)/);
      if (!match) continue;
      const start = stamp(match[1]), end = stamp(match[2]);
      const content = lines.slice(i + 1).join('\n').replace(/<[^>]*>/g, '').trim();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start && content) cues.push({start, end, text: content.slice(0, 2000)});
      if (cues.length >= 10000) break;
    }
    return cues.sort((a, b) => a.start - b.start);
  }
  function captionStyle(input) {
    const settings = normalize(input);
    return {size: settings.captionSize, opacity: settings.captionOpacity, font: settings.captionFont, position: settings.captionPosition,
      color: settings.captionColor, translationColor: settings.captionTranslationColor};
  }
  function localPreferences(input = {}) {
    const out={aionSiteStyles:{},aionMediaSites:{}};
    const origin = value => {try{const u=new URL(value);return webURL(value)&&u.origin===value;}catch{return false;}};
    for(const [site,rule] of Object.entries(input.aionSiteStyles||{}).slice(0,200)) if(origin(site)&&rule&&typeof rule==='object')out.aionSiteStyles[site]={mode:['dark','light','default'].includes(rule.mode)?rule.mode:'default',font:['original','system','lexend','opendyslexic'].includes(rule.font)?rule.font:'original'};
    for(const [site,speed] of Object.entries(input.aionMediaSites||{}).slice(0,200)) if(origin(site)&&Number.isFinite(speed)&&speed>=.25&&speed<=4)out.aionMediaSites[site]=speed;
    if(Number.isSafeInteger(input.aionRunnerBest)&&input.aionRunnerBest>=0&&input.aionRunnerBest<=1000000)out.aionRunnerBest=input.aionRunnerBest;
    if(typeof input.aionSidebarCompanions==='boolean')out.aionSidebarCompanions=input.aionSidebarCompanions;
    if(typeof input.aionDraft==='string')out.aionDraft=input.aionDraft.slice(0,5000);
    return out;
  }
  const api = {defaults, normalize, language, clamp, webURL, translationEndpoint, imageSearchURL, parseVTT, captionStyle, localPreferences};
  root.Aion = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
