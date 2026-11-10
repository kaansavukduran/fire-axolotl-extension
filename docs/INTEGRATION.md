# Integration and reproducibility

`donor.json` locks the donor repository and source commit. The donor remains read-only. Aion sources and tests retain MPL-2.0 notices. `components.json` locks uBO's official signed artifact digest, source, submodules and uAssets revisions. `vendor/SOURCES.json` locks the MIT page-darkening/QR inputs; font and artwork provenance files are retained.

`scripts/package_extension.py` creates one manifest, one product identity and one background page. The original uBO distribution occupies the root; Aion occupies `aion/`. Only these upstream integration changes are applied, each guarded against an unexpected input:

1. Manifest: independent product ID, name/version, Aion popup/options/sidebar/new-tab, union permissions, CSP and retained uBO content scripts/resources/commands.
2. Background HTML: load Aion's background, AI, media, image, Sync, site-style and browser-theme modules alongside uBO.
3. `vapi-background.js`: remove only uBO-owned context menus instead of all extension menus; preserve Aion local-storage keys during uBO reset/restore; pin uBO's internal migration version to 1.76.0 independently of the extension version.
4. `vapi-common.js`: retain the engine version for engine feature detection.
5. `start.js`: compare update versions against the product manifest version, separately from the pinned engine migration version. This does not constitute a signed-update test.
6. Drop upstream `mozilla-recommendation.json` and `META-INF/` signatures because the combined package is changed and must receive its own signature. No upstream signature is represented as valid for this product.

Aion image menus also remove only their own menu parent. Aion local keys are `settings`, `temporaryContainers` and the `aion*` namespace (runner record, draft, site styles/speeds and Sync consent); custom character blobs use their own IndexedDB. uBO filter storage/caches stay at their original names. Aion's JSON settings backup does not back up uBO filters or custom character blobs; use the blocker dashboard and the character export for those separate stores.

Do not automatically import or alter an installed donor/uBO profile. The extension uses a separate ID, so previous add-on storage is not silently migrated. Explicit Aion JSON import is supported. Disabling/removing the extension releases its theme and new-tab override through Firefox; contextual identities should not be described as automatically deleted on uninstall. Temporary containers are cleaned while the extension is running/startup.

`--with-sources` builds the full upstream corresponding-source archive with exact submodules, uAssets, package and build instructions. The modified distribution is reproducible from that source archive plus this repository's matching commit. Build inputs are never executed merely by downloading them. The packaged XPI contains readable integration source and license notices; uBO/filter inputs are covered by its corresponding-source archive. AI JavaScript source inputs are locked in package-lock.json; ONNX WASM notices/source revision and matching Eigen MPL source are described in THIRD_PARTY_NOTICES.md.

Before a public binary release, publish the matching repository source and corresponding-source archive beside the XPI. Obtain a separate Mozilla signature for this product. No AMO key, signing secret, account or certificate is stored in this repository. Actions produces developer artifacts; it does not publish a signed release.
