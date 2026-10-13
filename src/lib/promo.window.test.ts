import { test } from "node:test";
import assert from "node:assert/strict";
import { isPromoSignupWindow } from "./promo.ts";
test("cuentas de octubre en adelante son elegibles", () => {
  assert.equal(isPromoSignupWindow("2026-10-11T15:00:00Z"), true);
  assert.equal(isPromoSignupWindow("2027-03-01T00:00:00Z"), true);
});
test("cuentas previas a septiembre no", () => {
  assert.equal(isPromoSignupWindow("2026-08-20T00:00:00Z"), false);
});
