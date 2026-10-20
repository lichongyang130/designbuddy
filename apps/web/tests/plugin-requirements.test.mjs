import test from "node:test";
import assert from "node:assert/strict";
import { requirementAction } from "../src/components/pluginRequirements.ts";

// The dialog button label and the action it performs are resolved from one map,
// so a mismatch here would send someone to a settings page that cannot help.

test("each known requirement kind maps to a destination that can actually fix it", () => {
  const credential = requirementAction("credential");
  assert.equal(credential.kind, "settings-models");
  assert.match(credential.label, /密钥/);

  const account = requirementAction("account");
  assert.equal(account.kind, "settings-apps");

  for (const kind of ["material", "decision"]) {
    assert.equal(requirementAction(kind).kind, "composer", `${kind} is answered in the composer`);
  }
});

test("a server-side environment requirement never claims the UI can fix it", () => {
  const environment = requirementAction("environment");
  assert.equal(environment.kind, "none", "no settings page can install a server dependency");
  assert.match(environment.hint, /部署者/);
});

test("unknown kinds degrade to an explanation instead of a broken button", () => {
  const unknown = requirementAction("something-new");
  assert.equal(unknown.kind, "none");
  assert.ok(unknown.label.length > 0);
  assert.ok(unknown.hint.length > 0);
});
