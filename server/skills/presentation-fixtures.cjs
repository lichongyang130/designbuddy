// CC0 synthetic fixtures. No real business/customer claims. Used by tests and the sample generator.
function presentationFixture(scenario = 'business-report', theme = 'consulting') {
  const label = { 'business-report': '经营汇报', 'pitch-deck': '融资路演', 'data-analysis': '数据分析' }[scenario];
  const narrative = '合成演示材料，CC0公开测试样本，不是真实企业业绩或市场研究。\n项目面向小型团队，试点验证材料归档流程。收入和成本单位均为万元。\n2026年第三季度包含七月、八月、九月。当前样本仅三个观测点，不能推断因果或市场规模。\n下一步建议核对样本口径，再讨论试点范围和风险。具体预算、融资金额、客户名单和批准日期尚未提供。';
  const csv = '月份,收入,成本\n七月,120,80\n八月,150,90\n九月,180,100\n';
  const request = { schemaVersion: 1, brief: { goal: `为决策会议制作${label}；仅用材料，不编造数据；合成样本不用于真实募资或财务披露。`, audience: '管理层与评审人员', scenario, theme, slideCount: 8 }, files: [{ name: 'brief.md', base64: Buffer.from(narrative).toString('base64') }, { name: 'observations.csv', base64: Buffer.from(csv).toString('base64') }] };
  const common = { speakerNotes: '这是合成演示样本。对照材料核对事实与口径，未提供的信息不作肯定结论。', sourceRefs: ['source-1-p-1', 'source-1-p-2', 'source-1-p-3', 'source-1-p-4'] };
  const dataCommon = { ...common, sourceRefs: ['source-2-table-1', 'source-1-p-2'] };
  const binding = (rows, columns) => ({ datasetId: 'source-2-table-1', rows, columns });
  const proposal = { title: `${label} · 合成样本`, storyline: '说明目标与边界，展示可核对证据，识别限制并请求确认下一步。', missingInformation: ['具体预算、融资金额、客户名单和批准日期未提供。'], slides: [
    { ...common, type: 'cover', title: `${label} · 合成样本`, subtitle: '仅用于生成链路验收，不是真实商业披露' },
    { ...common, type: 'bullets', title: '先明确目标与证据边界', bullets: ['面向小型团队的材料归档试点', '经营数据来自上传表格', '合成材料不代表真实企业业绩'] },
    { ...dataCommon, type: 'metrics', title: '七月经营观测', items: [{ label: '收入（万元）', binding: binding([2], ['收入']) }, { label: '成本（万元）', binding: binding([2], ['成本']) }] },
    { ...dataCommon, type: 'chart', title: '收入与成本逐月记录', chartType: 'bar', binding: binding([2, 3, 4], ['月份', '收入', '成本']) },
    { ...dataCommon, type: 'table', title: '原始明细可逐项核对', binding: binding([2, 3, 4], ['月份', '收入', '成本']) },
    { ...common, type: 'comparison', title: '证据与待补充项分开呈现', columns: [{ heading: '已提供', bullets: ['观测月份与收入成本', '试点目标与样本边界'] }, { heading: '待确认', bullets: ['预算与批准日期', '客户证据与融资金额'] }] },
    { ...common, type: 'timeline', title: '建议的复核与决策顺序', items: [{ label: '核对材料', body: '确认合成样本及字段口径' }, { label: '复核风险', body: '识别缺失信息与推断边界' }, { label: '讨论试点', body: '范围和日期需批准后明确' }] },
    { ...common, type: 'bullets', title: '请求确认下一步', bullets: ['确认可用材料及其授权范围', '补齐预算与决策条件', '逐页核对后再讨论正式发布'] },
  ] };
  return { request, proposal, bytes: Buffer.from(JSON.stringify(request)) };
}
module.exports = { presentationFixture };
