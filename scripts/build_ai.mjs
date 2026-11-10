// SPDX-License-Identifier: GPL-3.0-or-later
import {build} from 'esbuild';
import {mkdir, rm, copyFile, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const output = new URL('../work/ai-runtime/', import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(new URL('ort/', output), {recursive: true});
await mkdir(new URL('licenses/', output), {recursive: true});
await build({entryPoints: ['browser/extension/ai/worker.mjs'], outfile: new URL('worker.mjs', output).pathname,
  bundle: true, format: 'esm', alias:{'onnxruntime-web':'onnxruntime-web/webgpu'}, platform: 'browser', target: ['firefox140'], minify: false, legalComments: 'eof'});
const records = {};
for (const variant of ['.jsep']) for (const ext of ['mjs', 'wasm']) {
  const name = `ort-wasm-simd-threaded${variant}.${ext}`;
  const source = new URL(`../node_modules/onnxruntime-web/dist/${name}`, import.meta.url);
  await copyFile(source, new URL('ort/' + name, output));
  records[name] = createHash('sha256').update(await readFile(source)).digest('hex');
}
for (const [pkg, license] of [['@huggingface/transformers','LICENSE'], ['@huggingface/jinja','LICENSE'], ['@noble/hashes','LICENSE']]) {
  await copyFile(new URL(`../node_modules/${pkg}/${license}`, import.meta.url), new URL('licenses/' + pkg.replaceAll('/', '-') + '.txt', output));
}
await writeFile(new URL('RUNTIME.json', output), JSON.stringify({workerSourceSHA256:createHash('sha256').update(await readFile('browser/extension/ai/worker.mjs')).digest('hex'),lockSHA256:createHash('sha256').update(await readFile('package-lock.json')).digest('hex'),transformers: '3.7.2', onnxruntimeWeb: '1.22.0', files: records}, null, 2) + '\n');
console.log('Built local AI worker and packaged WASM/WebGPU runtime; model weights remain a separate verified local cache.');
