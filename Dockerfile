FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY . .
# Do not install Electron: this is the web/server deployment, not the desktop app.
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm --filter designbuddy --filter designbuddy-web... install --frozen-lockfile
RUN pnpm exec tsc -p server/tsconfig.local.json \
    && GITHUB_ACTIONS=false pnpm --filter designbuddy-web build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg python3 fonts-noto-cjk poppler-utils libreoffice-writer libreoffice-impress \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/data /app/.cache && chown -R node:node /app/data /app/.cache
ENV NODE_ENV=production DESIGNBUDDY_HOST=0.0.0.0 DESIGNBUDDY_PORT=8787
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/local/server/local-daemon.js"]
