/* SPDX-License-Identifier: MPL-2.0 */
import {RunnerWorld, WIDTH, GROUND} from './world.sys.mjs';

const TEXT = {
  tr: {title: 'Aion Koşusu', tag: 'Küçük bir mola', best: 'En iyi', score: 'Skor', start: 'Başlat', pause: 'Duraklat', resume: 'Devam et', retry: 'Tekrar oyna', hide: 'Gizle', hint: 'Zıplamak için Boşluk · duraklatmak için Esc', ready: 'Ateşi ve buzu aş!', help: 'Başlat’a bas. Oyun alanındayken Boşluk ile zıpla; istersen alana dokun.', paused: 'Mola verdik.', ice: 'Buz tuttuk! Bir daha deneyelim.', fire: 'Puf! Küllerimizden yeniden doğarız.', local: 'İnternet gerekmez · skor bu cihazda saklanır', unavailable: 'Oyun görseli yüklenemedi.', canvas: 'Aion engel atlama oyunu. Boşluk veya dokunma: zıpla. Esc: duraklat.'},
  en: {title: 'Aion Run', tag: 'A little break', best: 'Best', score: 'Score', start: 'Start', pause: 'Pause', resume: 'Resume', retry: 'Play again', hide: 'Hide', hint: 'Space to jump · Esc to pause', ready: 'Leap over fire and ice!', help: 'Press Start. Focus the game and jump with Space, or tap the play area.', paused: 'Taking a break.', ice: 'Frozen! Let’s try again.', fire: 'Poof! Rise from the ashes.', local: 'Works offline · scores stay on this device', unavailable: 'The game artwork could not be loaded.', canvas: 'Aion obstacle jumping game. Space or tap: jump. Esc: pause.'}
};
const CSS = `
:host{display:block;max-width:760px;width:100%;margin:20px auto 28px;color:#edeef9;font:calc(.875rem * var(--text, 1)) var(--font, system-ui,sans-serif);text-align:start;box-sizing:border-box}
*{box-sizing:border-box}section{border:1px solid #44445f;border-radius:18px;background:#171829;overflow:hidden;box-shadow:0 10px 30px #0002}
header{display:flex;align-items:center;gap:14px;padding:14px 18px}h2{font-size:16px;margin:2px 0 0;font-weight:650}.tag{color:#89d9ef;font-size:10px;letter-spacing:.12em;text-transform:uppercase}.best{margin-inline-start:auto;color:#c9c8dc;font-size:12px}button{font:inherit;cursor:pointer;border:1px solid #62647b;border-radius:9px;padding:7px 13px;background:#292b42;color:inherit}button:hover{background:#3d405b}button:focus-visible,canvas:focus-visible{outline:3px solid #7fe4ff;outline-offset:-3px}.hide{font-size:12px;padding:6px 9px;color:#c4c4d6;background:transparent;border-color:transparent}
.arena{position:relative;background:#101626}canvas{display:block;width:100%;height:auto;aspect-ratio:760 / 194;image-rendering:pixelated;touch-action:manipulation}.message{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}.message>div{max-width:55%;margin-inline-start:100px;padding:12px 18px;background:#171b31eb;border:1px solid #414561;border-radius:12px;text-align:center}.message strong{display:block;font-size:16px}.message p{color:#c2c5da;line-height:1.5;font-size:12px;margin:7px 0 0}.message[hidden]{display:none}
footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 16px}.hint{font-size:11px;color:#b9bed6}.score{margin-inline-start:auto;font-variant-numeric:tabular-nums;font-size:12px}.local{margin:0;padding:0 16px 12px;font-size:10px;color:#a1a6c0}
@media(max-width:520px){header{padding:12px;gap:8px}.message>div{max-width:64%;margin-inline-start:70px;padding:8px}.message p{display:none}.message strong{font-size:13px}.hint{font-size:10px}footer{gap:8px;padding:10px}.local{padding:0 10px 10px}}
`;

export class AionRunnerCard {
  constructor(document, config, actions) {
    this.document = document;
    this.window = document.defaultView;
    this.actions = actions;
    this.text = TEXT[config.language] || TEXT.en;
    this.reduced = !config.animations || this.window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.best = Math.max(0, config.best || 0);
    this.world = new RunnerWorld();
    this.host = document.createElement('section');
    this.host.id = 'fireaxolotl-runner';
    this.shadow = this.host.attachShadow({mode: 'open'});
    this.abort = new this.window.AbortController();
    const make = (tag, parent, text, className) => {
      const element = document.createElement(tag);
      if (text) element.textContent = text;
      if (className) element.className = className;
      parent.append(element);
      return element;
    };
    make('style', this.shadow, CSS);
    const card = make('section', this.shadow);
    card.setAttribute('aria-label', this.text.title);
    const header = make('header', card);
    const title = make('div', header);
    make('span', title, this.text.tag, 'tag');
    make('h2', title, this.text.title);
    this.bestLabel = make('span', header, `${this.text.best} ${this.best}`, 'best');
    const hide = make('button', header, '× ' + this.text.hide, 'hide');
    hide.title = config.language === 'tr' ? 'Ayarlar → Görünüm’den tekrar açabilirsin.' : 'Enable again in Settings → Appearance.';
    const arena = make('div', card, null, 'arena');
    this.canvas = make('canvas', arena);
    this.canvas.width = WIDTH;
    this.canvas.height = 194;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', this.text.canvas);
    this.context = this.canvas.getContext('2d');
    this.overlay = make('div', arena, null, 'message');
    this.overlay.setAttribute('role', 'status');
    const message = make('div', this.overlay);
    this.message = make('strong', message, this.text.ready);
    this.help = make('p', message, this.text.help);
    const footer = make('footer', card);
    this.button = make('button', footer, this.text.start);
    this.button.disabled = true;
    this.button.dataset.action = 'play';
    make('span', footer, this.text.hint, 'hint');
    this.score = make('span', footer, `${this.text.score} 0`, 'score');
    make('p', card, this.text.local, 'local');
    this.image = new this.window.Image();
    this.listen(this.image, 'load', () => {this.button.disabled = false; this.draw();});
    this.listen(this.image, 'error', () => {this.message.textContent = this.text.unavailable;});
    this.image.src = new URL('./aion-runner.png', import.meta.url).href;
    this.listen(hide, 'click', () => {
      this.dismissed = true;
      this.actions.hide();
      this.host.remove();
      this.destroy();
    });
    this.listen(this.button, 'click', () => {
      if (this.world.status === 'running') this.pause();
      else this.start();
    });
    this.listen(this.canvas, 'keydown', event => {
      if (event.code === 'Space' && this.world.status === 'running') {
        event.preventDefault();
        if (!event.repeat) this.world.jump();
      }
      if (event.key === 'Escape') {event.preventDefault(); this.pause();}
    });
    this.listen(this.canvas, 'pointerdown', event => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      this.canvas.focus({preventScroll: true});
      this.world.jump();
    });
    this.listen(document, 'visibilitychange', () => {if (document.hidden) this.pause();});
    this.listen(this.window, 'blur', () => this.pause());
    this.listen(this.host, 'focusout', event => {if (!this.host.contains(event.relatedTarget) && !this.shadow.contains(event.relatedTarget)) this.pause();});
    this.draw();
  }
  listen(target, name, callback) {
    target.addEventListener(name, callback, {signal: this.abort.signal});
  }
  start() {
    if (this.dead || !this.image.complete || !this.image.naturalWidth) return;
    this.world.start();
    this.overlay.hidden = true;
    this.button.textContent = this.text.pause;
    this.canvas.focus({preventScroll: true});
    this.last = null;
    this.accumulator = 0;
    this.schedule();
  }
  pause() {
    if (this.world.status !== 'running') return;
    this.world.pause();
    this.window.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.message.textContent = this.text.paused;
    this.help.textContent = this.text.help;
    this.overlay.hidden = false;
    this.button.textContent = this.text.resume;
    this.draw();
  }
  schedule() {
    if (this.frame != null || this.dead) return;
    this.frame = this.window.requestAnimationFrame(time => {
      this.frame = null;
      if (this.dead) return;
      this.accumulator += this.last === null ? 0 : Math.min(0.05, (time - this.last) / 1000);
      this.last = time;
      const previous = this.world.status;
      while (this.accumulator >= 1 / 120) {
        this.world.step(1 / 120);
        this.accumulator -= 1 / 120;
      }
      if (previous === 'running' && ['ice', 'fire'].includes(this.world.status)) this.finish();
      this.draw();
      if (this.world.status === 'running' || (!this.reduced && ['ice', 'fire'].includes(this.world.status) && this.world.hitTime < 1.8)) this.schedule();
    });
  }
  finish() {
    this.message.textContent = this.text[this.world.status];
    this.help.textContent = this.text.help;
    this.overlay.hidden = false;
    this.button.textContent = this.text.retry;
    if (this.world.score > this.best) {
      this.best = this.world.score;
      this.bestLabel.textContent = `${this.text.best} ${this.best}`;
      this.actions.saveBest(this.best);
    }
  }
  sprite(row, frame, x, bottom, width = 104) {
    if (!this.image.complete || !this.image.naturalWidth) return;
    const sw = this.image.naturalWidth / 6;
    const sy = Math.round(row * this.image.naturalHeight / 8);
    const sh = Math.round((row + 1) * this.image.naturalHeight / 8) - sy;
    const height = width * sh / sw;
    this.context.drawImage(this.image, frame * sw, sy, sw, sh, Math.round(x), Math.round(bottom - height), width, height);
  }
  draw() {
    const c = this.context, world = this.world;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#101626'; c.fillRect(0, 0, WIDTH, 194);
    // Static pixel scenery. Only explicit gameplay scrolls the ground.
    c.fillStyle = '#26304a';
    for (const [x, y] of [[38, 28], [193, 46], [312, 19], [491, 37], [634, 21], [712, 65]]) c.fillRect(x, y, 3, 3);
    c.fillStyle = '#1b2840';
    for (let x = -80; x < WIDTH; x += 160) {c.fillRect(x + 40, 116, 80, 44); c.fillRect(x + 56, 100, 48, 18);}
    c.fillStyle = '#3d5c75'; c.fillRect(0, GROUND, WIDTH, 3);
    c.fillStyle = '#172337'; c.fillRect(0, GROUND + 3, WIDTH, 27);
    c.fillStyle = '#2c435b';
    for (let i = 0; i < 23; i++) c.fillRect((i * 37 - world.distance % 37), GROUND + 12 + (i % 2) * 7, 6, 3);
    const runningFrame = Math.floor(world.time * 11) % 6;
    for (const obstacle of world.obstacles) this.sprite(obstacle.type === 'ice' ? 6 : 7, runningFrame, obstacle.x - 12, GROUND + 1, 65);
    let row = world.status === 'running' ? world.y < 0 ? 2 : 1 : 0;
    let frame = world.status === 'running' ? runningFrame : 0;
    if (world.status === 'ice') {row = 3; frame = Math.min(5, Math.floor(world.hitTime * 8));}
    if (world.status === 'fire') {
      row = world.hitTime < 0.75 ? 4 : 5;
      frame = row === 4 ? Math.min(5, Math.floor(world.hitTime * 8)) : Math.floor(world.hitTime * 5) % 6;
    }
    this.sprite(row, frame, 65, GROUND + world.y + 1);
    const score = `${this.text.score} ${world.score}`;
    if (this.score.textContent !== score) this.score.textContent = score;
    this.canvas.dataset.state = world.status;
    this.canvas.dataset.score = world.score;
    this.canvas.dataset.airborne = String(world.y < 0);
    this.canvas.dataset.obstacleX = world.obstacles.length ? world.obstacles[0].x.toFixed(1) : '';
  }
  destroy() {
    this.dead = true;
    this.abort.abort();
    this.window.cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
