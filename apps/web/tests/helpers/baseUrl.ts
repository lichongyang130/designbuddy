/**
 * Origin for pages opened through a bare `browser.newContext()`, which does not
 * inherit the config `baseURL`. Keeps ad-hoc contexts on whatever port the dev
 * server / CI actually listens on instead of a hard-coded 5173.
 */
export const baseURL = `http://127.0.0.1:${process.env.DESIGNBUDDY_WEB_PORT || 5173}`;
