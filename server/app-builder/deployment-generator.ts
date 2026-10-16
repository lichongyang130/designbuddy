import type { AppArtifact, AppSchema } from "./app-schema";

export function generateDeploymentArtifacts(schema: AppSchema): AppArtifact[] {
  const isNext = schema.framework === "nextjs";
  const port = isNext ? 3000 : 4173;
  const dockerfile = [
    "FROM node:20-alpine AS build",
    "WORKDIR /app",
    "COPY package*.json ./",
    "RUN npm install",
    "COPY . .",
    "RUN npm run build",
    "",
    "FROM node:20-alpine AS runtime",
    "WORKDIR /app",
    "ENV NODE_ENV=production",
    "COPY --from=build /app ./",
    "EXPOSE " + port,
    "CMD [\"npm\", \"run\", \"start\"]",
    ""
  ].join("\n");

  const compose = [
    "services:",
    "  app:",
    "    build:",
    "      context: .",
    "    ports:",
    '      - "' + port + ":" + port + '"',
    "    environment:",
    "      NODE_ENV: production",
    "    restart: unless-stopped",
    "    healthcheck:",
    "      test: [\"CMD-SHELL\", \"node -e \\\"fetch('http://127.0.0.1:" + port + "').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))\\\"\"]",
    "      interval: 30s",
    "      timeout: 5s",
    "      retries: 3",
    ""
  ].join("\n");

  const dockerignore = [
    "node_modules",
    "dist",
    ".next",
    ".git",
    ".env",
    ".env.*",
    "!.env.example",
    "coverage",
    ""
  ].join("\n");

  return [
    { path: "Dockerfile", content: dockerfile },
    { path: "docker-compose.yml", content: compose },
    { path: ".dockerignore", content: dockerignore }
  ];
}
