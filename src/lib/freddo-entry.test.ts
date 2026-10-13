import { test } from "node:test";
import assert from "node:assert/strict";
import { isFreddoEntry } from "./freddo-entry.ts";

test("Freddo's home shows the candidate/collaborator choice", () => {
  assert.equal(isFreddoEntry("freddo.fluxtalent.com.ar", ""), true);
  assert.equal(isFreddoEntry("www.freddo.fluxtalent.com.ar", ""), true);
});
test("the main FLUX home stays unchanged", () => {
  assert.equal(isFreddoEntry("fluxtalent.com.ar", ""), false);
});
test("Freddo can be reviewed in preview", () => {
  assert.equal(isFreddoEntry("localhost", "?org=freddo"), true);
});