# Business OCR accuracy benchmark

## Status

**Not yet a business-accuracy acceptance result.** The repository currently has synthetic OCR fixtures and two homepage/design PDFs; neither is a representative business-document corpus with independently human-corrected page text. No business CER/WER score or pass threshold is claimed. Do not label OCR accurate based on Tesseract confidence, synthetic fixtures, or this harness's unit tests.

## Local, hash-locked benchmark

The benchmark runner executes the existing production `pdf.ocr` skill locally and compares its actual per-page output with page text that a human has checked against the original PDF. It makes no network calls and omits source/reference/transcript text from the report. Each PDF's SHA-256 must match the reviewed manifest; changing a source invalidates the reference rather than silently scoring another file.

1. Place approved, de-identified PDFs and a manifest in a local directory outside Git. The current OCR skill accepts a PDF up to 2 MB and 6 pages. Include all representative page types, not just clean digital text: scans, rotation, faint print, tables, mixed Chinese/English, numbers, names, stamps, and difficult pages where those occur in the real workload.
2. For every scored page, have a reviewer transcribe all visible text from the PDF image (not from the OCR output). Have a second reviewer independently check it, resolve disagreements, and record the approved text. Preserve punctuation, identifiers, amounts, dates, and symbols exactly. Exclude blank pages only if they are explicitly labelled as blank; otherwise include them and record the expected empty page in a future schema version.
3. Create a manifest:

```json
{
  "version": 1,
  "referenceStatus": "human-reviewed",
  "documents": [
    {
      "file": "sample-01.pdf",
      "sha256": "<64-character SHA-256 of the exact PDF bytes>",
      "pages": [
        { "page": 1, "referenceText": "<independently checked full visible text for page 1>" }
      ]
    }
  ]
}
```

The file name is resolved relative to the manifest. Keep the corpus and manifest private; they may contain sensitive reference text. The runner writes only hashes, per-page edit counts/rates, exact-page flags and diagnostic engine confidence to its report.

4. Run from the repository root:

```sh
corepack pnpm exec tsc -p server/tsconfig.local.json
corepack pnpm run ocr:benchmark /private/path/ocr-manifest.json /private/path/ocr-report.json
```

The report path must not already exist; this prevents accidental overwrite. To check only the metric implementation:

```sh
corepack pnpm run test:ocr-benchmark
```

## Report interpretation

- The primary metric is micro-averaged character error rate (CER): Unicode-code-point Levenshtein edits divided by reference characters, after NFC normalization and whitespace collapse. Punctuation, case, numbers and symbols are retained.
- Per-page CER and exact-page rate make weak pages visible instead of hiding them in an average. OCR confidence is diagnostic only, not correctness.
- This is a measurement harness, not an automatic acceptance threshold. Agree the required sample size, document/page strata, handling of blank pages, confidence interval, and pass thresholds with the business owner before claiming acceptance. A small corpus—even if manually corrected—does not establish accuracy for unrepresented document types.
- The current schema and skill cannot score blank-reference pages, documents over 2 MB, or PDFs over 6 pages. Those require deliberate extension before such documents are included; do not omit difficult pages without disclosing the exclusion.
