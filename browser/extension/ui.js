/* SPDX-License-Identifier: MPL-2.0 */
'use strict';
globalThis.UI = {
  settings: null, messages: {}, locale: 'tr',
  t(key) {return this.messages[key]?.message || key;},
  async init() {
    this.settings = await browser.runtime.sendMessage({type: 'settings'});
    await this.apply(this.settings);
    browser.storage.onChanged.addListener(async (changes, area) => {
      if (area === 'local' && changes.settings) {
        await this.apply(Aion.normalize(changes.settings.newValue));
        document.dispatchEvent(new Event('aion-settings'));
      }
    });
  },
  async apply(settings) {
    const generation = this.generation = (this.generation || 0) + 1;
    this.settings = settings;
    const locale = Aion.language(settings, browser.i18n.getUILanguage());
    let messages = this.messages;
    if (this.locale !== locale || !Object.keys(this.messages).length) {
      const response = await fetch(browser.runtime.getURL(`aion/_locales/${locale}/messages.json`));
      messages = await response.json();
    }
    if (generation !== this.generation) return;
    this.messages = messages; this.locale = locale;
    const root = document.documentElement;
    root.lang = locale; root.dataset.theme = settings.theme;
    root.style.fontSize = `${16 * settings.scale / 100}px`;
    root.style.setProperty('--text', settings.textSize / 100);
    root.style.setProperty('--leading', settings.lineHeight);
    root.style.setProperty('--spacing', settings.letterSpacing + 'em');
    root.style.setProperty('--font', {system: 'system-ui,sans-serif', sans: 'Arial,Helvetica,sans-serif', serif: 'Georgia,serif', dyslexic: 'Lexend,system-ui,sans-serif', opendyslexic: 'OpenDyslexic,system-ui,sans-serif'}[settings.font]);
    root.classList.toggle('no-motion', !settings.animations);
    document.querySelectorAll('[data-i18n]').forEach(el => {el.textContent = this.t(el.dataset.i18n);});
    document.querySelectorAll('[data-label]').forEach(el => {el.setAttribute('aria-label', this.t(el.dataset.label));});
    document.querySelectorAll('[data-placeholder]').forEach(el => {el.placeholder = this.t(el.dataset.placeholder);});
    document.title = `Fire Axolotl · ${this.t(document.body.classList.contains('settings') ? 'settings' : document.body.classList.contains('characters') ? 'characterTitle' : 'companion')}`;
  },
  status(key, error = false) {
    const el = document.getElementById('status');
    el.textContent = this.t(key); el.dataset.error = error;
  },
  async run(fn) {
    try {await fn();} catch (error) {
      const key = String(error.message || '').replace(/^Error: /, '');
      this.status(this.messages[key] ? key : 'operationFailed', true);
    }
  },
  async save(patch) {
    const settings = await browser.runtime.sendMessage({type: 'save', patch});
    await this.apply(settings); this.status('saved'); return settings;
  }
};
