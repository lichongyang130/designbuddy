import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const desk = (page: Page) => page.getByRole('region', { name: '真实技能执行台' });
async function submit(page: Page, name: string, content: string) {
  await desk(page).getByLabel('上传实际材料').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) });
  await desk(page).getByRole('checkbox', { name: /我同意上传材料/ }).check();
  await desk(page).getByRole('button', { name: '上传并执行技能' }).click();
}
test.afterEach(async ({ page }) => {
  // Remove only this isolated test browser's real skill runs, not existing tasks.
  await page.evaluate(async () => {
    const res = await fetch('/api/skill-runs'); if (!res.ok) return;
    const body = await res.json(); for (const run of body.runs) await fetch(`/api/skill-runs/${run.id}`, { method: 'DELETE' });
  });
});
test('actual CSV upload produces correct downloads, graph preview and persisted run history', async ({ page }) => {
  await page.goto('/experts/data');
  await expect(desk(page).getByText('可执行', { exact: true }).first()).toBeVisible();
  await expect(desk(page).getByRole('button', { name: '上传并执行技能' })).toBeDisabled();
  await desk(page).getByRole('checkbox', { name: /去除所有字段/ }).check();
  await submit(page, 'sales.csv', '产品,金额\n甲,10\n乙,20\n甲,10');
  await expect(desk(page).getByRole('status')).toHaveText('执行成功', { timeout: 20000 });
  await expect(desk(page)).toContainText('实际处理 3 行；交付 2 行');
  const download = page.waitForEvent('download');
  await desk(page).getByRole('button', { name: '下载 analysis.json', exact: true }).click();
  const saved = await download; const report = JSON.parse(await readFile((await saved.path())!, 'utf8'));
  expect(report.columns[1].sumExact).toBe('30'); expect(report.retainedRows).toBe(2);
  await desk(page).getByRole('button', { name: '预览 图表', exact: true }).click();
  await expect(desk(page).getByRole('img', { name: '程序生成的字段概览图' })).toBeVisible();
  await page.reload();
  await expect(desk(page).getByRole('status')).toHaveText('执行成功');
  await desk(page).getByText('执行证据与来源', { exact: true }).click();
  await expect(desk(page)).toContainText('成果已持久化，可以下载');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await desk(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../../.cache/skill-runtime-desktop.png' });
  page.once('dialog', dialog => dialog.accept());
  await desk(page).getByRole('button', { name: '删除运行与文件', exact: true }).click();
  await expect(desk(page)).toContainText('暂无运行记录');
});
test('actual document and PPTX pipelines expose honest scope and downloadable Office files', async ({ page }) => {
  for (const [expert, file, prefix] of [['documents', 'organized.docx', 'PK'], ['slides', 'presentation.pptx', 'PK']]) {
    await page.goto(`/experts/${expert}`);
    await expect(desk(page).getByText('可执行', { exact: true }).first()).toBeVisible();
    await submit(page, 'notes.md', '# 本周汇报\n完成资料核对\n# 下周安排\n继续项目验收');
    await expect(desk(page).getByRole('status')).toHaveText('执行成功', { timeout: 20000 });
    const download = page.waitForEvent('download'); await desk(page).getByRole('button', { name: `下载 ${file}`, exact: true }).click();
    const saved = await download; const bytes = await readFile((await saved.path())!); expect(bytes.subarray(0, 2).toString()).toBe(prefix); expect(bytes.length).toBeGreaterThan(1000);
    if (expert === 'slides') {
      await desk(page).getByRole('button', { name: '预览 页面内容', exact: true }).click();
      await expect(desk(page).locator('iframe')).toHaveAttribute('sandbox', '');
      await expect(desk(page).locator('iframe').contentFrame().getByRole('heading', { name: '页面内容预览（非 PowerPoint 渲染截图）' })).toBeVisible();
    }
  }
});
test('invalid input fails visibly instead of fabricating completed results', async ({ page }) => {
  await page.goto('/experts/data'); await expect(desk(page).getByText('可执行', { exact: true }).first()).toBeVisible();
  await submit(page, 'bad.csv', '金额,金额\n10,20');
  await expect(desk(page).getByRole('status')).toHaveText('执行失败', { timeout: 20000 });
  await expect(desk(page)).toContainText('字段名必须非空且唯一');
  await expect(desk(page).getByRole('button', { name: /^下载 / })).toHaveCount(0);
});
test('every listed QA skill has a real backend executor and presets are not presented as installation', async ({ page }) => {
  // All QA skills now have a real executor, so none of them may stay in the
  // "unsupported" state that used to hide them from the picker.
  await page.goto('/experts/qa'); await expect(desk(page).getByText('可执行', { exact: true }).first()).toBeVisible();
  await expect(desk(page).getByText('未支持', { exact: true })).toHaveCount(0);
  const picker = desk(page).getByLabel('执行技能');
  await expect(picker.getByRole('option', { name: '浏览器与接口验收' })).toHaveCount(1);
  await picker.selectOption('web.audit');
  await expect(picker).toHaveValue('web.audit');
  await page.goto('/skills'); await expect(page.getByRole('heading', { level: 1, name: '让每项技能，都对应真实交付' })).toBeVisible();
  await expect(page.locator('.skill-tile-stats')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '添加技能', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /已安装/ })).toHaveCount(0);
});
for (const width of [320, 375, 768]) {
  test(`real execution UI fits ${width}px without altering homepage drafts`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/experts/data');
    await expect(desk(page).getByText('可执行', { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await submit(page, 'data.csv', '项目,金额\n服务,30');
    await expect(desk(page).getByRole('status')).toHaveText('执行成功', { timeout: 20000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 375) { await desk(page).scrollIntoViewIfNeeded(); await page.screenshot({ path: '../../.cache/skill-runtime-mobile.png' }); }
  });
}
