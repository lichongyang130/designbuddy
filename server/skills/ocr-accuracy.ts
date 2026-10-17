/** Character-level accuracy helpers shared by the OCR batch skill and the offline benchmark script. */

/** Whitespace-insensitive normalisation used before scoring; the reference text stays untouched. */
export function normalizeForScore(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Levenshtein distance over Unicode code points, so Chinese characters count as one character each. */
export function editDistance(left: string, right: string): number {
  const a = Array.from(left), b = Array.from(right);
  if (a.length < b.length) return editDistance(right, left);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

export type AccuracyScore = { referenceCharacters: number; errors: number; characterErrorRate: number; exactMatch: boolean };

/** Errors are counted against the human-reviewed reference, the convention used by the offline benchmark. */
export function scoreAccuracy(recognized: string, reference: string): AccuracyScore {
  const expected = normalizeForScore(reference);
  const actual = normalizeForScore(recognized);
  const referenceCharacters = Array.from(expected).length;
  if (!referenceCharacters) throw Error('参考文本为空，无法计算字错率。');
  const errors = editDistance(actual, expected);
  return { referenceCharacters, errors, characterErrorRate: errors / referenceCharacters, exactMatch: errors === 0 };
}
