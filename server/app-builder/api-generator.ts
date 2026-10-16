import type { AppArtifact, AppSchema } from "./app-schema";

function typescriptType(type: string): string {
  switch (type) {
    case "number": return "number";
    case "boolean": return "boolean";
    case "date": return "Date";
    default: return "string";
  }
}

function sqlType(type: string): string {
  switch (type) {
    case "number": return "DOUBLE PRECISION";
    case "boolean": return "BOOLEAN";
    case "date": return "DATE";
    default: return "TEXT";
  }
}

export function generateApiArtifacts(schema: AppSchema): AppArtifact[] {
  const routes = (schema.api ?? []).map((route) => ({
    name: route.name,
    method: route.method,
    path: route.path,
    entity: route.entity ?? null,
    description: route.description ?? ""
  }));

  const routesContent = [
    "export type GeneratedHttpMethod = \"GET\" | \"POST\" | \"PUT\" | \"PATCH\" | \"DELETE\";",
    "",
    "export interface GeneratedApiRoute {",
    "  name: string;",
    "  method: GeneratedHttpMethod;",
    "  path: string;",
    "  entity: string | null;",
    "  description: string;",
    "}",
    "",
    "/*",
    " * Generated route metadata only. Connect these definitions to authenticated",
    " * application handlers before exposing them publicly; this file does not",
    " * create database access or authorize requests on its own.",
    " */",
    "export const generatedApiRoutes: readonly GeneratedApiRoute[] = " +
      JSON.stringify(routes, null, 2) +
      ";",
    ""
  ].join("\n");

  const entities = schema.entities ?? [];
  const entityLines = [
    "/* Generated entity types. Re-run the app builder after changing app-schema.json. */"
  ];
  for (const entity of entities) {
    entityLines.push("", "export interface " + entity.name + " {");
    entityLines.push("  id?: string;");
    for (const field of entity.fields) {
      const optional = field.required ? "" : "?";
      entityLines.push("  " + field.name + optional + ": " + typescriptType(field.type) + ";");
    }
    entityLines.push("}");
  }
  if (entities.length === 0) {
    entityLines.push("", "export type GeneratedEntityMap = Record<string, never>;");
  }
  entityLines.push("");
  const entityTypesContent = entityLines.join("\n");

  const sqlLines = [
    "-- Generated PostgreSQL starter schema.",
    "-- Review constraints, indexes, ownership and migration strategy before production use.",
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
  ];
  for (const entity of entities) {
    const columns = [
      '  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()'
    ];
    for (const field of entity.fields) {
      columns.push(
        '  "' + field.name + '" ' + sqlType(field.type) +
        (field.required ? " NOT NULL" : " NULL")
      );
    }
    sqlLines.push(
      "",
      'CREATE TABLE IF NOT EXISTS "' + entity.name + '" (',
      columns.join(",\n"),
      ");"
    );
  }
  sqlLines.push("");
  const sqlContent = sqlLines.join("\n");

  return [
    { path: "server/generated/api-routes.ts", content: routesContent },
    { path: "server/generated/entity-types.ts", content: entityTypesContent },
    { path: "server/generated/schema.sql", content: sqlContent }
  ];
}
