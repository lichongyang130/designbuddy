import test from "node:test";
import assert from "node:assert/strict";
import { hasValidBearerToken, isSafeSessionId } from "./security";

test("worker bearer token must match exactly", () => {
  const token = "a".repeat(48);
  assert.equal(hasValidBearerToken("Bearer " + token, token), true);
  assert.equal(hasValidBearerToken("Bearer " + token + "x", token), false);
  assert.equal(hasValidBearerToken("bearer " + token, token), false);
  assert.equal(hasValidBearerToken(undefined, token), false);
});

test("session IDs only allow filesystem-safe characters", () => {
  assert.equal(isSafeSessionId("preview_A8-x_123"), true);
  assert.equal(isSafeSessionId("../secrets"), false);
  assert.equal(isSafeSessionId("contains/slash"), false);
  assert.equal(isSafeSessionId(""), false);
});
