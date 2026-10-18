# Expanded PDF batch OCR — verification

`results.json` records the four-PDF/eight-page actual Worker result, input and output artifact hashes, per-PDF page counts, source hashes and owner-isolation check. `artifacts/` holds the uploaded fixture ZIP plus the exact batch output ZIP, report and service receipt. All eight pages were OCRed using the local Chinese/English OCR path and had nonempty recognition results.

The fixture is synthetic (`项目验收 SALES 12345` and `INVOICE PAGE n TOTAL 67890`), produced by the repository's test fixture generator. Passing this is execution/lineage evidence, **not** a general accuracy guarantee or real-business-document acceptance. OCR results still require human review.

Reproduce after building TypeScript:

```sh
corepack pnpm exec tsc -p server/tsconfig.local.json
node scripts/verify-pdf-batch-expansion.cjs
node --test server/skills/pdf-batch.test.cjs
```

Batch limits: 2–4 top-level PDFs, ZIP≤2MB, expanded input≤6MB, each PDF≤2MB, up to 8 pages total, OCR outputs≤8MB, batch worker deadline 120s. Any file failure aborts the whole batch; no partial artifacts are persisted.
