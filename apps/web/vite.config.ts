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
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("design-templates/catalog.json")) {
            return "catalog-templates";
          }
          if (id.includes("plugins/_official/catalog.json")) {
            return "catalog-plugins";
          }
          if (id.includes("skills/catalog.json")) {
            return "catalog-skills";
          }
          if (id.includes("node_modules/pptxgenjs") || id.includes("node_modules/jszip") || id.includes("node_modules/fflate")) {
            return "vendor-export";
          }
          if (id.includes("node_modules/react-dom/server")) {
            return "vendor-react-ssr";
          }
          if (id.includes("node_modules/zustand")) {
            return "vendor-state";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) {
            return "vendor-react";
          }
          if (id.includes("frontend/workspace/i18nCatalogs/")) {
            return /\/(ja|ko|th|zh-TW|ar)\.ts$/.test(id) ? "i18n-rtl-cjk" : "i18n-latin";
          }
          if (id.includes("SettingsWindow") || id.includes("SettingsSections")) {
            return "settings-ui";
          }
          if (id.includes("HomeCommandPalette") || id.includes("promptCatalogSeeds")) {
            return "command-palette";
          }
          if (id.includes("inspiration/samples/kit/sets/")) {
            return /\/(paperhouse|campus|paws|roots|forme|atelier|tide|morrow|daylight)/.test(id)
              ? "inspiration-kit-core"
              : "inspiration-kit-extra";
          }
          if (id.includes("inspiration/samples/")) {
            if (/\/(forme|atelier)\//.test(id)) return "inspiration-samples-craft";
            if (/\/(tide|morrow|daylight|roots)\//.test(id)) return "inspiration-samples-domain";
            return "inspiration-samples-core";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: [
      ".e2b.app",
      ...(env.DESIGNBUDDY_PUBLIC_ORIGIN
        ? [new URL(env.DESIGNBUDDY_PUBLIC_ORIGIN).hostname]
        : []),
      ...(env.DESIGNBUDDY_PUBLIC_HOST ? env.DESIGNBUDDY_PUBLIC_HOST.split(",") : []),
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
