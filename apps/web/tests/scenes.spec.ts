import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  expectMode,
  expectWorkspace,
  openScenePreview,
  setMode,
  setPermission,
  setWorkspace,
} from "./helpers/home";
const groups = [
  {
    mode: "办公提效",
    shortcuts: ["文档整理", "数据表格", "会议纪要", "周报总结", "汇报PPT"],
    scenes: ["会议纪要", "周报生成", "表格分析", "汇报PPT", "邮件撰写"],
  },
  {
    mode: "网页应用",
    shortcuts: ["企业官网", "活动页面", "产品原型", "数据看板", "实用工具"],
    scenes: ["企业官网", "管理后台", "接口开发", "报错排查", "单元测试"],
  },
  {
    mode: "设计制作",
    shortcuts: ["海报配图", "产品展示", "社媒内容", "品牌物料", "信息图表"],
    scenes: ["App原型", "官网界面", "活动海报", "品牌视觉", "营销策划"],
  },
];
async function open(
  page: Page,
  _mode: string,
  scene: string,
  _interactive = true,
) {
  // The 15 samples used to be cards on the launcher. They are still interactive
  // demos, now opened from the search palette; the extra arguments stay so the
  // call sites below keep reading as before.
  return openScenePreview(page, scene);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("pinning a mode by hand keeps the draft, attachments, model and settings", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(chat|generation)$/.test(request.url())) requests.push(request.url());
  });
  const prompt = page.getByRole("textbox", { name: "任务描述", exact: true });
  await prompt.fill("保留我的原始需求");
  await setWorkspace(page, "个人空间");
  await setPermission(page, "需要确认后执行");
  await page
    .locator('input.visually-hidden-input[type="file"]')
    .setInputFiles({
      name: "keep.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("保留附件"),
    });
  const modelTrigger = page.getByRole("button", { name: "选择大模型", exact: true });
  await modelTrigger.click();
  const modelOption = page
    .getByRole("dialog", { name: "选择大模型", exact: true })
    .getByRole("option")
    .last();
  const modelName = ((await modelOption.textContent()) ?? "").trim().split(/\s+/)[0];
  await modelOption.click();
  await expect(modelTrigger).toContainText(modelName);
  for (const group of groups) {
    await setMode(page, group.mode);
    // A hand-picked mode must survive the rest of the draft being left alone.
    await expectMode(page, group.mode);
    await expect(prompt).toHaveValue("保留我的原始需求");
    await expect(page.locator(".attachment-chip")).toContainText("keep.txt");
    await expect(modelTrigger).toContainText(modelName);
    await expectWorkspace(page, "个人空间");
    await expect(page.getByLabel("任务权限", { exact: true })).toHaveValue(
      "需要确认后执行",
    );
  }
  expect(requests).toEqual([]);
});

test("the mode changes only when someone changes it", async ({ page }) => {
  const prompt = page.getByRole("textbox", { name: "任务描述", exact: true });
  await prompt.fill("帮我写一份周报");
  await setMode(page, "设计制作");
  // Typing a very different sentence must not silently re-route the task.
  await prompt.fill("帮我修一个 React 组件的 bug，顺便写一份周报");
  await expectMode(page, "设计制作");
  // Clearing the draft leaves the choice alone; the next explicit pick wins.
  await prompt.fill("");
  await expectMode(page, "设计制作");
  await setMode(page, "网页应用");
  await expectMode(page, "网页应用");
});

test("replacement asks first; cancel preserves text and preview; confirm transfers only the prompt", async ({
  page,
}) => {
  const prompt = page.getByRole("textbox", { name: "任务描述" });
  await prompt.fill("不要覆盖这段内容");
  // A sample chip replaces the draft only after a confirmation.
  const chip = page.locator(".home-suggestion").first();
  page.once("dialog", (dialog) => dialog.dismiss());
  await chip.click();
  await expect(prompt).toHaveValue("不要覆盖这段内容");
  const modal = await open(page, "设计制作", "品牌视觉");
  await modal.getByLabel("品牌名称", { exact: true }).fill("LOCAL ONLY");
  page.once("dialog", (dialog) => dialog.dismiss());
  await modal.getByRole("button", { name: "使用此场景" }).click();
  await expect(modal).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await modal.getByRole("button", { name: "使用此场景" }).click();
  await expect(modal).toHaveCount(0);
  await expect(prompt).toBeFocused();
  await expect(prompt).toHaveValue(/品牌视觉方案/);
  await expect(prompt).not.toHaveValue(/LOCAL ONLY/);
  await expectMode(page, "设计制作");
  await expect(page).toHaveURL(/\/$/);
});

test("preview mode, reset, Escape, focus trap and backdrop work", async ({
  page,
}) => {
  const modal = await open(page, "办公提效", "会议纪要", false);
  await expect(modal.locator(".scene-preview-canvas")).not.toHaveAttribute(
    "inert",
    "",
  );
  await modal.getByLabel("纪要标题", { exact: true }).fill("临时标题");
  page.once("dialog", (d) => d.accept());
  await modal.getByRole("button", { name: "重置作品", exact: true }).click();
  await expect(modal.getByLabel("纪要标题", { exact: true })).toHaveValue(
    "AURA ONE · 产品发布评审",
  );
  await modal.getByRole("button", { name: "使用此场景" }).focus();
  await page.keyboard.press("Tab");
  await expect(
    modal.getByRole("button", { name: "关闭场景预览" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(modal.getByRole("button", { name: "使用此场景" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "预览会议纪要" }),
  ).toBeFocused();
  await open(page, "办公提效", "会议纪要");
  await page.mouse.click(1, 1);
  await expect(modal).toHaveCount(0);
});

const checks: Record<string, (modal: Locator) => Promise<void>> = {
  会议纪要: async (modal) => {
    await modal
      .getByLabel("完成提交首页实物摄影与移动端稿", { exact: true })
      .check();
    await expect(modal.locator(".pd-meeting-paper")).toContainText(
      "2 / 3 已完成",
    );
    await modal.getByLabel("会议正文", { exact: true }).fill("新的讨论结论");
    await modal.getByLabel("新增行动事项", { exact: true }).fill("测试新行动");
    await modal.getByRole("button", { name: "添加事项", exact: true }).click();
    await expect(modal.getByLabel("行动事项4", { exact: true })).toHaveValue(
      "测试新行动",
    );
    await modal.getByRole("button", { name: "会议资料", exact: true }).click();
    await expect(modal.locator(".pd-material img")).toBeVisible();
    const pending = modal.page().waitForEvent("download");
    await modal
      .getByRole("button", { name: "导出纪要 ↓", exact: true })
      .click();
    expect((await pending).suggestedFilename()).toBe("meeting-notes.md");
  },
  周报生成: async (modal) => {
    await modal.getByLabel("完成数量", { exact: true }).fill("5");
    await modal.getByLabel("目标数量", { exact: true }).fill("20");
    await expect(modal.locator(".pd-report-metrics")).toContainText("25%");
    await modal.getByLabel("目标数量", { exact: true }).fill("0");
    await expect(modal.locator(".pd-report-metrics")).not.toContainText(
      "Infinity",
    );
    await expect(
      modal.getByRole("img", { name: "季度每周交付数量趋势" }),
    ).toHaveCount(1);
  },
  表格分析: async (modal) => {
    await expect(
      modal.getByRole("table", { name: "销售明细" }).locator("tbody tr"),
    ).toHaveCount(6);
    await modal.getByLabel("SL-2601订单数", { exact: true }).fill("100");
    await modal.getByLabel("月份", { exact: true }).selectOption("07");
    await modal.getByLabel("渠道", { exact: true }).selectOption("官网");
    await expect(
      modal.getByRole("table", { name: "销售明细" }).locator("tbody tr"),
    ).toHaveCount(2);
    await expect(
      modal.locator(".pd-analytics-metrics article").first(),
    ).toContainText("¥175,305");
    await modal.getByLabel("渠道", { exact: true }).selectOption("all");
    await modal.getByLabel("月份", { exact: true }).selectOption("all");
    await modal.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(modal.locator(".pd-pagination")).toContainText("2 / 3");
    const pending = modal.page().waitForEvent("download");
    await modal
      .getByRole("button", { name: "导出 CSV ↓", exact: true })
      .click();
    expect((await pending).suggestedFilename()).toBe("channel-sales.csv");
  },
  汇报PPT: async (modal) => {
    await expect(modal.locator(".pd-slide-nav button[aria-label]")).toHaveCount(
      8,
    );
    await expect(modal.locator(".ws-slide > img")).toBeVisible();
    await modal.getByLabel("幻灯片标题", { exact: true }).fill("新的产品提案");
    await modal.getByRole("button", { name: "播放演示", exact: true }).click();
    for (let i = 1; i < 8; i++) {
      await modal
        .getByRole("button", { name: "下一页 →", exact: true })
        .click();
      await expect(modal.locator(".ws-slide footer span")).toHaveText(
        String(i + 1).padStart(2, "0"),
      );
    }
    await expect(
      modal.getByRole("button", { name: "下一页 →", exact: true }),
    ).toBeDisabled();
  },
  邮件撰写: async (modal) => {
    await modal.getByRole("button", { name: "编辑", exact: true }).click();
    await modal.getByLabel("收件地址", { exact: true }).fill("invalid");
    await modal.getByRole("button", { name: "检查格式", exact: true }).click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("邮箱格式不正确");
    await modal
      .getByLabel("收件地址", { exact: true })
      .fill("user@example.com");
    await modal.getByLabel("邮件主题", { exact: true }).fill("新的产品评审");
    await modal.getByRole("button", { name: "检查格式", exact: true }).click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("草稿未发送");
    await modal.getByRole("button", { name: "预览", exact: true }).click();
    await expect(modal.locator(".pd-email-letter h1")).toHaveText(
      "新的产品评审",
    );
  },
  企业官网: async (modal) => {
    await expect(modal.locator(".pd-energy-hero > img")).toBeVisible();
    await modal.getByRole("button", { name: "项目", exact: true }).click();
    await expect(modal.locator(".pd-energy-project-feature")).toContainText(
      "海岸清洁能源计划",
    );
    await modal.getByRole("button", { name: "联系", exact: true }).click();
    await modal
      .getByRole("button", { name: "检查咨询表单 →", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("请填写联系人与有效邮箱");
    await modal.getByLabel("联系人", { exact: true }).fill("测试用户");
    await modal
      .getByLabel("联系邮箱", { exact: true })
      .fill("test@example.com");
    await modal
      .getByRole("button", { name: "检查咨询表单 →", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("不提交线索");
  },
  管理后台: async (modal) => {
    await expect(
      modal.getByRole("table", { name: "业务订单" }).locator("tbody tr"),
    ).toHaveCount(6);
    await modal.getByLabel("搜索订单", { exact: true }).fill("AU-1048");
    await expect(
      modal.getByRole("table", { name: "业务订单" }).locator("tbody tr"),
    ).toHaveCount(1);
    await modal
      .getByRole("button", { name: "查看订单AU-1048", exact: true })
      .click();
    await expect(modal.getByRole("region", { name: "订单详情" })).toContainText(
      "待处理",
    );
    await modal
      .getByRole("button", { name: "模拟推进状态", exact: true })
      .click();
    await expect(modal.getByRole("region", { name: "订单详情" })).toContainText(
      "已发货",
    );
    await modal.getByLabel("订单状态", { exact: true }).selectOption("待处理");
    await expect(modal.locator(".pd-order-table-card")).toContainText(
      "没有匹配的订单",
    );
  },
  接口开发: async (modal) => {
    const run = modal.getByRole("button", { name: "运行模拟 ↗", exact: true });
    await run.click();
    await expect(modal.locator(".pd-api-response")).toContainText(
      "200 SUCCESS",
    );
    await modal
      .getByLabel("接口路径", { exact: true })
      .fill("/v1/orders/missing");
    await run.click();
    await expect(modal.locator(".pd-api-response")).toContainText("404 ERROR");
    await modal.getByLabel("HTTP 方法", { exact: true }).selectOption("POST");
    await modal.getByLabel("接口路径", { exact: true }).fill("/v1/orders");
    await modal.getByRole("button", { name: "正文", exact: true }).click();
    await modal.getByLabel("JSON 请求正文", { exact: true }).fill("{broken");
    await run.click();
    await expect(modal.locator(".pd-api-response")).toContainText("400 ERROR");
    await modal
      .getByLabel("JSON 请求正文", { exact: true })
      .fill('{"customer":"本地客户","quantity":0}');
    await run.click();
    await expect(modal.locator(".pd-api-response")).toContainText("422 ERROR");
    await modal
      .getByLabel("JSON 请求正文", { exact: true })
      .fill('{"customer":"本地客户","quantity":2}');
    await run.click();
    await expect(modal.locator(".pd-api-response")).toContainText(
      "201 SUCCESS",
    );
    await expect(modal.getByLabel("接口响应", { exact: true })).toContainText(
      '"persisted": false',
    );
    await modal.getByRole("button", { name: "身份", exact: true }).click();
    await modal.getByLabel("携带演示身份", { exact: true }).uncheck();
    await run.click();
    await expect(modal.locator(".pd-api-response")).toContainText("401 ERROR");
  },
  报错排查: async (modal) => {
    await modal
      .getByRole("button", { name: "▶ 运行案例", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("TypeError");
    await modal
      .getByRole("button", { name: "应用建议修复", exact: true })
      .click();
    await modal
      .getByRole("button", { name: "▶ 运行案例", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("执行结果：匿名用户");
    await modal.getByLabel("运行输入", { exact: true }).selectOption("valid");
    await modal
      .getByRole("button", { name: "▶ 运行案例", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("执行结果：林晓");
    await modal.getByRole("button", { name: /空列表产生无效均值/ }).click();
    await modal
      .getByRole("button", { name: "▶ 运行案例", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("NaN");
    await modal
      .getByRole("button", { name: "应用建议修复", exact: true })
      .click();
    await modal
      .getByRole("button", { name: "▶ 运行案例", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("执行结果：0");
  },
  单元测试: async (modal) => {
    await modal
      .getByRole("button", { name: "▶ 运行测试", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("3 / 4 通过");
    await modal.getByLabel("启用边界修复", { exact: true }).check();
    await modal
      .getByRole("button", { name: "▶ 运行测试", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("4 / 4 通过");
    await modal.getByRole("button", { name: /quantity.spec.ts/ }).click();
    await modal
      .getByRole("button", { name: "▶ 运行测试", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("1 / 4 通过");
    await modal.getByLabel("启用边界修复", { exact: true }).check();
    await modal
      .getByRole("button", { name: "▶ 运行测试", exact: true })
      .click();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("4 / 4 通过");
  },
  App原型: async (modal) => {
    await modal.getByRole("button", { name: /LAKE CABIN 湖景木屋/ }).click();
    await modal.getByRole("button", { name: "收藏客房", exact: true }).click();
    await modal.getByRole("button", { name: "♡ 收藏", exact: true }).click();
    await expect(modal.locator(".pd-room-card")).toHaveCount(1);
    await modal.locator(".pd-room-card").click();
    await modal
      .getByRole("button", { name: "选择日期 →", exact: true })
      .click();
    await modal.getByLabel("入住人姓名", { exact: true }).fill("测试住客");
    await modal.getByLabel("离店日期", { exact: true }).fill("2026-10-30");
    await modal
      .getByRole("button", { name: "生成预约预览", exact: true })
      .click();
    await expect(modal.getByRole("alert")).toContainText("离店须晚于入住");
    await modal.getByLabel("离店日期", { exact: true }).fill("2026-11-03");
    await expect(modal.locator(".pd-booking-total")).toContainText("¥2,560");
    await modal
      .getByRole("button", { name: "生成预约预览", exact: true })
      .click();
    await expect(modal.locator(".pd-reservation-result")).toContainText(
      "不是有效预订凭证",
    );
    await expect(modal.locator(".pd-reservation-result")).toContainText(
      "测试住客",
    );
  },
  官网界面: async (modal) => {
    await modal
      .getByRole("button", { name: "切换明暗主题", exact: true })
      .click();
    await expect(modal.locator(".pd-architecture")).toHaveClass(/dark/);
    await modal
      .locator(".pd-architecture")
      .getByRole("button", { name: "作品", exact: true })
      .click();
    await expect(modal.locator(".pd-architecture-project")).toHaveCount(3);
    await modal.getByRole("button", { name: "空间设计", exact: true }).click();
    await expect(modal.locator(".pd-architecture-project")).toHaveCount(1);
    await modal.locator(".pd-architecture-project").click();
    await expect(modal.getByLabel("项目标题", { exact: true })).toHaveValue(
      "光，塑造空间",
    );
    await modal.getByRole("button", { name: "关于", exact: true }).click();
    await expect(modal.locator(".pd-architecture-about")).toContainText(
      "真实工作室业绩",
    );
  },
  活动海报: async (modal) => {
    await modal.getByLabel("海报title文字", { exact: true }).fill("新年设计展");
    await modal.getByLabel("海报尺寸", { exact: true }).selectOption("square");
    await modal.getByLabel("海报文字颜色", { exact: true }).fill("#e4eaa2");
    await expect(
      modal.getByLabel("海报title文字", { exact: true }),
    ).toHaveValue("新年设计展");
    await expect(modal.locator(".ws-poster-canvas")).toHaveCSS(
      "color",
      "rgb(228, 234, 162)",
    );
    const box = (await modal.locator(".ws-poster-canvas").boundingBox())!;
    expect(Math.abs(box.width - box.height)).toBeLessThan(2);
    await modal
      .getByRole("button", { name: "移动title图层", exact: true })
      .focus();
    await modal.page().keyboard.press("ArrowRight");
    await expect(modal.locator(".ws-poster-layer.selected")).toHaveAttribute(
      "style",
      /left: 10.5%/,
    );
  },
  品牌视觉: async (modal) => {
    await modal.getByLabel("品牌名称", { exact: true }).fill("MOSS");
    await modal.getByLabel("使用衬线字标", { exact: true }).uncheck();
    await modal
      .getByRole("button", { name: "墨蓝品牌色", exact: true })
      .click();
    await expect(
      modal.locator(".pd-brand-hero .pd-brand-mark strong"),
    ).toHaveText("MOSS");
    await expect(
      modal.locator(".pd-brand-card .pd-brand-mark strong"),
    ).toHaveText("MOSS");
    await expect(modal.locator(".pd-brand-card")).toHaveCSS(
      "background-color",
      "rgb(52, 73, 97)",
    );
    await modal.getByRole("button", { name: "应用规范", exact: true }).click();
    await expect(modal.locator(".pd-brand-guide-grid article")).toHaveCount(3);
  },
  营销策划: async (modal) => {
    await modal.getByRole("button", { name: "内容排期", exact: true }).click();
    await expect(
      modal.getByRole("table", { name: "营销内容排期" }).locator("tbody tr"),
    ).toHaveCount(4);
    await modal
      .getByRole("button", { name: "切换周一排期状态", exact: true })
      .click();
    await expect(
      modal.getByRole("button", { name: "切换周一排期状态", exact: true }),
    ).toContainText("已排期");
    await modal.getByRole("button", { name: "预算分配", exact: true }).click();
    await modal.getByLabel("总预算", { exact: true }).fill("10001");
    await expect(modal.locator(".pd-budget-row strong")).toHaveText([
      "¥5,001",
      "¥2,000",
      "¥3,000",
    ]);
    for (const name of ["内容社区", "邮件通讯", "线下活动"])
      await modal.getByLabel(name, { exact: true }).uncheck();
    await expect(
      modal.locator(
        '[role="status"]:not(.ws-save-status):not(.ws-test-case-form small)',
      ),
    ).toContainText("请启用至少一个渠道");
  },
};
for (const group of groups)
  for (const scene of group.scenes) {
    test(`${scene}: the advertised demo works locally without service requests`, async ({
      page,
    }) => {
      const requests: string[] = [];
      page.on("request", (request) => {
        if (/\/api\/(chat|generation)$/.test(request.url())) requests.push(request.url());
      });
      const modal = await open(page, group.mode, scene);
      await checks[scene](modal);
      expect(requests).toEqual([]);
      await modal.getByRole("button", { name: "使用此场景" }).click();
      await expect(
        page.getByRole("textbox", { name: "任务描述" }),
      ).not.toHaveValue("");
      await expect(page).toHaveURL(/\/$/);
      expect(requests).toEqual([]);
    });
  }

for (const width of [320, 375, 768, 1440]) {
  test(`all 15 scene previews fit at ${width}px with reachable controls`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width,
      height: width === 320 ? 480 : width < 400 ? 600 : 900,
    });
    for (const group of groups)
      for (const scene of group.scenes) {
        const modal = await open(page, group.mode, scene);
        const box = (await modal.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(
          await modal.evaluate((el) => el.scrollWidth - el.clientWidth),
        ).toBeLessThanOrEqual(1);
        expect(
          await modal
            .locator(".scene-preview-scroll")
            .evaluate((el) => el.scrollWidth - el.clientWidth),
        ).toBeLessThanOrEqual(1);
        await expect(
          modal.getByRole("button", { name: "关闭场景预览" }),
        ).toBeInViewport();
        await expect(
          modal.getByRole("button", { name: "使用此场景" }),
        ).toBeInViewport();
        await modal.getByRole("button", { name: "关闭场景预览" }).click();
      }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}

test("each visual scene loads dedicated local photography and business scenes expose real tables", async ({
  page,
}) => {
  const photos: [string, string, string][] = [
    ["网页应用", "企业官网", "energy"],
    ["办公提效", "汇报PPT", "headphones"],
    ["设计制作", "App原型", "hotel"],
    ["设计制作", "官网界面", "interior"],
    ["设计制作", "活动海报", "botanical"],
    ["设计制作", "营销策划", "campaign"],
  ];
  for (const [mode, scene, asset] of photos) {
    const modal = await open(page, mode, scene, false);
    const image = modal.locator(`img[src*="/${asset}.webp"]`).first();
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth >= 900,
        ),
      )
      .toBeTruthy();
    await modal.getByRole("button", { name: "关闭场景预览" }).click();
  }
  for (const [mode, scene, table] of [
    ["办公提效", "会议纪要", "会议行动事项"],
    ["办公提效", "表格分析", "销售明细"],
    ["网页应用", "管理后台", "业务订单"],
    ["网页应用", "单元测试", "测试用例结果"],
  ]) {
    const modal = await open(page, mode, scene);
    await expect(
      modal.getByRole("table", { name: table }).locator("tbody tr"),
    ).not.toHaveCount(0);
    await modal.getByRole("button", { name: "关闭场景预览" }).click();
  }
});
