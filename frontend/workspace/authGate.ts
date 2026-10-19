/** The immersive welcome introduces account login and an explicit local/guest entry.
 * This is a UI gate only; server authorization remains enforced by each API.
 */
export const AUTH_GATE_ENABLED = true;

/**
 * Server-status dialog title, matching whatever the panel currently offers.
 * The settings window opens the same dialog, so it shares this label.
 */
export const SERVER_PANEL_TITLE = AUTH_GATE_ENABLED
  ? "后台连接与账号"
  : "后台连接状态";
