# Third-party notices

## Combined distribution

The combined Fire Axolotl Extension is distributed under GPL-3.0-or-later (`LICENSE`). Original Fire Axolotl files retain their MPL-2.0 notices and license (`LICENSE-MPL-2.0`); combination with GPL code uses the MPL secondary-license compatibility provisions. No upstream copyright notice is removed. Fonts, artwork and individual filter/library licenses retain their terms. This is not the official uBlock Origin add-on and is not affiliated with its authors, Mozilla or Dark Reader.

## Fire Axolotl donor

https://github.com/kaansavukduran/fire-axolotl at `2b739252a5ff66bfd870dfbe6a7e8f2b0ae106a2`, MPL-2.0. Aion companion source, runner source, tests, fixtures, fonts and owner-authorized artwork are reused. Changes made here include packaged path isolation, standalone UI, draft persistence, theme/sidebar/new-tab adapters and independent distribution. `donor.json` records scope. Native engine/policies/installers are not included.

## uBlock Origin

uBlock Origin 1.76.0, Copyright Raymond Hill and contributors, GPL-3.0-or-later. `components.json` identifies the artifact SHA-256, exact source/submodule commits and uAssets revisions. The build makes the limited modifications in `docs/INTEGRATION.md`. The original signed artifact is an input, **not the signature of this output**. uBO copyrights, original LICENSE.txt, list/library notices and its full corresponding source are preserved. `python3 scripts/package_extension.py --with-sources` produces the matching upstream source archive; distribute it with this repository's matching integration sources and any binary release. The engine's own UI contains upstream authorship/help links. Such links do not imply endorsement.

## Dark Reader

Dark Reader 4.9.135, MIT; Copyright Dark Reader Ltd. The readable npm library and full license are under `browser/extension/vendor/`. `SOURCES.json` records the source tarball, npm SHA-512 integrity and file hashes. The library is unmodified; our caller disables remote image-analysis fetching and enables it only through an explicit action on a selected page. This is the page library, not a claim to reproduce the entire Dark Reader extension UI/settings.

## QR Code Generator

QR Code Generator 1.4.4, Copyright (c) 2009 Kazuhiko Arase, MIT. https://github.com/kazuhikoarase/qrcode-generator

The original source copyright/license header and UTF-8 adapter are preserved in `vendor/qrcode.js` and `vendor/qrcode_UTF8.js`; `vendor/SOURCES.json` records their exact npm input and hashes. The npm package supplies an MIT link in its source header; the full MIT terms are reproduced in `vendor/qrcode-generator-LICENSE`. QR Code is a registered trademark of DENSO WAVE INCORPORATED.

## Fonts

Lexend: Copyright 2018 The Lexend Project Authors, SIL Open Font License 1.1. OpenDyslexic Regular/Bold: Copyright Abbie Gonzalez, Reserved Font Name OpenDyslexic, SIL Open Font License 1.1. Files are unmodified and local; full licenses and pinned source/hash metadata remain under `browser/extension/fonts/`. Turkish glyph coverage Çç Ğğ Iı İi Öö Şş Üü was verified in the donor and is checked here. No medical efficacy claim is made.

## Local AI runtime and model data

Transformers.js 3.7.2: Hugging Face, Apache-2.0. Jinja: Hugging Face, MIT. ONNX Runtime Web/Common 1.22.0: Microsoft and contributors, MIT, source commit `f217402897f40ebba457e2421bc0a4702771968e`. Noble hashes 2.0.1: Paul Miller and contributors, MIT. Original code notices are preserved by the readable bundle; complete licenses and ONNX third-party notices are packaged. `package-lock.json` locks source tarballs/integrity, and the generated `ai/RUNTIME.json` records bundled WASM hashes, worker source and lockfile hashes.

ONNX Runtime's Eigen dependency is MPL-2.0 at commit `1d8b82b0740839c0de7f1242a3585e3390ff5f33`. `scripts/fetch_ai_support.py` provides a verified source ZIP of that exact public mirror commit beside the extension artifacts. The upstream notices contain entries for optional native components too; this package contains browser JavaScript/WASM, not native Intel MKL binaries. No reverse-engineering restriction is added.

Qwen 2.5 1.5B Instruct: Qwen/Alibaba Cloud, Apache-2.0; original repository and ONNX conversion revisions, file sizes and SHA-256 hashes are fixed in `ai/model.json`. The original model license is `ai/MODEL-LICENSE.txt`. Weights are separate data downloaded or imported explicitly into a private extension cache; they are not represented as part of the XPI or as our original trained model. No model/provider affiliation or guaranteed translation quality is claimed.

M2M100 418M base model: Meta/Facebook, `facebook/m2m100_418M` at `55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636`; the upstream model card declares MIT. The fairseq MIT notice, copyright Facebook, Inc. and affiliates, is retained as `ai/M2M-LICENSE.txt` from fairseq commit `3d262bb25690e4eb2e7d3c1309b1e9c406ca4b99`. The separately fetched ONNX conversion `Xenova/m2m100_418M` at `9c374f0b7aca709787cea97b047bfbbd1559d177` identifies that base model; its conversion repository does not itself declare a separate license. We record this provenance and do not assert independent trademark or conversion rights. Converted weights are not inside the XPI; file hashes and sizes are pinned in `ai/translation-model.json`.

Node-only image tooling such as sharp is a build dependency and is not embedded in the browser bundle. The dependency lock uses a patched sharp override. Model data, test profiles and credentials are excluded from source/Git backup archives.

## Artwork

Aion is the owner's personal mascot. The donor records owner-authorized, AI-generated Aion and companion art; the existing custom Aion PNG is reused unchanged. No built-in ChatGPT Pet artwork is included. Character and runner provenance/hash records are retained under `characters/PROVENANCE.json` and `runner/PROVENANCE.json`. The donor project license applies to its original artwork only to the extent the owner holds licensable rights. Generated imagery may be non-exclusive; no trademark rights of Mozilla or OpenAI are granted.

## Product names

Firefox is a Mozilla Foundation trademark. Bitwarden, DeepL, DuckDuckGo, Netflix and other names in the parity matrix identify requested tools/features; their code or accounts are not represented as integrated unless expressly listed above.
