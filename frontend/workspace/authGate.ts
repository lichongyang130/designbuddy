/**
 * Login/registration gate switch.
 *
 * `false` (current): the app opens directly for everyone with no login wall.
 * /login, /register and /auth redirect home, and the login/register/logout
 * controls in the server panel and account menu are hidden. The
 * LoginPage/RegisterPage components, the backend auth endpoints, and the
 * token fallback all stay in place, so flipping this back to `true`
 * restores the gated experience (together with the gate-era tests that
 * are parked in git history while the gate is off).
 */
export const AUTH_GATE_ENABLED = false;

/**
 * Server-status dialog title, matching whatever the panel currently offers.
 * The settings window opens the same dialog, so it shares this label.
 */
export const SERVER_PANEL_TITLE = AUTH_GATE_ENABLED
  ? "后台连接与账号"
  : "后台连接状态";
