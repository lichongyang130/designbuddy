import test from "node:test";
import assert from "node:assert/strict";
import { matchRuntimeSkill, selectionGate, skillGate } from "../src/components/useRuntimeSkill.ts";

const skill = (overrides = {}) => ({
  id: "table.analyze",
  name: "表格清洗与统计",
  status: "ready",
  accepts: [".csv", ".xlsx"],
  outputs: ["XLSX"],
  description: "读表并统计",
  ...overrides,
});

test("a ready file skill sends only once a file is attached", () => {
  assert.equal(skillGate(skill(), 1), null, "one attachment is enough");
  const blocked = skillGate(skill(), 0);
  assert.equal(blocked.action.kind, "upload");
  assert.match(blocked.blocked, /\.csv/);
  assert.match(blocked.blocked, /\.xlsx/);
});

test("the skill workflow may send first and pick the file on the task page", () => {
  assert.equal(skillGate(skill(), 0, { requireFile: false }), null);
});

test("an unavailable skill is refused with the server's own reason", () => {
  const blocked = skillGate(skill({ id: "document.summarize", name: "文档语义摘要", status: "unavailable", description: "服务端AI_API_KEY/OPENAI_API_KEY未配置；不会生成伪摘要。" }), 3);
  assert.equal(blocked.action.kind, "clear");
  assert.match(blocked.blocked, /AI_API_KEY/, "the reason is passed through, not rewritten");
});

test("no selection never blocks sending", () => {
  assert.equal(skillGate(undefined, 0), null);
  assert.equal(skillGate(skill({ status: "unavailable" }), 0)?.action.kind, "clear");
});

test("a plugin chip that fills a display name still resolves to the real skill", () => {
  const skills = [skill(), skill({ id: "web.audit", name: "HTML结构与可访问性静态检查", accepts: [".html"] })];
  assert.equal(matchRuntimeSkill(skills, "表格清洗与统计")?.id, "table.analyze", "bundle chips fill names");
  assert.equal(matchRuntimeSkill(skills, "table.analyze")?.id, "table.analyze", "⌘K fills ids");
  assert.equal(matchRuntimeSkill(skills, "不存在的技能"), undefined);
});

test("a catalogue entry with no executor is blocked instead of faking a skill run", () => {
  const blocked = selectionGate({ unknown: true }, 0);
  assert.equal(blocked.action.kind, "clear");
  assert.match(blocked.blocked, /没有可执行/);
  assert.equal(selectionGate({ skill: skill() }, 1), null, "a resolved skill is judged normally");
});

test("while the catalogue is still loading nothing is blocked", () => {
  assert.equal(selectionGate({ unknown: false }, 0), null);
});
