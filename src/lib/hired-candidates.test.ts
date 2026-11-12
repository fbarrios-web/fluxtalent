import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HIRED_API_ORG_ID, serializeHiredCandidate, type HiredApplication } from "./hired-candidates";
import { validHiredApiKey, handleHiredCandidates } from "./hired-candidates.server";

const application: HiredApplication = {
  id: "candidate", org_id: HIRED_API_ORG_ID, vacancy_id: "vacancy", stage: "hired",
  first_name: "Ana", last_name: "Prueba", email: "ana@example.test", phone: "12345678", linkedin: null,
  ai_summary: "Resumen guardado", application_events: [
    { type: "stage_change", payload: { stage: "hired" }, created_at: "2026-11-12T10:00:00Z" },
    { type: "stage_change", payload: { stage: "hired" }, created_at: "2026-11-12T11:00:00Z" },
    { type: "stage_change", payload: { stage: "offer" }, created_at: "2026-11-11T10:00:00Z" },
  ],
};

describe("hired candidates API rules", () => {
  it("returns only candidates currently hired", () => {
    assert.equal(serializeHiredCandidate({ ...application, stage: "offer" }), null);
    assert.equal(serializeHiredCandidate(application)?.nombre, "Ana");
  });
  it("never returns candidates from a different organization", () => {
    assert.equal(serializeHiredCandidate({ ...application, org_id: "another-org" }), null);
  });
  it("returns the start of the current hired stage and preserves saved report/contact", () => {
    const result = serializeHiredCandidate(application);
    assert.equal(result?.contratado_desde, "2026-11-12T10:00:00Z");
    assert.equal(result?.resumen_informe, "Resumen guardado");
    assert.equal(result?.contacto.email, "ana@example.test");
  });
  it("does not invent a hiring date when history is missing", () => {
    assert.equal(serializeHiredCandidate({ ...application, application_events: [] })?.contratado_desde, null);
  });
  it("requires an exact strong API key, rejecting missing and incorrect keys", () => {
    const testKey = "test-only-key-not-a-real-secret-123456789";
    assert.equal(validHiredApiKey(testKey, testKey), true);
    assert.equal(validHiredApiKey(null, testKey), false);
    assert.equal(validHiredApiKey("incorrect", testKey), false);
    assert.equal(validHiredApiKey(testKey, undefined), false);
  });
  it("fails closed without a configured key", async () => {
    const original = process.env["HIRED_CANDIDATES_API_KEY"];
    delete process.env["HIRED_CANDIDATES_API_KEY"];
    try {
      const response = await handleHiredCandidates(new Request("https://example.test/api/hired-candidates"));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.equal("candidatos" in await response.json(), false);
    } finally {
      if (original === undefined) delete process.env["HIRED_CANDIDATES_API_KEY"];
      else process.env["HIRED_CANDIDATES_API_KEY"] = original;
    }
  });
});