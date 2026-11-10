/* SPDX-License-Identifier: MPL-2.0 */
export const WIDTH = 760;
export const GROUND = 164;

export class RunnerWorld {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }
  reset() {
    this.status = 'ready';
    this.time = 0;
    this.y = 0;
    this.velocity = 0;
    this.score = 0;
    this.distance = 0;
    this.obstacles = [];
    this.nextObstacle = 1.6;
    this.hitTime = 0;
  }
  start() {
    if (this.status !== 'paused') this.reset();
    this.status = 'running';
  }
  pause() {
    if (this.status === 'running') this.status = 'paused';
  }
  jump() {
    if (this.status === 'running' && this.y === 0) this.velocity = -470;
  }
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) return;
    if (['ice', 'fire'].includes(this.status)) {this.hitTime += dt; return;}
    if (this.status !== 'running') return;
    this.time += dt;
    const speed = Math.min(400, 245 + this.score * 4);
    this.distance += speed * dt;
    this.velocity += 1400 * dt;
    this.y = Math.min(0, this.y + this.velocity * dt);
    if (this.y === 0) this.velocity = 0;
    this.nextObstacle -= dt;
    if (this.nextObstacle <= 0) {
      this.obstacles.push({x: WIDTH + 30, type: this.random() < 0.5 ? 'ice' : 'fire', counted: false});
      this.nextObstacle = 1.35 + this.random() * 0.6;
    }
    for (const obstacle of this.obstacles) {
      obstacle.x -= speed * dt;
      // The tail and gill tips are decorative; the collision box follows the body.
      if (obstacle.x + 32 > 119 && obstacle.x < 149 && GROUND + this.y > GROUND - 43) {
        this.status = obstacle.type;
        this.hitTime = 0;
        return;
      }
      if (!obstacle.counted && obstacle.x + 32 < 119) {
        obstacle.counted = true;
        this.score++;
      }
    }
    this.obstacles = this.obstacles.filter(obstacle => obstacle.x > -80);
  }
}
