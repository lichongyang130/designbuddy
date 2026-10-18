import type { AppArtifact, AppSchema, PageDefinition, UIComponent } from "./app-schema";

const TAG_BY_TYPE: Record<string, string> = {
  container: "main",
  stack: "section",
  card: "article",
  heading: "h2",
  text: "p",
  button: "button",
  input: "input",
  image: "img",
  link: "a",
  list: "ul",
  listitem: "li",
  form: "form"
};

const ALLOWED_PROPS = new Set([
  "id", "className", "type", "placeholder", "href", "alt", "src",
  "name", "value", "disabled", "title", "role", "aria-label"
]);
const VOID_TAGS = new Set(["input", "img"]);

function pascalCase(value: string): string {
  const parts = value.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const result = parts.map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  return /^[A-Za-z]/.test(result) ? result : "Generated" + result;
}

function buildProps(component: UIComponent): Record<string, string | number | boolean | null> {
  const props: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(component.props ?? {})) {
    if (!ALLOWED_PROPS.has(key)) continue;
    if (key === "href" && typeof value === "string" && !value.startsWith("/") && !value.startsWith("#") && !/^https?:\/\//i.test(value) && !value.startsWith("mailto:")) {
      continue;
    }
    if (key === "src" && typeof value === "string" && !value.startsWith("/") && !/^https?:\/\//i.test(value)) {
      continue;
    }
    props[key] = value;
  }
  return props;
}

function renderNode(component: UIComponent): string {
  const tag = TAG_BY_TYPE[component.type] ?? "div";
  const props = buildProps(component);
  const args = [JSON.stringify(tag), JSON.stringify(props)];

  if (component.text && !VOID_TAGS.has(tag)) {
    args.push(JSON.stringify(component.text));
  }
  if (!VOID_TAGS.has(tag)) {
    for (const child of component.children ?? []) {
      args.push(renderNode(child));
    }
  }

  return "React.createElement(" + args.join(", ") + ")";
}

function componentName(page: PageDefinition): string {
  return pascalCase(page.slug) + "Page";
}

export function buildPageFiles(schema: AppSchema): AppArtifact[] {
  return schema.pages.map((page) => {
    const component = componentName(page);
    const tree = page.components.length
      ? page.components.map(renderNode).join(",\n      ")
      : 'React.createElement("main", null, "This page is ready for your design.")';
    const content = [
      'import React from "react";',
      "",
      "export default function " + component + "() {",
      "  return React.createElement(React.Fragment, null,",
      "      " + tree,
      "  );",
      "}"
    ].join("\n") + "\n";

    const path = schema.framework === "nextjs"
      ? "app/" + page.slug + "/page.tsx"
      : "src/pages/" + page.slug + ".tsx";

    return { path, content };
  });
}
