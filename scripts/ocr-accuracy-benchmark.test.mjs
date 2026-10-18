import test from 'node:test';
import assert from 'node:assert/strict';
import { editDistance } from './ocr-accuracy-benchmark.mjs';

test('OCR CER edit distance counts Unicode code points, insertions, deletions and substitutions', () => {
  assert.equal(editDistance('猫A', '猫B'), 1);
  assert.equal(editDistance('香港', '香'), 1);
  assert.equal(editDistance('abc', 'zabc!'), 2);
  assert.equal(editDistance('', '字'), 1);
  assert.equal(editDistance('e\u0301', 'é'), 2); // caller normalizes NFC before scoring
});
