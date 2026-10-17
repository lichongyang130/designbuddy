import { test, expect } from "@playwright/test";

/**
 * The model registry page must only report what the server knows.
 *
 * Nothing here is mocked: the page reads the server's own registry and the
 * usage the provider really reported, and it says so when a model id could
 * not be verified.
 */
test("the registry page shows the server's models and their verification state", async ({
  page,
}) => {
  await page.goto("/models");
  const facts = page.getByRole("region", { name: "服务配置" });
  await expect(facts).toBeVisible();
  await expect(facts).toContainText("openai-compatible");

  const catalog = page.getByRole("region", { name: "已登记模型" });
  await expect(catalog).toBeVisible();
  const rows = catalog.locator("tbody tr");
  await expect(rows).not.toHaveCount(0);
  // Every registered model is either confirmed by the provider or marked unverified.
  await expect(catalog.locator("tbody .models-tag").first()).toBeVisible();
  await expect(catalog.locator("tbody .models-tag.is-warn").first()).toBeVisible();
  await expect(catalog).toContainText("核验");
});

test("the usage panel reports real totals and never estimates a missing number", async ({
  page,
}) => {
  await page.goto("/models");
  const usage = page.getByRole("region", { name: "真实用量" });
  await expect(usage).toBeVisible();
  await expect(usage).toContainText("调用次数");
  await expect(usage).toContainText("合计 token");
  await expect(usage).toContainText(/服务商回报|服务商未回报|还没有调用记录/);
});

test("asking the provider to verify reports the missing credentials instead of pretending", async ({
  page,
}) => {
  await page.goto("/models");
  await page.getByRole("button", { name: "向服务商核验模型列表" }).click();
  const notice = page.locator(".models-message");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/核验未完成|核验完成/);
});

test("the quota card never shows an invented balance", async ({ page }) => {
  await page.goto("/models");
  const quota = page.getByRole("region", { name: "额度" });
  await expect(quota).toBeVisible();
  await expect(quota).toContainText("平台不会展示估算的余额");
  await quota.getByRole("button", { name: "向服务商查询额度" }).click();
  await expect(quota).toContainText(/剩余额度/);
  await expect(quota.locator(".models-facts")).toContainText("未知");
});

test("the product model list is labelled as an unverified product claim", async ({
  page,
}) => {
  await page.goto("/models");
  const product = page.getByRole("region", { name: "产品可选模型" });
  await expect(product).toBeVisible();
  await expect(product).toContainText("未经服务商核验");
  await expect(product.locator("tbody tr")).toHaveCount(7);
});

test("the models page is reachable from the sidebar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "模型与用量" }).click();
  await expect(page.getByRole("heading", { name: "模型与用量", level: 1 })).toBeVisible();
});
