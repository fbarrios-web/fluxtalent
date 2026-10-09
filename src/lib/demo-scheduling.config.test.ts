import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_COPY_EMAILS, DEMO_ORGANIZER_EMAIL, DEMO_TIMEZONE, DEMO_WHATSAPP } from "./demo-scheduling.config";

describe("demo scheduling rules", () => {
  it("Florencia always owns the demo calendar event", () => {
    assert.equal(DEMO_ORGANIZER_EMAIL, "fbarrios@fluxtalent.com.ar");
  });

  it("both sales addresses are copied on every demo", () => {
    assert.deepEqual(DEMO_COPY_EMAILS, ["fbarrios@fluxtalent.com.ar", "ccominicini@fluxtalent.com.ar"]);
  });

  it("confirmation support uses the requested WhatsApp and Buenos Aires timezone", () => {
    assert.equal(DEMO_WHATSAPP, "3519090777");
    assert.equal(DEMO_TIMEZONE, "America/Argentina/Buenos_Aires");
  });
});