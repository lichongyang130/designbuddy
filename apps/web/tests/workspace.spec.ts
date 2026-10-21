import { test, expect, type Page, type Download } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { openScenePreview } from "./helpers/home";
async function open(page: Page, _mode = "办公提效", name = "会议纪要") {
  // Scene previews moved behind ⌘K; the mode argument is kept so the call sites
  // still read the same, but the sample now opens from search.
  return openScenePreview(page, name);
}
async function bytes(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}
async function zip(download: Download) {
  return unzipSync(new Uint8Array(await bytes(download)));
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("direct editing, undo/redo, named comparison, restore and browser persistence", async ({
  page,
}) => {
  const m = await open(page);
  const title = m.getByLabel("纪要标题", { exact: true });
  await title.fill("客户评审 V1");
  await m.getByRole("button", { name: "↶ 撤销", exact: true }).click();
  await expect(title).toHaveValue("AURA ONE · 产品发布评审");
  await m.getByRole("button", { name: "↷ 重做", exact: true }).click();
  await expect(title).toHaveValue("客户评审 V1");
  await m.getByRole("button", { name: "版本与比较", exact: true }).click();
  await m.getByLabel("版本名称").fill("评审前");
  await m.getByRole("button", { name: "保存命名版本", exact: true }).click();
  await expect(m.locator(".ws-version-list")).toContainText("评审前");
  await m
    .locator(".ws-command-bar")
    .getByRole("button", { name: "作品", exact: true })
    .click();
  await title.fill("客户评审 V2");
  await m.getByRole("button", { name: "版本与比较", exact: true }).click();
  await m.getByRole("button", { name: "比较当前作品", exact: true }).click();
  await expect(m.locator(".ws-compare")).toContainText("客户评审 V1");
  await expect(m.locator(".ws-compare")).toContainText("客户评审 V2");
  page.once("dialog", (d) => d.accept());
  await m.getByRole("button", { name: "恢复", exact: true }).click();
  await m.getByRole("button", { name: "关闭场景预览", exact: true }).click();
  await page.reload();
  const reopened = await open(page);
  await expect(reopened.getByLabel("纪要标题", { exact: true })).toHaveValue(
    "客户评审 V1",
  );
  await expect(reopened.locator(".ws-save-status")).toContainText("恢复");
});
test("quota failure keeps draft, blocks silent close, and permits project download", async ({
  page,
}) => {
  const m = await open(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await m.getByLabel("纪要标题", { exact: true }).fill("不能丢失的草稿");
  await m.getByRole("button", { name: "保存", exact: true }).click();
  await expect(m.getByRole("alert")).toContainText("本地保存失败");
  const pending = page.waitForEvent("download");
  await m.getByRole("button", { name: "下载当前草稿", exact: true }).click();
  const contents = JSON.parse((await bytes(await pending)).toString());
  expect(contents.data.title).toBe("不能丢失的草稿");
  page.once("dialog", (d) => d.dismiss());
  await m.getByRole("button", { name: "关闭场景预览", exact: true }).click();
  await expect(m).toBeVisible();
  await expect(m.getByLabel("纪要标题", { exact: true })).toHaveValue(
    "不能丢失的草稿",
  );
});
test("two tabs detect conflict instead of overwriting each other", async ({
  page,
  context,
}) => {
  const first = await open(page);
  await first.getByLabel("纪要标题", { exact: true }).fill("第一标签内容");
  await first.getByRole("button", { name: "保存", exact: true }).click();
  const other = await context.newPage();
  await other.goto("/");
  const second = await open(other);
  await expect(second.getByLabel("纪要标题", { exact: true })).toHaveValue(
    "第一标签内容",
  );
  await second.getByLabel("纪要标题", { exact: true }).fill("第二标签的新内容");
  await second.getByRole("button", { name: "保存", exact: true }).click();
  await expect(first.getByRole("alert")).toContainText("另一标签页更新");
  await first.getByRole("button", { name: "保存", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("designbuddy.scene-workspace.v1.meeting")!,
        ).data.title,
    ),
  ).toBe("第二标签的新内容");
  page.once("dialog", (d) => d.accept());
  await first
    .getByRole("button", { name: "载入其他标签页内容", exact: true })
    .click();
  await expect(first.getByLabel("纪要标题", { exact: true })).toHaveValue(
    "第二标签的新内容",
  );
  await other.close();
});
test("malformed storage is preserved until explicit recovery", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "designbuddy.scene-workspace.v1.meeting",
      "{broken-original",
    ),
  );
  const m = await open(page);
  await m.getByLabel("纪要标题", { exact: true }).fill("新的草稿");
  await m.getByRole("button", { name: "保存", exact: true }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("designbuddy.scene-workspace.v1.meeting"),
    ),
  ).toBe("{broken-original");
  await expect(m.getByRole("alert")).toContainText("暂停覆盖");
  const pending = page.waitForEvent("download");
  await m.getByRole("button", { name: "下载原存储备份", exact: true }).click();
  expect((await bytes(await pending)).toString()).toBe("{broken-original");
});
test("DOCX contains edited title, decision, action owner and source", async ({
  page,
}) => {
  const m = await open(page);
  await m.getByLabel("纪要标题", { exact: true }).fill("真实文档导出");
  await m.getByLabel("核心决策", { exact: true }).fill("下一阶段聚焦无障碍");
  await m.getByLabel("负责人1", { exact: true }).fill("李明");
  await m.getByRole("button", { name: "交付中心", exact: true }).click();
  const pending = page.waitForEvent("download");
  await m.getByRole("button", { name: "下载 DOCX 文档", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe("meeting-document.docx");
  const contents = await zip(file);
  expect(contents["[Content_Types].xml"]).toBeTruthy();
  const doc = strFromU8(contents["word/document.xml"]);
  for (const text of ["真实文档导出", "下一阶段聚焦无障碍", "李明"])
    expect(doc).toContain(text);
});
test("PPTX preserves all pages, real text, notes and an inserted page", async ({
  page,
}) => {
  const m = await open(page, "办公提效", "汇报PPT");
  await m.getByLabel("幻灯片标题", { exact: true }).fill("真正的上市方案");
  await m.getByLabel("演讲者备注", { exact: true }).fill("这段备注应进入 PPTX");
  await m.getByRole("button", { name: "＋ 新增页面", exact: true }).click();
  await m.getByLabel("幻灯片标题", { exact: true }).fill("新增可编辑页面");
  await m.getByLabel("幻灯片版式", { exact: true }).selectOption("chart");
  await m
    .getByLabel("幻灯片正文", { exact: true })
    .fill("曝光｜120\n咨询｜40\n转化｜15");
  const pending = page.waitForEvent("download");
  await m.getByRole("button", { name: "导出 PPTX ↓", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe("aura-one.pptx");
  const contents = await zip(file);
  expect(
    Object.keys(contents).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)),
  ).toHaveLength(9);
  const all = Object.entries(contents)
    .filter(([k]) => k.endsWith(".xml"))
    .map(([, v]) => strFromU8(v))
    .join("");
  expect(all).toContain("真正的上市方案");
  expect(all).toContain("新增可编辑页面");
  expect(all).toContain("这段备注应进入 PPTX");
  expect(
    Object.keys(contents).some((k) => k.startsWith("ppt/media/")),
  ).toBeTruthy();
  expect(
    Object.keys(contents).some((k) => /^ppt\/charts\/chart\d+\.xml$/.test(k)),
  ).toBeTruthy();
});
test("CSV import validates quoted values, updates charts and roundtrips through XLSX", async ({
  page,
}) => {
  const m = await open(page, "办公提效", "表格分析");
  page.once("dialog", (d) => d.accept());
  await m.getByLabel("导入 CSV / XLSX", { exact: true }).setInputFiles({
    name: "sales.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      '记录编号,月份,渠道,区域,订单数,均价,退款单\r\nIMPORT-1,10,官网,"华东,杭州",10,50,1\r\nIMPORT-2,11,品牌门店,华北,20,80,0',
    ),
  });
  await expect(m.getByLabel("IMPORT-1订单数", { exact: true })).toHaveValue(
    "10",
  );
  await expect(m.locator(".pd-analytics-metrics")).toContainText("¥2,100");
  const pending = page.waitForEvent("download");
  await m.getByRole("button", { name: "导出 XLSX", exact: true }).click();
  const file = await pending,
    buffer = await bytes(file);
  const contents = unzipSync(buffer);
  expect(strFromU8(contents["xl/worksheets/sheet1.xml"])).toContain(
    "华东,杭州",
  );
  await m.getByLabel("IMPORT-1订单数", { exact: true }).fill("5");
  page.once("dialog", (d) => d.accept());
  await m.getByLabel("导入 CSV / XLSX", { exact: true }).setInputFiles({
    name: "roundtrip.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(m.getByLabel("IMPORT-1订单数", { exact: true })).toHaveValue(
    "10",
  );
  await m.getByLabel("导入 CSV / XLSX", { exact: true }).setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "记录编号,月份,渠道,区域,订单数,均价,退款单\nX,13,官网,华东,1,2,4",
    ),
  });
  await expect(m.locator(".ws-inline-status")).toContainText("不合法");
  await expect(m.getByLabel("IMPORT-1订单数", { exact: true })).toHaveValue(
    "10",
  );
});
test("poster direct pointer movement and PNG/SVG exports use current text and dimensions", async ({
  page,
}) => {
  const m = await open(page, "设计制作", "活动海报");
  await m.getByLabel("海报title文字", { exact: true }).fill("一起看见自然");
  const handle = m.getByRole("button", { name: "移动title图层", exact: true });
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 35, { steps: 4 });
  await page.mouse.up();
  await expect(m.locator(".ws-poster-layer.selected")).not.toHaveAttribute(
    "style",
    /left: 10%; top: 17%;/,
  );
  await m.getByLabel("海报尺寸", { exact: true }).selectOption("square");
  let pending = page.waitForEvent("download");
  await m.getByRole("button", { name: "矢量 SVG", exact: true }).click();
  const svg = (await bytes(await pending)).toString();
  expect(svg).toContain("一起看见自然");
  expect(svg).toContain('width="1200" height="1200"');
  expect(svg).toContain("data:font/woff2;base64");
  pending = page.waitForEvent("download");
  await m.getByRole("button", { name: "导出 PNG ↓", exact: true }).click();
  const png = await bytes(await pending);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(1200);
  const ink = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1200;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(100, 200, 1000, 340).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] > 235 && pixels[i + 1] > 230 && pixels[i + 2] > 200)
        count++;
    return count;
  }, png.toString("base64"));
  expect(ink).toBeGreaterThan(1500); // Chinese title must actually be rasterized, not only in SVG XML.
});
test("operations create orders, product CRUD, inventory warning and read-only controls", async ({
  page,
}) => {
  const m = await open(page, "网页应用", "管理后台");
  await m.getByRole("button", { name: "＋ 新建订单", exact: true }).click();
  await m.getByLabel("新订单客户", { exact: true }).fill("本地测试公司");
  await m.getByRole("button", { name: "创建订单", exact: true }).click();
  await expect(m.getByRole("table", { name: "业务订单" })).toContainText(
    "本地测试公司",
  );
  await m.getByRole("button", { name: "产品目录", exact: true }).click();
  await m.getByRole("button", { name: "＋ 新增商品", exact: true }).click();
  await m.getByLabel("业务记录名称", { exact: true }).fill("联动测试商品");
  await m.getByLabel("业务记录stock", { exact: true }).fill("2");
  await m.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(m.getByRole("table", { name: "产品目录" })).toContainText(
    "联动测试商品",
  );
  await m.getByRole("button", { name: "库存管理", exact: true }).click();
  const row = m.getByRole("row").filter({ hasText: "联动测试商品" });
  await expect(row).toContainText("需补货");
  await m.getByLabel("后台权限", { exact: true }).selectOption("只读");
  await expect(
    row.getByRole("button", { name: "调整库存", exact: true }),
  ).toBeDisabled();
  await m.getByLabel("后台权限", { exact: true }).selectOption("编辑者");
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "删除", exact: true }).click();
  await expect(m.getByRole("table", { name: "库存管理" })).not.toContainText(
    "联动测试商品",
  );
});
test("email drafts remain separate and EML embeds attachment bytes", async ({
  page,
}) => {
  const m = await open(page, "办公提效", "邮件撰写");
  await m.getByLabel("邮件主题", { exact: true }).fill("保留首份草稿");
  await m.getByLabel("邮件签名", { exact: true }).fill("签名已修改");
  await m.getByLabel("＋ 添加附件", { exact: true }).setInputFiles({
    name: "brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("local attachment"),
  });
  await m.getByRole("button", { name: /摄影素材确认/ }).click();
  await m.getByLabel("邮件主题", { exact: true }).fill("第二份资料");
  await m.getByRole("button", { name: /保留首份草稿/ }).click();
  await expect(m.getByLabel("邮件主题", { exact: true })).toHaveValue(
    "保留首份草稿",
  );
  await expect(m.locator(".ws-email-attachments")).toContainText("brief.txt");
  await m.getByRole("button", { name: "交付中心", exact: true }).click();
  const pending = page.waitForEvent("download");
  await m
    .getByRole("button", { name: "下载 EML 邮件草稿", exact: true })
    .click();
  const eml = (await bytes(await pending)).toString();
  expect(eml).toContain("X-Unsent: 1");
  expect(eml).toContain("brief.txt");
  expect(eml).toContain(Buffer.from("local attachment").toString("base64"));
});
test("API collection loads environment variables and history, custom tests really execute", async ({
  page,
}) => {
  let m = await open(page, "网页应用", "接口开发");
  await m
    .getByLabel("接口路径", { exact: true })
    .fill("/v1/orders/{{orderId}}");
  await m.getByRole("button", { name: "保存请求", exact: true }).click();
  await m.getByRole("button", { name: "运行模拟 ↗", exact: true }).click();
  await expect(m.locator(".pd-api-response")).toContainText("200 SUCCESS");
  await m.getByLabel("环境变量 orderId", { exact: true }).fill("NOT-FOUND");
  await m.getByRole("button", { name: "运行模拟 ↗", exact: true }).click();
  await expect(m.locator(".pd-api-response")).toContainText("404 ERROR");
  await m.locator(".pd-api-history").last().click();
  await expect(m.locator(".pd-api-response")).toContainText("200 SUCCESS");
  await m.getByRole("button", { name: "关闭场景预览", exact: true }).click();
  m = await open(page, "网页应用", "单元测试");
  await m.getByLabel("自定义用例输入", { exact: true }).fill("-5");
  await m.getByRole("button", { name: "添加用例", exact: true }).click();
  await m.getByRole("button", { name: "▶ 运行测试", exact: true }).click();
  await expect(m.locator(".pd-test-metrics")).toContainText("3 / 5 通过");
  await m.getByLabel("启用边界修复", { exact: true }).check();
  await m.getByRole("button", { name: "▶ 运行测试", exact: true }).click();
  await expect(m.locator(".pd-test-metrics")).toContainText("5 / 5 通过");
});
test("brand packaging and downloadable vectors reflect current identity", async ({
  page,
}) => {
  const m = await open(page, "设计制作", "品牌视觉");
  await m.getByLabel("品牌名称", { exact: true }).fill("山间");
  await m.getByRole("button", { name: "陶棕品牌色", exact: true }).click();
  await expect(m.locator(".ws-brand-packaging svg")).toContainText("山间");
  await m.getByRole("button", { name: "交付中心", exact: true }).click();
  const pending = page.waitForEvent("download");
  await m
    .getByRole("button", { name: "下载 ZIP 品牌素材包", exact: true })
    .click();
  const files = await zip(await pending);
  expect(strFromU8(files["brand-packaging.svg"])).toContain("山间");
  expect(strFromU8(files["brand-packaging.svg"])).toContain("#825b47");
  expect(files["OFL.txt"]).toBeTruthy();
});
test("campaign drag reschedules and persists assigned owner", async ({
  page,
}) => {
  const m = await open(page, "设计制作", "营销策划");
  await m.getByRole("button", { name: "内容排期", exact: true }).click();
  const card = m.locator(".ws-calendar-day").first().locator("article");
  await card.dragTo(m.locator(".ws-calendar-day").nth(1));
  await expect(m.getByLabel("排期1日期", { exact: true })).toHaveValue("周二");
  await m.getByLabel("排期1负责人", { exact: true }).fill("排期负责人");
  await m.getByRole("button", { name: "关闭场景预览", exact: true }).click();
  const next = await open(page, "设计制作", "营销策划");
  await expect(next.getByLabel("排期1负责人", { exact: true })).toHaveValue(
    "排期负责人",
  );
});
test("exported website runs offline navigation and never submits a real contact", async ({
  page,
  context,
}) => {
  const m = await open(page, "网页应用", "企业官网");
  await m.getByLabel("官网主标题", { exact: true }).fill("我们的能源未来");
  await m.getByRole("button", { name: "交付中心", exact: true }).click();
  const pending = page.waitForEvent("download");
  await m
    .getByRole("button", { name: "下载 可运行 HTML 网站", exact: true })
    .click();
  const html = (await bytes(await pending)).toString();
  expect(html).toContain("我们的能源未来");
  expect(html).toContain("data:image/");
  const offline = await context.newPage();
  await offline.setContent(html);
  await offline.getByRole("button", { name: "联系", exact: true }).click();
  await offline.getByLabel("联系人", { exact: true }).fill("测试人");
  await offline.getByLabel("邮箱", { exact: true }).fill("test@example.com");
  await offline.getByLabel("需求", { exact: true }).fill("项目咨询");
  await offline.getByRole("button", { name: "检查表单", exact: true }).click();
  await expect(offline.getByRole("status")).toContainText("没有提交信息");
  await offline.close();
});
