import type { SkillPermission } from "../../shared/skillRuntime";

/**
 * The tool permissions each skill really uses, taken from the executor code
 * rather than from the description text:
 *
 * - every skill reads the uploaded file and writes its artifacts on this machine;
 * - `data.connect` may fetch a remote source that the server explicitly allows;
 * - `code.build` starts a build process, `audio.transcribe-en` starts the local
 *   decoder process, `web.verify` / `test.browser` start a browser that visits
 *   the declared origin, and PPTX compose/inspect can start the installed
 *   LibreOffice engine (WASM worker or platform-native process);
 * - `document.summarize` and `image.generate` send content to a third-party
 *   model, `collaboration.sync` writes to a third-party calendar or mailbox.
 *
 * A permission is a statement about the executor, not a promise about the result.
 */
const elevated: Record<string, SkillPermission[]> = {
  "data.connect": ["network"],
  "code.build": ["subprocess"],
  "audio.transcribe-en": ["subprocess"],
  "web.verify": ["network", "subprocess"],
  "test.browser": ["network", "subprocess"],
  "document.summarize": ["external.ai"],
  "image.generate": ["external.image"],
  "collaboration.sync": ["external.calendar", "external.email"],
  "slides.compose": ["subprocess"],
  "slides.inspect": ["subprocess"],
};

const localOnly: SkillPermission[] = ["local.read", "local.write"];

/** The permissions a skill asks for, in a stable order. */
export function skillPermissions(skillId: string): SkillPermission[] {
  const extra = elevated[skillId] ?? [];
  const all = [...localOnly, ...extra];
  const order: SkillPermission[] = [
    "local.read",
    "local.write",
    "network",
    "subprocess",
    "external.ai",
    "external.image",
    "external.calendar",
    "external.email",
  ];
  return order.filter((permission) => all.includes(permission));
}
