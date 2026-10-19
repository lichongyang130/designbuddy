const { presentationFixture } = require("./presentation-fixtures.cjs");
function directedFixture() {
  const f = presentationFixture();
  f.request.brief = {
    ...f.request.brief,
    layoutStyle: "adaptive",
    narrativeMode: "directed",
  };
  f.proposal.schemaVersion = 2;
  f.proposal.slides.forEach(
    (s, i) =>
      (s.design = {
        layout: "auto",
        nature: i === 6 ? "recommendation" : "pending",
      }),
  );
  const jobs = [
    ["opening", "focus", "statement"],
    ["explanation", "explain", "parallel"],
    ["evidence", "verify", "data"],
    ["evidence", "verify", "data"],
    ["evidence", "verify", "data"],
    ["options", "explain", "contrast"],
    ["explanation", "explain", "sequence"],
    ["decision", "focus", "criteria"],
  ];
  const direction = {
    schemaVersion: 1,
    decision: "讨论合成样本试点，不代表批准。",
    argument: "目标边界、原始观测、限制、建议复核与决策。",
    pages: jobs.map(([role, pace, expression], i) => ({
      role,
      pace,
      expression,
      message: f.proposal.slides[i].title,
      evidenceRefs: f.proposal.slides[i].sourceRefs,
      reason: "只从合成材料选择表达；保留原有正文与绑定。",
      boundary: "这是合成测试，不推断真实业绩、因果或批准事实。",
      ...(i === 6 ? { sequence: { basis: "proposal" } } : {}),
    })),
  };
  f.proposal.direction = direction;
  f.bytes = Buffer.from(JSON.stringify(f.request));
  return { ...f, direction };
}
module.exports = { directedFixture };
