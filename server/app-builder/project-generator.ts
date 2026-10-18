import {
  validateAppSchema,
  type AppArtifact,
  type AppSchema
} from "./app-schema";
import { generateApiArtifacts } from "./api-generator";
import { generateDeploymentArtifacts } from "./deployment-generator";
import { buildPageFiles } from "./page-builder";

export interface GeneratedProject {
  name: string;
  framework: AppSchema["framework"];
  files: AppArtifact[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function packageManifest(schema: AppSchema): Record<string, unknown> {
  const isNext = schema.framework === "nextjs";
  const dependencies: Record<string, string> = {
    react: "^19.0.0",
    "react-dom": "^19.0.0"
  };
  const devDependencies: Record<string, string> = {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    typescript: "^5.7.0"
  };

  if (isNext) {
    dependencies.next = "^15.1.0";
  } else {
    devDependencies.vite = "^6.0.0";
    devDependencies["@vitejs/plugin-react"] = "^4.3.0";
  }

  return {
    name: schema.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "generated-app",
    private: true,
    version: "0.1.0",
    scripts: isNext
      ? { dev: "next dev", build: "next build", start: "next start" }
      : { dev: "vite --host 0.0.0.0", build: "tsc --noEmit && vite build", start: "vite preview --host 0.0.0.0" },
    dependencies,
    devDependencies
  };
}

function viteArtifacts(schema: AppSchema): AppArtifact[] {
  const firstPage = schema.pages[0];
  const title = escapeHtml(firstPage.title);
  return [
    {
      path: "index.html",
      content: [
        "<!doctype html>",
        '<html lang="en">',
        "  <head>",
        '    <meta charset="UTF-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        "    <title>" + title + "</title>",
        "  </head>",
        "  <body>",
        '    <div id="root"></div>',
        '    <script type="module" src="/src/main.tsx"></script>',
        "  </body>",
        "</html>",
        ""
      ].join("\n")
    },
    {
      path: "src/main.tsx",
      content: [
        'import React from "react";',
        'import { createRoot } from "react-dom/client";',
        'import App from "./App";',
        "",
        'const root = document.getElementById("root");',
        'if (!root) throw new Error("Root element #root was not found.");',
        "createRoot(root).render(React.createElement(React.StrictMode, null, React.createElement(App)));",
        ""
      ].join("\n")
    },
    {
      path: "src/App.tsx",
      content: [
        'import React from "react";',
        'import MainPage from "./pages/' + firstPage.slug + '";',
        "",
        "export default function App() {",
        "  return React.createElement(MainPage);",
        "}",
        ""
      ].join("\n")
    },
    {
      path: "vite.config.ts",
      content: [
        'import { defineConfig } from "vite";',
        'import react from "@vitejs/plugin-react";',
        "",
        "export default defineConfig({ plugins: [react()] });",
        ""
      ].join("\n")
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          useDefineForClassFields: true,
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          skipLibCheck: true,
          moduleResolution: "Bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: true
        },
        include: ["src", "vite.config.ts"]
      }, null, 2) + "\n"
    }
  ];
}

function nextArtifacts(schema: AppSchema): AppArtifact[] {
  const firstPage = schema.pages[0];
  return [
    {
      path: "app/layout.tsx",
      content: [
        'import React from "react";',
        "",
        "export const metadata = { title: " + JSON.stringify(schema.name) + " };",
        "",
        "export default function RootLayout({ children }: { children: React.ReactNode }) {",
        '  return React.createElement("html", { lang: "en" },',
        '    React.createElement("body", null, children)',
        "  );",
        "}",
        ""
      ].join("\n")
    },
    {
      path: "app/page.tsx",
      content: [
        'import React from "react";',
        'import MainPage from "./' + firstPage.slug + '/page";',
        "",
        "export default function HomePage() {",
        "  return React.createElement(MainPage);",
        "}",
        ""
      ].join("\n")
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2017",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }]
        },
        include: ["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"],
        exclude: ["node_modules"]
      }, null, 2) + "\n"
    },
    {
      path: "next-env.d.ts",
      content: '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n'
    }
  ];
}

function readme(schema: AppSchema): string {
  return [
    "# " + schema.name,
    "",
    schema.description || "Generated application scaffold.",
    "",
    "## Getting started",
    "",
    "1. Install dependencies with npm install.",
    "2. Start development with npm run dev.",
    "3. Build production output with npm run build.",
    "",
    "## Generated structure",
    "",
    "- UI pages are generated from the validated app schema.",
    "- server/generated/api-routes.ts contains API route metadata; connect routes to real handlers, authentication, validation, and persistence before exposing them.",
    "- server/generated/entity-types.ts and server/generated/schema.sql provide starter entity models and PostgreSQL DDL.",
    "- Dockerfile and docker-compose.yml provide a starting point for container deployment.",
    "",
    "Generated output is a scaffold. Review generated code, install any framework-specific plugins required by the selected framework, add tests and secrets via environment variables, and run the build before production use.",
    ""
  ].join("\n");
}

/**
 * Convert a JSON-compatible app definition into a set of source artifacts.
 * The function returns files; it does not write to disk or deploy the result.
 */
export function generateProject(input: unknown): GeneratedProject {
  const schema = validateAppSchema(input);
  const files: AppArtifact[] = [
    { path: "app-schema.json", content: JSON.stringify(schema, null, 2) + "\n" },
    { path: "package.json", content: JSON.stringify(packageManifest(schema), null, 2) + "\n" },
    ...buildPageFiles(schema),
    ...generateApiArtifacts(schema),
    ...generateDeploymentArtifacts(schema),
    ...(schema.framework === "nextjs" ? nextArtifacts(schema) : viteArtifacts(schema)),
    { path: "README.md", content: readme(schema) }
  ];

  const paths = new Set<string>();
  for (const file of files) {
    if (paths.has(file.path)) {
      throw new Error("Project generator produced duplicate path: " + file.path);
    }
    paths.add(file.path);
  }

  return { name: schema.name, framework: schema.framework, files };
}
