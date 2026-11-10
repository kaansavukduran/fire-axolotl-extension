/* SPDX-License-Identifier: MPL-2.0 */
((root) => {
  'use strict';
  const MAX_BYTES = 6 * 1024 * 1024;
  function pngInfo(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length > MAX_BYTES) throw new Error('characterTooLarge');
    const magic = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 45 || !magic.every((v, i) => bytes[i] === v)) throw new Error('characterInvalid');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16), height = view.getUint32(20);
    if (!width || !height || width > 8192 || height > 8192 || width * height > 16_000_000) throw new Error('characterTooLarge');
    let position = 8, end = false, data = false;
    while (position + 12 <= bytes.length) {
      const length = view.getUint32(position);
      if (length > bytes.length - position - 12) throw new Error('characterInvalid');
      const type = String.fromCharCode(...bytes.slice(position + 4, position + 8));
      if (position === 8 && (type !== 'IHDR' || length !== 13)) throw new Error('characterInvalid');
      if (type === 'acTL') throw new Error('characterAnimatedPNG');
      if (type === 'IDAT') data = true;
      position += length + 12;
      if (type === 'IEND') {end = length === 0 && position === bytes.length; break;}
    }
    if (!end || !data) throw new Error('characterInvalid');
    return {width, height};
  }
  function grid(info, value = {}) {
    const result = {columns: Number(value.columns ?? 1), rows: Number(value.rows ?? 1), row: Number(value.row ?? 0), frames: Number(value.frames ?? 1), fps: Number(value.fps ?? 6)};
    if (!Object.values(result).every(Number.isInteger) || result.columns < 1 || result.columns > 16 || result.rows < 1 || result.rows > 16 || result.row < 0 || result.row >= result.rows || result.frames < 1 || result.frames > result.columns || result.fps < 2 || result.fps > 24 || info.width % result.columns || info.height % result.rows) throw new Error('characterGridInvalid');
    return result;
  }
  function rectangles(info, config) {
    const g = grid(info, config), w = info.width / g.columns, h = info.height / g.rows;
    return Array.from({length: g.frames}, (_, i) => [i * w, g.row * h, w, h]);
  }
  const api = {MAX_BYTES, pngInfo, grid, rectangles};
  root.AionCharacters = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
