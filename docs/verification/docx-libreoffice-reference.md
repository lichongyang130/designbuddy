# DOCX LibreOffice page-reference renderer

## What is available

The project pins `@deepseek-ai/libreoffice-kit@0.2.0` as a development dependency (package declares MPL-2.0). It uses the LibreOffice document engine to rasterize Office pages and writes PNGs plus a hash manifest. On the current Linux target the package reports `backend: wasm` and `rasterEngine: libreoffice`: this is a LibreOffice WebAssembly build, **not** a desktop-native LibreOffice binary and **not** Microsoft Word.

A server regression test renders a generated DOCX fixture through the package, verifies that the engine identifies as LibreOffice, checks the PNG dimensions and manifest, and confirms page output. This proves the renderer can run here; it does not establish fidelity for every real Word document.

## Render a user-provided document

After `corepack pnpm install`, run:

```sh
node scripts/render-docx-libreoffice-reference.mjs \
  /absolute/path/to/source.docx \
  /absolute/path/to/new-output-directory
```

The output directory must not already exist. It contains the renderer's `manifest.json`, one PNG per physical page, and `libreoffice-reference.json` with source SHA-256, page image hashes/dimensions, renderer API/engine identity and missing-font information. The script does not upload the file. Keep source documents and output pages outside Git if they are sensitive.

This creates a genuine LibreOffice-engine visual reference for a specific source hash. Compare it to the app preview and verify against the original in Word/LibreOffice. It does not by itself provide a Word desktop comparison, complete OOXML feature coverage, or a business acceptance result; missing fonts and differences between the LibreOffice WebAssembly build and desktop/native Word must be recorded.

The development dependency includes a large (~146 MB installed WASM engine). Production web output does not bundle it; it is used for local validation. If a native desktop LibreOffice/Word equivalence is mandatory, use the matching native desktop engine and record its exact version and fonts as a separate reference run.
