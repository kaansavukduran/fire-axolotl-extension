/* SPDX-License-Identifier: MPL-2.0 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('character-canvas'), context = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let catalog, custom = [], selected, image, frames = [], timer, frame = 0, generation = 0, temporaryURL, pending, wave = false, loadedId;
  const config = () => ({columns: Number($('character-columns').value), rows: Number($('character-rows').value), row: Number($('character-row').value) - 1, frames: Number($('character-frames').value), fps: Number($('character-fps').value)});
  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!image || !frames.length) return;
    const [x, y, w, h] = frames[frame];
    const scale = Math.min((canvas.width - 24) / w, (canvas.height - 24) / h);
    context.drawImage(image, x, y, w, h, (canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2, w * scale, h * scale);
    canvas.dataset.frame = String(frame);
  }
  function play() {
    clearInterval(timer); frame = 0; draw();
    const frozen = UI.settings.disabledModules.includes('characters') || document.hidden || reduced.matches || !UI.settings.animations;
    $('character-pause').textContent = UI.t(UI.settings.animations ? 'characterPause' : 'characterPlay');
    $('character-pause').disabled = reduced.matches;
    $('character-reduced').hidden = !reduced.matches;
    if (frozen || frames.length < 2) return;
    timer = setInterval(() => {
      frame = (frame + 1) % frames.length;
      if (wave && frame === 0) {wave = false; configureFrames(); return;}
      draw();
    }, 1000 / (selected.fps || selected.grid?.fps || 6));
  }
  function configureFrames() {
    if (!selected || !image) return;
    const activity = wave ? 'wave' : $('character-activity').value;
    canvas.dataset.activity = activity;
    frames = selected.clips ? selected.clips[activity] || selected.clips.idle : AionCharacters.rectangles(selected, selected.grid);
    $('character-motion-name').textContent = UI.t('characterActivity-' + (selected.clips?.[activity] ? activity : 'idle'));
    $('character-wave').hidden = !selected.clips?.wave;
    play();
  }
  async function render(refreshLibrary = false) {
    if (!catalog) return;
    const currentGeneration = ++generation;
    clearInterval(timer);
    if (refreshLibrary) custom = await CharacterStore.all();
    if (generation !== currentGeneration) return;
    const items = [...catalog, ...custom];
    $('character').replaceChildren(...items.map(item => {
      const option = document.createElement('option'); option.value = item.id;
      option.textContent = typeof item.name === 'string' ? item.name : item.name[UI.locale] || item.name.en;
      return option;
    }));
    selected = items.find(item => item.id === UI.settings.character) || catalog[0];
    $('character').value = selected.id;
    $('character-activity').replaceChildren(...Object.keys(selected.clips || {idle: []}).filter(key => key !== 'wave').map(key => {
      const option = document.createElement('option'); option.value = key; option.textContent = UI.t('characterActivity-' + key); return option;
    }));
    $('character-activity').value = selected.clips?.[UI.settings.characterActivity] ? UI.settings.characterActivity : 'idle';
    $('character-export').hidden = $('character-delete').hidden = !selected.blob;
    if (loadedId === selected.id && image) {wave = false; configureFrames(); return;}
    image = null; draw();
    if (temporaryURL) URL.revokeObjectURL(temporaryURL);
    const url = selected.blob ? (temporaryURL = URL.createObjectURL(selected.blob)) : browser.runtime.getURL('aion/' + selected.path);
    const next = new Image();
    next.src = url;
    await next.decode();
    if (generation !== currentGeneration) return;
    image = next; loadedId = selected.id; canvas.dataset.character = selected.id; wave = false; configureFrames();
  }
  function fields(grid) {
    for (const key of ['columns', 'rows', 'frames', 'fps']) $('character-' + key).value = grid[key];
    $('character-row').value = grid.row + 1;
    $('character-fps-value').textContent = new Intl.NumberFormat(UI.locale).format(grid.fps);
  }
  async function readFile() {
    pending = null; $('character-import').disabled = true;
    const file = $('character-file').files[0];
    if (!file) return;
    if (file.size > 9 * 1024 * 1024) throw new Error('characterTooLarge');
    let bytes = new Uint8Array(await file.arrayBuffer()), source;
    if (bytes[0] !== 137) {
      try {source = JSON.parse(new TextDecoder().decode(bytes));} catch {throw new Error('characterInvalid');}
      if (source.format !== 'fire-axolotl-character' || source.version !== 1 || typeof source.png !== 'string' || source.png.length > AionCharacters.MAX_BYTES * 4 / 3 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(source.png)) throw new Error('characterInvalid');
      try {bytes = Uint8Array.from(atob(source.png), char => char.charCodeAt(0));} catch {throw new Error('characterInvalid');}
    }
    const info = AionCharacters.pngInfo(bytes);
    const grid = AionCharacters.grid(info, source?.grid);
    const blob = new Blob([bytes], {type: 'image/png'});
    const checkURL = URL.createObjectURL(blob);
    try {const check = new Image(); check.src = checkURL; await check.decode();} catch {throw new Error('characterInvalid');} finally {URL.revokeObjectURL(checkURL);}
    pending = {...info, blob};
    fields(grid);
    $('character-name').value = String(source?.name || file.name.replace(/\.[^.]+$/, '')).slice(0, 60);
    $('character-file-info').textContent = `${info.width} × ${info.height} px · ${new Intl.NumberFormat(UI.locale).format(bytes.length)} B`;
    $('character-import').disabled = false;
  }
  async function add() {
    if (!pending) throw new Error('characterInvalid');
    const name = $('character-name').value.trim().slice(0, 60);
    if (!name) throw new Error('nameRequired');
    const record = {...pending, id: 'custom-' + crypto.randomUUID(), name, grid: AionCharacters.grid(pending, config())};
    await CharacterStore.save(record);
    await UI.save({character: record.id}); await render(true);
    pending = null; $('character-import').disabled = true; $('character-file').value = '';
  }
  async function exportCharacter() {
    const data = await new Promise(resolve => {const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(selected.blob);});
    const blob = new Blob([JSON.stringify({format: 'fire-axolotl-character', version: 1, name: selected.name, grid: selected.grid, png: data})], {type: 'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'fire-axolotl-character.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  (async () => {
    await UI.init();
    catalog = await (await fetch(browser.runtime.getURL('aion/characters/catalog.json'))).json();
    $('character').addEventListener('change', () => UI.run(async () => {await UI.save({character: $('character').value}); await render();}));
    $('character-activity').addEventListener('change', () => UI.run(async () => {await UI.save({characterActivity: $('character-activity').value}); configureFrames();}));
    $('character-pause').addEventListener('click', () => UI.run(async () => {await UI.save({animations: !UI.settings.animations}); play();}));
    $('character-wave').addEventListener('click', () => {wave = true; configureFrames();});
    $('character-file').addEventListener('change', () => UI.run(readFile));
    $('character-import').addEventListener('click', () => UI.run(add));
    $('character-fps').addEventListener('input', () => {$('character-fps-value').textContent = new Intl.NumberFormat(UI.locale).format(Number($('character-fps').value));});
    $('character-export').addEventListener('click', () => UI.run(exportCharacter));
    $('character-delete').addEventListener('click', () => UI.run(async () => {
      if (!confirm(UI.t('characterDeleteConfirm'))) return;
      await CharacterStore.remove(selected.id); await UI.save({character: 'aion'}); await render(true);
    }));
    document.addEventListener('aion-settings', () => UI.run(render));
    reduced.addEventListener('change', play);
    document.addEventListener('visibilitychange', play);
    window.addEventListener('pagehide', () => {clearInterval(timer); if (temporaryURL) URL.revokeObjectURL(temporaryURL);}, {once: true});
    await render(true);
  })().catch(() => UI.status('characterStorageFailed', true));
})();
