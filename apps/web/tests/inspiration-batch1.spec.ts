import { test, expect } from "@playwright/test";
import { GUEST_STORAGE } from "./auth-helpers";

test.use({ storageState: GUEST_STORAGE });

// Batch 1: HyperFrames ×4 + 实时产物 ×4 (each category now has 5 templates).

test("HyperFrames category shows 5 templates with AI covers", async ({
  page,
}) => {
  await page.goto("/inspiration");
  await page.getByRole("button", { name: "HyperFrames" }).click();
  const cards = page.locator(".sample-card");
  await expect(cards).toHaveCount(5);
  await expect(
    cards.filter({ hasText: "SPOTLIGHT · 新功能分帧导览" }),
  ).toHaveCount(1);
  await expect(
    page.locator('.sample-card:has-text("SPOTLIGHT") .ai-cover img'),
  ).toHaveCount(1);
});

test("实时产物 category shows 5 templates with AI covers", async ({
  page,
}) => {
  await page.goto("/inspiration");
  await page.getByRole("button", { name: "实时产物" }).click();
  const cards = page.locator(".sample-card");
  await expect(cards).toHaveCount(5);
  await expect(
    cards.filter({ hasText: "PULSE · 实时数据大屏" }),
  ).toHaveCount(1);
  await expect(
    page.locator('.sample-card:has-text("PULSE") .ai-cover img'),
  ).toHaveCount(1);
});

test("hf-tour walks through spotlight steps and edits copy", async ({
  page,
}) => {
  await page.goto("/inspiration/hf-tour");
  await expect(page.getByText("第 1 步 · 一眼看到健康度")).toBeVisible();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByText("第 2 步 · 趋势不用猜")).toBeVisible();
  await page.getByLabel("当前步骤标题").fill("第 2 步 · 自定义标题");
  await expect(page.getByText("第 2 步 · 自定义标题")).toBeVisible();
  await page.reload();
  await expect(page.getByText("第 2 步 · 自定义标题")).toBeVisible();
});

test("hf-story plays chapters with animated stats", async ({ page }) => {
  await page.goto("/inspiration/hf-story");
  await expect(
    page.getByRole("heading", { name: "一家社区咖啡店的线上化实验" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一章", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "三个月，外卖订单翻了 18 倍" }),
  ).toBeVisible();
  await page.getByLabel("本章关键数字").fill("26");
  await expect(page.getByRole("button", { name: "重播本章动画" })).toBeVisible();
});

test("hf-quest branches to an ending and records the route", async ({
  page,
}) => {
  await page.goto("/inspiration/hf-quest");
  await page.getByText("接起那通电话").click();
  await page.getByText("答应赴约，琴还在老家").click();
  await expect(page.getByText("结局 A · 已收录")).toBeVisible();
  await expect(page.getByText("已解锁结局 1 / 3")).toBeVisible();
  await page.reload();
  await expect(page.getByText("已解锁结局 1 / 3")).toBeVisible();
});

test("hf-lesson plays chapters and grades the quiz", async ({ page }) => {
  await page.goto("/inspiration/hf-lesson");
  await expect(page.getByText("第 1 节 · 什么是好文案")).toBeVisible();
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByText("3 天学会做周报，老板追着问").click();
  await expect(page.getByText("回答正确。")).toBeVisible();
  await expect(page.getByText("随堂测验 · 1 / 3 分")).toBeVisible();
});

test("live-board streams metrics and exports a snapshot", async ({
  page,
}) => {
  await page.goto("/inspiration/live-board");
  await expect(page.getByText("今日经营总览")).toBeVisible();
  await page.getByRole("button", { name: "暂停推送", exact: true }).click();
  await expect(page.getByText("数据流已暂停")).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出快照 CSV" }).click();
  expect((await pending).suggestedFilename()).toBe("pulse-snapshot.csv");
});

test("live-event counts down, checks in and draws a winner", async ({
  page,
}) => {
  await page.goto("/inspiration/live-event");
  await expect(page.getByText("设计引擎 3.0，来了")).toBeVisible();
  await page.getByLabel("签到姓名").fill("测试员甲");
  await page.getByRole("button", { name: "签到", exact: true }).click();
  await expect(page.getByText("现场签到 · 已到 1 人")).toBeVisible();
  await page.getByRole("button", { name: "抽取全场大奖" }).click();
  await expect(page.getByText("🎉 测试员甲")).toBeVisible({ timeout: 10000 });
});

test("live-form collects answers and shows live results", async ({
  page,
}) => {
  await page.goto("/inspiration/live-form");
  await page.getByText("几乎每天").click();
  await page.getByText("搭版式").click();
  await page.getByText("一键套用").click();
  await page.getByRole("button", { name: "提交问卷" }).click();
  await expect(page.getByText("提交成功，结果已实时更新。")).toBeVisible();
  await expect(page.getByText("（我的选择）").first()).toBeVisible();
});

test("live-status toggles a service and logs the incident", async ({
  page,
}) => {
  await page.goto("/inspiration/live-status");
  await expect(page.getByText("所有系统正常运行")).toBeVisible();
  await page.getByRole("button", { name: /支付通道/ }).click();
  await expect(page.getByText("部分服务出现波动")).toBeVisible();
  await expect(page.getByText("支付通道出现波动")).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出事件线" }).click();
  expect((await pending).suggestedFilename()).toBe("steady-incidents.txt");
});
