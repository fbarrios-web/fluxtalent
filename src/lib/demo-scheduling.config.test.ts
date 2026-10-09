import { describe, expect, test } from "vitest";
import { DEMO_COPY_EMAILS, DEMO_ORGANIZER_EMAIL, DEMO_TIMEZONE, DEMO_WHATSAPP } from "./demo-scheduling.config";

describe("demo scheduling rules", () => {
  test("Florencia always owns the demo calendar event", () => {
    expect(DEMO_ORGANIZER_EMAIL).toBe("fbarrios@fluxtalent.com.ar");
  });

  test("both sales addresses are copied on every demo", () => {
    expect(DEMO_COPY_EMAILS).toEqual(["fbarrios@fluxtalent.com.ar", "ccominicini@fluxtalent.com.ar"]);
  });

  test("confirmation support uses the requested WhatsApp and Buenos Aires timezone", () => {
    expect(DEMO_WHATSAPP).toBe("3519090777");
    expect(DEMO_TIMEZONE).toBe("America/Argentina/Buenos_Aires");
  });
});