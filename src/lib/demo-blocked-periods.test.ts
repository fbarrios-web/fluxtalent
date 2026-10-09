import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { excludeBlockedSlots, periodsOverlap } from "./scheduling-overlap.server";

describe("demo blocked periods", () => {
  const slot = { start: "2026-10-12T13:00:00.000Z", end: "2026-10-12T13:30:00.000Z" };

  it("removes a demo slot that overlaps a blocked period", () => {
    const result = excludeBlockedSlots([slot], [{ startsAt: "2026-10-12T12:30:00.000Z", endsAt: "2026-10-12T14:00:00.000Z" }]);
    assert.deepEqual(result, []);
  });

  it("keeps a slot that starts exactly when a block ends", () => {
    assert.equal(periodsOverlap(slot, { startsAt: "2026-10-12T12:00:00.000Z", endsAt: slot.start }), false);
    assert.deepEqual(excludeBlockedSlots([slot], [{ startsAt: "2026-10-12T12:00:00.000Z", endsAt: slot.start }]), [slot]);
  });
});