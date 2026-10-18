export type AppFramework = "react-vite" | "nextjs";

export type FieldType = "string" | "number" | "boolean" | "date";

export interface UIComponent {
  type: string;
  text?: string;
  props?: Record<string, string | number | boolean | null>;
  children?: UIComponent[];
}

export interface PageDefinition {
  slug: string;
  title: string;
  components: UIComponent[];
}

export interface EntityField {
  name: string;
  type: FieldType;
  required?: boolean;
}

export interface EntityDefinition {
  name: string;
  fields: EntityField[];
}

export interface ApiEndpointDefinition {
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  entity?: string;
  description?: string;
}

export interface AppSchema {
  name: string;
  description?: string;
  framework: AppFramework;
  pages: PageDefinition[];
  entities?: EntityDefinition[];
  api?: ApiEndpointDefinition[];
}

export interface AppArtifact {
  path: string;
  content: string;
}

const identifierPattern = /^[A-Za-z][A-Za-z0-9_]*$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid app schema: '${field}' must be a non-empty string.`);
  }
  return value.trim();
}

/**
 * Validate untrusted model/user input before any file generation.
 * This intentionally avoids eval and does not accept arbitrary source code.
 */
export function validateAppSchema(input: unknown): AppSchema {
  if (!isRecord(input)) {
    throw new Error("Invalid app schema: expected an object.");
  }

  const name = requireString(input.name, "name");
  const framework = input.framework;
  if (framework !== "react-vite" && framework !== "nextjs") {
    throw new Error("Invalid app schema: framework must be 'react-vite' or 'nextjs'.");
  }

  const rawPages = input.pages;
  if (!Array.isArray(rawPages) || rawPages.length === 0) {
    throw new Error("Invalid app schema: at least one page is required.");
  }

  const pages: PageDefinition[] = rawPages.map((raw, index) => {
    if (!isRecord(raw)) {
      throw new Error(`Invalid app schema: pages[${index}] must be an object.`);
    }
    const slug = requireString(raw.slug, `pages[${index}].slug`).toLowerCase();
    if (!slugPattern.test(slug)) {
      throw new Error(`Invalid app schema: invalid page slug '${slug}'. Use lowercase letters, digits and hyphens.`);
    }
    if (!Array.isArray(raw.components)) {
      throw new Error(`Invalid app schema: pages[${index}].components must be an array.`);
    }
    return {
      slug,
      title: requireString(raw.title, `pages[${index}].title`),
      components: raw.components.map((component, componentIndex) =>
        validateComponent(component, `pages[${index}].components[${componentIndex}]`)
      )
    };
  });

  const seenSlugs = new Set<string>();
  for (const page of pages) {
    if (seenSlugs.has(page.slug)) {
      throw new Error(`Invalid app schema: duplicate page slug '${page.slug}'.`);
    }
    seenSlugs.add(page.slug);
  }

  const entities = input.entities === undefined ? [] : validateEntities(input.entities);
  const api = input.api === undefined ? [] : validateApi(input.api);

  return {
    name,
    description: typeof input.description === "string" ? input.description.trim() : "",
    framework,
    pages,
    entities,
    api
  };
}

function validateComponent(value: unknown, field: string): UIComponent {
  if (!isRecord(value)) {
    throw new Error(`Invalid app schema: ${field} must be an object.`);
  }

  const type = requireString(value.type, `${field}.type`).toLowerCase();
  const props: UIComponent["props"] = {};
  if (value.props !== undefined) {
    if (!isRecord(value.props)) {
      throw new Error(`Invalid app schema: ${field}.props must be an object.`);
    }
    for (const [key, propValue] of Object.entries(value.props)) {
      if (
        typeof propValue === "string" ||
        typeof propValue === "number" ||
        typeof propValue === "boolean" ||
        propValue === null
      ) {
        props[key] = propValue;
      } else {
        throw new Error(`Invalid app schema: ${field}.props.${key} must be a scalar value.`);
      }
    }
  }

  let children: UIComponent[] | undefined;
  if (value.children !== undefined) {
    if (!Array.isArray(value.children)) {
      throw new Error(`Invalid app schema: ${field}.children must be an array.`);
    }
    children = value.children.map((child, index) =>
      validateComponent(child, `${field}.children[${index}]`)
    );
  }

  return {
    type,
    ...(typeof value.text === "string" ? { text: value.text } : {}),
    ...(Object.keys(props).length ? { props } : {}),
    ...(children ? { children } : {})
  };
}

function validateEntities(value: unknown): EntityDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid app schema: entities must be an array.");
  }
  const names = new Set<string>();
  return value.map((raw, index) => {
    if (!isRecord(raw)) {
      throw new Error(`Invalid app schema: entities[${index}] must be an object.`);
    }
    const name = requireString(raw.name, `entities[${index}].name`);
    if (!identifierPattern.test(name) || names.has(name)) {
      throw new Error(`Invalid app schema: entity name '${name}' is invalid or duplicated.`);
    }
    names.add(name);
    if (!Array.isArray(raw.fields)) {
      throw new Error(`Invalid app schema: entities[${index}].fields must be an array.`);
    }
    const fields = raw.fields.map((field, fieldIndex): EntityField => {
      if (!isRecord(field)) {
        throw new Error(`Invalid app schema: entities[${index}].fields[${fieldIndex}] must be an object.`);
      }
      const fieldName = requireString(field.name, `entities[${index}].fields[${fieldIndex}].name`);
      const type = field.type;
      if (!identifierPattern.test(fieldName) || !["string", "number", "boolean", "date"].includes(String(type))) {
        throw new Error(`Invalid app schema: invalid field definition in entity '${name}'.`);
      }
      return {
        name: fieldName,
        type: type as FieldType,
        ...(typeof field.required === "boolean" ? { required: field.required } : {})
      };
    });
    return { name, fields };
  });
}

function validateApi(value: unknown): ApiEndpointDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid app schema: api must be an array.");
  }
  return value.map((raw, index) => {
    if (!isRecord(raw)) {
      throw new Error(`Invalid app schema: api[${index}] must be an object.`);
    }
    const name = requireString(raw.name, `api[${index}].name`);
    if (!identifierPattern.test(name)) {
      throw new Error(`Invalid app schema: API name '${name}' is invalid.`);
    }
    const method = raw.method;
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(method))) {
      throw new Error(`Invalid app schema: unsupported method for API '${name}'.`);
    }
    const path = requireString(raw.path, `api[${index}].path`);
    if (!path.startsWith("/") || path.includes("..")) {
      throw new Error(`Invalid app schema: API path '${path}' must be absolute and must not contain '..'.`);
    }
    return {
      name,
      method: method as ApiEndpointDefinition["method"],
      path,
      ...(typeof raw.entity === "string" ? { entity: raw.entity } : {}),
      ...(typeof raw.description === "string" ? { description: raw.description } : {})
    };
  });
}
