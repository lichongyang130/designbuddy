import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import PptxGenJS from "pptxgenjs";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import {
  DEFAULT_DECK_THEME,
  THEME_FONTS,
  accessibilityWarnings,
  buildPptxThemeXml,
  cloneTheme,
  contrastRatio,
  coverColors,
  pptxPalette,
  themeFromDesignSystem,
  themeToCssVariables,
  validateDeckTheme,
} from "../../../shared/deckTheme.ts";

/**
 * Deck themes.
 *
 * The promise being tested is narrow but important: a theme changes appearance
 * only, and an exported PPTX uses the very same colours as the preview. So the
 * heavy test builds a real .pptx, swaps in our theme part, re-reads it, and
 * checks the colours that actually landed in the package.
 */

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, "../../../themes/catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

test("every shipped preset is valid and keeps body text readable", () => {
  assert.ok(catalog.length >= 12, "the gallery should ship at least twelve presets");
  const ids = new Set();
  for (const preset of catalog) {
    assert.ok(!ids.has(preset.id), `duplicate preset id ${preset.id}`);
    ids.add(preset.id);
    const result = validateDeckTheme(preset);
    assert.equal(result.ok, true, `${preset.id} must validate: ${JSON.stringify(result.errors ?? [])}`);
    const body = contrastRatio(preset.palette.text, preset.palette.background);
    assert.ok(body >= 4.5, `${preset.id} body contrast ${body.toFixed(2)} must reach 4.5:1`);
    assert.ok(THEME_FONTS.includes(preset.typography.headingFont), `${preset.id} heading font must be whitelisted`);
    assert.ok(THEME_FONTS.includes(preset.typography.bodyFont), `${preset.id} body font must be whitelisted`);
    assert.ok(preset.charts.palette.length >= 3, `${preset.id} needs at least three chart colours`);
  }
});

test("the default theme reproduces the deck's existing look", () => {
  const vars = themeToCssVariables(DEFAULT_DECK_THEME);
  // These literals are what `.ws-slide` hard-coded before themes existed.
  assert.equal(vars["--ppt-bg"], "#F2F1EB");
  assert.equal(vars["--ppt-ink"], "#273E40");
  assert.equal(vars["--ppt-muted"], "#63816F");
  assert.equal(vars["--ppt-cover-bg"], "#17292C");
  assert.equal(vars["--ppt-cover-ink"], "#FFFFFF");
  assert.equal(vars["--ppt-chart-3"], "#769980");

  // Secondary tints were hand-picked in CSS; they are now derived, so allow a
  // couple of RGB steps but not a visible shift.
  const near = (actual, expected, tolerance = 12) => {
    const a = actual.slice(1).match(/../g).map((h) => parseInt(h, 16));
    const b = expected.slice(1).match(/../g).map((h) => parseInt(h, 16));
    return a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
  };
  assert.ok(near(vars["--ppt-cover-muted"], "#C2CEC4"), `cover subtitle drifted: ${vars["--ppt-cover-muted"]}`);
  assert.ok(near(vars["--ppt-cover-faint"], "#B0C8BC"), `cover footer drifted: ${vars["--ppt-cover-faint"]}`);
  assert.ok(near(vars["--ppt-faint"], "#75877E"), `page footer drifted: ${vars["--ppt-faint"]}`);
});

test("contrast maths matches WCAG reference values", () => {
  assert.equal(Number(contrastRatio("#000000", "#FFFFFF").toFixed(2)), 21);
  assert.equal(contrastRatio("#FFFFFF", "#FFFFFF"), 1);
  assert.equal(Number(contrastRatio("#777777", "#FFFFFF").toFixed(2)), 4.48);
});

test("validation clamps numbers but rejects colours it cannot trust", () => {
  const tooRound = validateDeckTheme(cloneTheme(DEFAULT_DECK_THEME, { id: "t-clamp", name: "clamp" }));
  assert.equal(tooRound.ok, true);
  assert.ok(tooRound.theme.shape.radius <= 24, "radius is clamped, not accepted as-is");

  const badColour = validateDeckTheme({
    ...DEFAULT_DECK_THEME,
    id: "t-bad",
    name: "bad",
    palette: { ...DEFAULT_DECK_THEME.palette, background: "red" },
  });
  assert.equal(badColour.ok, false);
  assert.match(badColour.errors.join("\n"), /颜色/);

  const badFont = validateDeckTheme({
    ...DEFAULT_DECK_THEME,
    id: "t-font",
    name: "font",
    typography: { ...DEFAULT_DECK_THEME.typography, bodyFont: "Comic Sans MS" },
  });
  assert.equal(badFont.ok, false);

  const injected = validateDeckTheme({
    ...DEFAULT_DECK_THEME,
    id: "t-css",
    name: "css",
    customCss: "@import url(https://evil.example/x.css);",
  });
  assert.equal(injected.ok, false, "custom CSS may not pull remote resources");

  const missingName = validateDeckTheme({ ...DEFAULT_DECK_THEME, name: "   " });
  assert.equal(missingName.ok, false);
});

test("accessibility warnings fire on unreadable combinations", () => {
  const washed = cloneTheme(DEFAULT_DECK_THEME, {
    id: "t-wash",
    name: "wash",
    palette: { background: "#FFFFFF", text: "#BBBBBB", muted: "#CCCCCC", accent: "#DDDDDD" },
  });
  const warnings = accessibilityWarnings(washed);
  assert.ok(warnings.some((warning) => warning.field === "palette.text"), "body text below 4.5:1 must warn");
  assert.ok(warnings.some((warning) => warning.field === "palette.accent"), "accent below 3:1 must warn");

  const readable = accessibilityWarnings(DEFAULT_DECK_THEME);
  assert.equal(readable.length, 0, "the default theme is readable");
});

test("theme1.xml declares the deck's own colours and fonts", () => {
  const theme = catalog[1];
  const xml = buildPptxThemeXml(theme, "DesignBuddy test");
  const palette = theme.charts.palette;
  const bare = (hex) => hex.replace("#", "").toUpperCase();

  assert.match(xml, /<a:dk1><a:srgbClr val="[0-9A-F]{6}"\/><\/a:dk1>/);
  assert.match(xml, new RegExp(`<a:dk2><a:srgbClr val="${bare(theme.palette.primary)}"/>`));
  assert.match(xml, new RegExp(`<a:lt1><a:srgbClr val="${bare(theme.palette.background)}"/>`));
  for (const [index, colour] of palette.slice(0, 6).entries()) {
    assert.match(xml, new RegExp(`<a:accent${index + 1}><a:srgbClr val="${bare(colour)}"/>`), `accent${index + 1}`);
  }
  assert.match(xml, new RegExp(`<a:majorFont><a:latin typeface="${theme.typography.headingFont}"`));
  assert.match(xml, new RegExp(`<a:minorFont><a:latin typeface="${theme.typography.bodyFont}"`));
  // Fonts are declared by name only — no font binaries are embedded.
  assert.ok(!/fontEmbed/.test(xml));
});

test("an exported deck carries the theme colours in the package", async () => {
  const theme = catalog[2];
  const page = pptxPalette(theme);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.theme = { headFontFace: theme.typography.headingFont, bodyFontFace: theme.typography.bodyFont };

  const cover = pptx.addSlide();
  cover.background = { color: page.coverBg };
  cover.addText("封面标题", { x: 0.6, y: 2, w: 6, h: 1, color: page.coverInk, fontSize: 32 });

  const body = pptx.addSlide();
  body.background = { color: page.background };
  body.addText("内页标题", { x: 0.6, y: 1, w: 8, h: 1, color: page.ink, fontSize: 28 });
  body.addText("要点", { x: 0.6, y: 3, w: 8, h: 1, color: page.muted, fontSize: 16 });
  body.addTable([["渠道", "占比"], ["线上", "82%"]], {
    x: 0.6,
    y: 4,
    w: 6,
    h: 1.2,
    border: { type: "solid", pt: theme.shape.stroke, color: page.border },
    color: page.ink,
    fill: { color: page.background },
  });

  // Same rewrite the exporter performs: one part replaced, everything else kept.
  const buffer = await pptx.write({ outputType: "nodebuffer" });
  const files = unzipSync(new Uint8Array(buffer));
  files["ppt/theme/theme1.xml"] = strToU8(buildPptxThemeXml(theme, `DesignBuddy ${theme.name}`));
  const out = zipSync(files, { level: 6 });
  const reread = unzipSync(out);
  const text = (name) => strFromU8(reread[name]);

  assert.ok(reread["ppt/presentation.xml"], "the rewritten package is still a presentation");
  assert.ok(reread["ppt/slides/slide1.xml"] && reread["ppt/slides/slide2.xml"], "both slides survive the rewrite");

  const themeXml = text("ppt/theme/theme1.xml");
  assert.match(themeXml, /DesignBuddy/);
  assert.match(themeXml, new RegExp(`<a:accent1><a:srgbClr val="${theme.charts.palette[0].replace("#", "").toUpperCase()}"/>`));
  assert.match(themeXml, new RegExp(`<a:dk2><a:srgbClr val="${theme.palette.primary.replace("#", "").toUpperCase()}"/>`));

  const slide1 = text("ppt/slides/slide1.xml");
  assert.match(slide1, new RegExp(`<a:srgbClr val="${page.coverBg}"/>`), "the cover uses coverBackground(theme)");
  assert.match(slide1, new RegExp(`<a:srgbClr val="${page.coverInk}"/>`), "cover text uses the readable on-cover colour");

  const slide2 = text("ppt/slides/slide2.xml");
  assert.match(slide2, new RegExp(`<a:srgbClr val="${page.background}"/>`), "inner pages use the theme background");
  assert.match(slide2, new RegExp(`<a:srgbClr val="${page.ink}"/>`), "inner pages use the theme ink");
  assert.match(slide2, new RegExp(`<a:srgbClr val="${page.border}"/>`), "table borders follow the theme");
  assert.equal(
    page.background,
    theme.palette.background.replace("#", "").toUpperCase(),
    "the exported background is the theme background, not a hard-coded default",
  );

  // The deck must not still be the Office default theme (4472C4).
  assert.ok(!/4472C4/i.test(themeXml), "the Office default accent must be gone");
});

test("a design system becomes a usable theme without trusting its fonts", () => {
  const theme = themeFromDesignSystem({
    id: "ds-01",
    name: "Linear",
    primary: "#5E6AD2",
    tokens: {
      color: { primary: "#5E6AD2", background: "#F8F9FC", surface: "#F5F6FA", text: "#171923", muted: "#707584", border: "#E6E8EF" },
      typography: { display: "Inter, system-ui, sans-serif", body: "Not A Real Font, serif" },
    },
  });
  assert.equal(theme.palette.background, "#F8F9FC");
  assert.equal(theme.palette.text, "#171923");
  assert.equal(theme.typography.headingFont, "Inter", "the first family survives when we ship it");
  assert.equal(theme.typography.bodyFont, DEFAULT_DECK_THEME.typography.bodyFont, "an unknown family falls back");
  assert.equal(theme.charts.palette[0], "#5E6AD2", "accent1 is the brand colour");

  const partial = themeFromDesignSystem({ id: "broken", tokens: { color: { background: "navy" } } });
  assert.equal(partial.palette.background, DEFAULT_DECK_THEME.palette.background, "a bad hex never reaches the exporter");
  assert.equal(validateDeckTheme(partial).ok, true);
});

test("a light primary is darkened for covers instead of writing white on white", () => {
  const light = cloneTheme(DEFAULT_DECK_THEME, {
    id: "t-light",
    name: "light",
    palette: { ...DEFAULT_DECK_THEME.palette, primary: "#F7F5EE", onPrimary: "#FFFFFF" },
  });
  const cover = coverColors(light);
  assert.notEqual(cover.background.toUpperCase(), "#F7F5EE", "a primary that cannot carry its own text is darkened");
  assert.ok(
    contrastRatio(cover.background, cover.text) >= 4.5,
    `cover text must stay readable, got ${contrastRatio(cover.background, cover.text).toFixed(2)}`,
  );
});
