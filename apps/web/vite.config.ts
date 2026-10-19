import { env } from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites under /<repository>/.
// Keep "/" for local development and use "/new/" in GitHub Actions.
export default defineConfig({
  base: env.GITHUB_ACTIONS === "true" ? "/new/" : "/",
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "zustand"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: [
      ".e2b.app",
      ".arena.site",
      ...(env.DESIGNBUDDY_PUBLIC_ORIGIN
        ? [new URL(env.DESIGNBUDDY_PUBLIC_ORIGIN).hostname]
        : []),
      ...(env.DESIGNBUDDY_PUBLIC_HOST ? [env.DESIGNBUDDY_PUBLIC_HOST] : []),
    ],
    proxy: {
      "/api": {
        target: env.DESIGNBUDDY_API_TARGET || "http://127.0.0.1:8787",
        changeOrigin: false,
        configure(proxy) {
          // The local daemon uses a same-origin check for browser session creation. Preserve
          // the browser-facing host through Vite's proxy (including the Arena preview host),
          // rather than allowing the proxy target host to become the CSRF comparison target.
          proxy.on("proxyReq", (proxyRequest, request) => {
            if (request.headers.host) proxyRequest.setHeader("host", request.headers.host);
          });
          proxy.on("error", (_error, _req, res) => {
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(503, {
                "Content-Type": "application/json; charset=utf-8",
              });
              res.end(
                JSON.stringify({
                  error: "后台服务未启动，请运行 pnpm local:daemon。",
                  code: "BACKEND_UNAVAILABLE",
                }),
              );
            }
          });
        },
      },
    },
    fs: {
      allow: [fileURLToPath(new URL("../../", import.meta.url))],
    },
  },
});
