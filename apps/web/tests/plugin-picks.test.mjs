import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { MODE_SKILL_IDS, rankPicks } from "../src/components/pluginPicks.ts";

const require = createRequire(import.meta.url);
const { runtimeCatalog } = require("../../../dist/local/server/skills/runtime-catalog.js");

const catalogue = runtimeCatalog();
const byId = new Map(catalogue.map((skill) => [skill.id, skill]));

test("every recommended skill exists in the server catalogue", () => {
  for (const [mode, ids] of Object.entries(MODE_SKILL_IDS)) {
    assert.ok(ids.length > 0, `${mode} recommends something`);
    for (const id of ids) assert.ok(byId.has(id), `${mode} recommends unknown skill ${id}`);
  }
});

test("a recommendation never points at a skill the server cannot run", () => {
  const picks = rankPicks(catalogue, [], "design", 4);
  assert.ok(picks.length >= 2, "design mode has runnable skills");
  for (const pick of picks) assert.equal(pick.skill.status, "ready");
});

test("skills from enabled bundles come first, and at most two are shown", () => {
  const bundles = [{ skills: [{ id: "table.calculate" }] }];
  const picks = rankPicks(catalogue, bundles, "office");
  assert.equal(picks.length, 2);
  assert.equal(picks[0].skill.id, "table.calculate", "an enabled skill is promoted");
  assert.equal(picks[0].installed, true);
  assert.equal(picks[1].installed, false);
});

test("an empty or unavailable catalogue yields no card instead of an empty shell", () => {
  assert.deepEqual(rankPicks([], [], "code"), []);
  const fake = [{ id: "web.audit", name: "x", status: "unavailable", accepts: [], outputs: [] }];
  assert.deepEqual(rankPicks(fake, [], "code"), []);
});
