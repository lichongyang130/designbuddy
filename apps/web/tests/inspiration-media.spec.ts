import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function download(page: Page, name: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const file = await event;
  return readFile((await file.path())!);
}
const key = (id: string) => `designbuddy.samples.v2.${id}.sample`;
async function stored(page: Page, id: string) {
  return page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) || "null"),
    key(id),
  );
}

test("motion: actual timeline, editable frames, persistence and standalone HTML", async ({
  page,
  context,
}) => {
  await page.goto("/inspiration/hyperframes");
  await page.getByLabel("分镜标题", { exact: true }).fill("我的下一帧");
  await page.getByLabel("分镜时长").fill("6");
  await page.getByLabel("分镜颜色").fill("#335577");
  await expect(page.locator(".media-motion-scene h1")).toHaveText("我的下一帧");
  await page.getByRole("button", { name: "播放动效", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("动效播放位置").inputValue()),
    )
    .toBeGreaterThan(0.15);
  await page.getByRole("button", { name: "暂停动效", exact: true }).click();
  await page.getByLabel("动效播放位置").fill("8");
  await expect(page.locator(".media-motion-scene h1")).toContainText("让故事");
  await page.getByRole("button", { name: "编辑分镜2", exact: true }).click();
  await page.getByLabel("分镜标题", { exact: true }).fill("第二幕内容");
  await page.reload();
  await expect(page.getByLabel("分镜标题", { exact: true })).toHaveValue(
    "我的下一帧",
  );
  await expect(page.getByLabel("分镜时长")).toHaveValue("6");
  const html = (await download(page, "下载动效 HTML")).toString();
  const offline = await context.newPage();
  await offline.route("**/*", (route) => route.abort());
  await offline.setContent(html);
  await expect(offline.locator("h1")).toHaveText("我的下一帧");
  await offline.locator("button").first().click();
  await expect
    .poll(async () =>
      Number(await offline.locator('input[type="range"]').inputValue()),
    )
    .toBeGreaterThan(0.1);
  await offline.close();
});

test("film: real MP4 playback, chapters, updated subtitle cues and downloads", async ({
  page,
}) => {
  await page.goto("/inspiration/film");
  const video = page.locator("video");
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).duration))
    .toBe(18);
  await page.getByRole("button", { name: "播放短片", exact: true }).click();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "暂停短片", exact: true }).click();
  await page.getByRole("button", { name: "跳转镜头3", exact: true }).click();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).currentTime))
    .toBe(12);
  await page.getByLabel("视频播放速度").selectOption("1.5");
  await page.getByLabel("镜头3字幕").fill("属于我的湖畔时光");
  await expect
    .poll(() =>
      video.evaluate((v) =>
        Array.from((v as HTMLVideoElement).textTracks)
          .flatMap((t) =>
            Array.from(t.cues || []).map((c) => (c as VTTCue).text),
          )
          .join("|"),
      ),
    )
    .toContain("属于我的湖畔时光");
  const subtitles = (await download(page, "下载字幕 VTT")).toString();
  expect(subtitles).toContain("WEBVTT");
  expect(subtitles).toContain("00:00:12.000 --> 00:00:18.000");
  expect(subtitles).toContain("属于我的湖畔时光");
  const mp4 = await download(page, "下载原片 MP4");
  expect(mp4.subarray(4, 8).toString()).toBe("ftyp");
  expect(mp4.length).toBeGreaterThan(1_000_000);
  await page.reload();
  await expect(page.getByLabel("视频播放速度")).toHaveValue("1.5");
  await expect(page.getByLabel("镜头3字幕")).toHaveValue("属于我的湖畔时光");
});

test("sound: audible PCM, native playback and parameter-driven waveform and WAV", async ({
  page,
}) => {
  await page.goto("/inspiration/sound");
  const audio = page.locator("audio");
  await expect
    .poll(() => audio.evaluate((a) => (a as HTMLAudioElement).duration))
    .toBe(8);
  const initial = await download(page, "下载当前音频 WAV");
  expect(initial.subarray(0, 4).toString()).toBe("RIFF");
  expect(initial.readUInt32LE(24)).toBe(22050);
  expect(initial.readUInt16LE(34)).toBe(16);
  expect(initial.length).toBe(44 + 8 * 22050 * 2);
  const peaks = await page.locator(".media-wave").innerHTML();
  await audio.click({ position: { x: 24, y: 20 } });
  await expect
    .poll(() => audio.evaluate((a) => (a as HTMLAudioElement).currentTime))
    .toBeGreaterThan(0.1);
  await page.getByLabel("声音节奏").fill("110");
  await page.getByLabel("声音明亮度").fill("80");
  await expect
    .poll(() => page.locator(".media-wave").innerHTML())
    .not.toBe(peaks);
  const changed = await download(page, "下载当前音频 WAV");
  expect(changed.equals(initial)).toBe(false);
  await page.getByLabel("声音音量").fill("0");
  const silence = await download(page, "下载当前音频 WAV");
  expect(silence.subarray(44).every((n) => n === 0)).toBe(true);
  await page.reload();
  await expect(page.getByLabel("声音节奏")).toHaveValue("110");
  await expect(page.getByLabel("声音明亮度")).toHaveValue("80");
});

test("live: cents-based arithmetic, add/delete, safe CSV and offline interactive HTML", async ({
  page,
  context,
}) => {
  await page.goto("/inspiration/live");
  const total = page.getByLabel("报价总额");
  await expect(total).toContainText("11,600.00");
  await page.getByLabel("服务2数量").fill("2");
  await page.getByLabel("报价折扣").fill("10");
  await page.getByLabel("报价税率").fill("6");
  await expect(total).toContainText("6,487.20");
  await page.getByRole("button", { name: "＋ 添加服务", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "删除服务4", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByLabel("服务1名称").fill('=HYPERLINK("bad")');
  const csv = (await download(page, "导出报价 CSV")).toString();
  expect(csv).toContain("'=HYPERLINK");
  expect(csv).toContain("6487.2");
  const html = (await download(page, "下载交互 HTML")).toString();
  const offline = await context.newPage();
  await offline.route("**/*", (r) => r.abort());
  await offline.setContent(html);
  await expect(offline.locator("#total")).toContainText("6,487.20");
  await offline.locator("#tax").fill("0");
  await expect(offline.locator("#total")).toContainText("6,120.00");
  await offline.close();
  await page.reload();
  await expect(total).toContainText("6,487.20");
  await expect(page.getByLabel("服务1名称")).toHaveValue('=HYPERLINK("bad")');
});

test("WebGL: nonempty pixels, keyboard/drag, parameters, OBJ/PNG and executable HTML", async ({
  page,
  context,
}) => {
  await page.goto("/inspiration/webgl");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-rendered", "true");
  const pixels = () =>
    canvas.evaluate((c) => {
      const gl = (c as HTMLCanvasElement).getContext("webgl")!;
      const p = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return Array.from(p).filter((n, i) => i % 4 === 3 && n > 0).length;
    });
  await expect.poll(pixels).toBeGreaterThan(1000);
  const before = await stored(page, "webgl");
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await stored(page, "webgl")).yaw)
    .not.toBe(before.yaw);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 75,
    box.y + box.height / 2 + 35,
    { steps: 5 },
  );
  await page.mouse.up();
  await page.getByLabel("三维缩放").fill("1.35");
  await page.getByLabel("三维形体").selectOption("sphere");
  await page.getByLabel("三维材质颜色").fill("#cc7755");
  const obj = (await download(page, "下载几何 OBJ")).toString();
  expect(obj.split("\n").filter((l) => l.startsWith("f "))).toHaveLength(4096);
  expect(obj).toContain("vn ");
  const png = await download(page, "保存当前视图 PNG");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.length).toBeGreaterThan(5000);
  const html = (await download(page, "下载 WebGL HTML")).toString();
  const offline = await context.newPage();
  await offline.route("**/*", (r) => r.abort());
  await offline.setContent(html);
  await expect(offline.locator("#error")).toHaveText("");
  await expect(offline.locator("#color")).toHaveValue("#cc7755");
  await expect(offline.locator("#zoom")).toHaveValue("1.35");
  await offline.close();
  await page.reload();
  await expect(page.getByLabel("三维形体")).toHaveValue("sphere");
  await expect(page.getByLabel("三维缩放")).toHaveValue("1.35");
  await expect(page.getByLabel("三维材质颜色")).toHaveValue("#cc7755");
});

test("WebGL unavailable and context loss show honest fallback; retry recovers", async ({
  page,
}) => {
  await page.goto("/inspiration/webgl");
  await page
    .locator("canvas")
    .evaluate((c) =>
      (c as HTMLCanvasElement)
        .getContext("webgl")!
        .getExtension("WEBGL_lose_context")!
        .loseContext(),
    );
  await expect(page.getByRole("alert")).toContainText("上下文已丢失");
  await page.getByRole("button", { name: "重试 WebGL", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute("data-rendered", "true");
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      return type === "webgl"
        ? null
        : (original as any).call(this, type, ...args);
    } as any;
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("无法显示三维作品");
  await page
    .getByRole("button", { name: "保存当前视图 PNG", exact: true })
    .click();
  await expect(page.getByText("三维画面尚未就绪，无法截图。")).toBeVisible();
});

for (const [id, label, value] of [
  ["hyperframes", "分镜标题", "我的分镜"],
  ["film", "镜头1字幕", "我的影片字幕"],
  ["sound", "声音作品名称", "我的声音"],
  ["live", "报价客户", "我的客户"],
  ["webgl", "三维缩放", "1.4"],
]) {
  test(`${id}: copy retains current edits and remains isolated from original`, async ({
    page,
  }) => {
    await page.goto(`/inspiration/${id}`);
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole("button", { name: /做同款/ }).click();
    await expect(page).toHaveURL(new RegExp(`/inspiration/${id}/draft/`));
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
    const changed = id === "webgl" ? "1.1" : value + "副本";
    await page.getByLabel(label, { exact: true }).fill(changed);
    await page.reload();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(changed);
    await page.goto(`/inspiration/${id}`);
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  });
}
for (const width of [320, 375, 768, 1440]) {
  test(`five media workspaces fit ${width}px without page overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const id of ["hyperframes", "film", "sound", "live", "webgl"]) {
      await page.goto("/inspiration/" + id);
      await expect(page.locator(".media-provenance")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    expect(errors).toEqual([]);
  });
}

test("media restores damaged nested data safely and preserves valid fields", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const bad = {
      hyperframes: { frames: [{ title: 123, color: "bad", duration: -1 }] },
      film: { rate: 99, captions: { "0": {}, "1": "保留有效字幕", "2": null } },
      sound: { tempo: -10, tone: 900, gain: "bad" },
      live: {
        tax: 999,
        discount: -1,
        lines: [{ id: "bad", name: "无效", qty: -5, price: 1 }],
      },
      webgl: {
        shape: "unknown",
        accent: "not-a-color",
        yaw: 500,
        pitch: -500,
        zoom: 0,
      },
    };
    for (const [id, value] of Object.entries(bad))
      localStorage.setItem(
        `designbuddy.samples.v2.${id}.sample`,
        JSON.stringify(value),
      );
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/inspiration/hyperframes");
  await expect(page.getByLabel("分镜时长")).toHaveValue("4");
  await expect(page.locator(".media-frame-strip button")).toHaveCount(4);
  await page.goto("/inspiration/film");
  await expect(page.getByLabel("视频播放速度")).toHaveValue("1");
  await expect(page.getByLabel("镜头1字幕")).toHaveValue(
    "抵达湖畔，把时间留给自己。",
  );
  await expect(page.getByLabel("镜头2字幕")).toHaveValue("保留有效字幕");
  await page.goto("/inspiration/sound");
  await expect(page.getByLabel("声音节奏")).toHaveValue("72");
  await page.goto("/inspiration/live");
  await expect(page.getByLabel("报价总额")).toContainText("11,600.00");
  await page.goto("/inspiration/webgl");
  await expect(page.getByLabel("三维形体")).toHaveValue("ring");
  await expect(page.getByLabel("三维缩放")).toHaveValue("1");
  expect(errors).toEqual([]);
});

test("storage quota failures are visible and copy does not navigate to a nonexistent draft", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("designbuddy.samples."))
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await page.goto("/inspiration/live");
  await page.getByLabel("报价客户").fill("未保存的本地客户");
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByRole("button", { name: /做同款/ }).click();
  await expect(page).toHaveURL(/\/inspiration\/live$/);
  await expect(page.getByRole("status")).toBeVisible();
  expect((await download(page, "导出报价 CSV")).length).toBeGreaterThan(100);
});
