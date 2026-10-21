import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Frame-level i18n must stay complete: the settings window hides its
 * 「该语言未完全翻译」 notice only when every `en` key exists in the locale.
 * This test guards that invariant so a new string cannot ship in one language.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../frontend/workspace");
const source = readFileSync(resolve(root, "i18n.ts"), "utf8");

function catalogKeys(block) {
  return [...block.matchAll(/^\s+"([^"]+)":/gm)].map((match) => match[1]);
}

function block(name) {
  const start = source.indexOf(`const ${name}: Record<string, string> = {`);
  assert.ok(start >= 0, `catalog ${name} exists`);
  const end = source.indexOf("\n};", start);
  return source.slice(start, end);
}

/** Values are read from the compiled object so escapes stay correct. */
function catalogValues(block) {
  const values = {};
  for (const match of block.matchAll(/^\s+"([^"]+)":\s*\n?\s*"((?:[^"\\]|\\.)*)",\s*$/gm))
    values[match[1]] = JSON.parse(`"${match[2]}"`);
  return values;
}

const en = catalogKeys(block("en"));
const zh = catalogValues(block("zh"));
const enValues = catalogValues(block("en"));

test("zh-CN and en define exactly the same keys", () => {
  assert.deepEqual([...catalogKeys(block("zh"))].sort(), [...en].sort());
});

test("no catalog declares the same key twice", () => {
  for (const [name, rows] of [
    ["zh", block("zh")],
    ["en", block("en")],
  ]) {
    const keys = catalogKeys(rows);
    assert.equal(new Set(keys).size, keys.length, `${name} has duplicate keys`);
  }
});

test("every extra locale covers the whole frame catalog", () => {
  const files = readdirSync(resolve(root, "i18nCatalogs")).filter((file) =>
    file.endsWith(".ts"),
  );
  assert.ok(files.length >= 17, `expected 17 locales, found ${files.length}`);
  for (const file of files) {
    const text = readFileSync(resolve(root, "i18nCatalogs", file), "utf8");
    const keys = catalogKeys(text);
    assert.equal(new Set(keys).size, keys.length, `${file} has duplicate keys`);
    const present = new Set(keys);
    const missing = en.filter((key) => !present.has(key));
    const extra = [...present].filter((key) => !en.includes(key));
    assert.deepEqual(missing, [], `${file} is missing frame keys`);
    assert.deepEqual(extra, [], `${file} defines keys the frame never uses`);
  }
});

test("no locale ships an empty or English-copied value for a long string", () => {
  const files = readdirSync(resolve(root, "i18nCatalogs")).filter((file) =>
    file.endsWith(".ts"),
  );
  for (const file of files) {
    const text = readFileSync(resolve(root, "i18nCatalogs", file), "utf8");
    const values = catalogValues(text);
    for (const key of en) {
      const value = values[key];
      assert.ok(typeof value === "string", `${file}: ${key} missing`);
      if (key === "settings.models.endpoint.ph") {
        assert.equal(value, enValues[key], `${file}: placeholders stay literal`);
        continue;
      }
      assert.ok(value.trim().length > 0, `${file}: ${key} is empty`);
    }
  }
});
