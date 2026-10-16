# Document understanding — layout and OCR increment

This evidence belongs to the first user-requested area only. It records limited DOCX paragraph/table formatting retention and an expanded but still bounded PDF OCR batch. It does **not** certify complex layout reconstruction or finish the document direction.

- DOCX direct formatting test: 12/12 passed. Checks actual fixture DOCX parsing and HTML output for supported indentation, paragraph spacing/line-height, keep-with-next, table grid widths, cell fill and vertical alignment. Unsupported inherited Word styles and original pagination are still not reconstructed.
- PDF batch test: 5/5 passed. A real local OCR worker processed 4 PDFs/8 pages end-to-end, persisted the ZIP/report/receipt, and returned 404 to a foreign owner. Exact original worker artifacts and hashes are in [the batch evidence directory](../pdf-batch-expansion-2026-10-16/).
- Combined focused suite: 21/21 passed. Non-ASR server/API regression: 152/152 passed. Catalog: 9/9. Backend/frontend TypeScript, production build and diff check passed. Existing build warnings remain.
- Real DOCX UI→Worker→artifact download→HTML preview flow: 7/7 Playwright tests passed, including the new direct-formatting CSS assertions and 320/390px checks. This validates only this fixture workflow. The PDF eight-page expansion was verified through the actual API Worker, not the browser UI.
- No real Word renderer or original-document pixel/pagination comparison was available. The AI summary provider tests use mock transport and no real cloud model was configured.

See `results.json` for exact status and source hashes; logs are under `logs/`.
