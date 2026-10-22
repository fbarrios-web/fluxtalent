import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyApprovedPayment } from "./billing-renew.server";
import { getCurrentCycle, getOrgPlan, getCvsThisCycle, getNewVacanciesThisCycle } from "./plan-limits";
import { canWriteOrg } from "./entitlement";

const org = {
  subscription_status: "active", plan_price_ars: 48000, cv_limit_override: 1000,
  usage_cycle_start: "2026-10-22T13:11:00.000Z", current_period_end: "2026-11-21T13:11:00.000Z",
};
function client(filters: Array<[string, string]> = []) {
  const query = {
    select: () => query, eq: () => query, not: () => query,
    gte: (_: string, v: string) => { filters.push(["gte", v]); return query; },
    lt: (_: string, v: string) => { filters.push(["lt", v]); return query; },
    maybeSingle: async () => ({ data: org }),
    then: (resolve: (value: { count: number }) => unknown) => resolve({ count: 0 }),
  };
  return { from: () => query };
}
describe("paid renewal quotas", () => {
  it("Bridge keeps its agreed 1,000 CVs and Pro's 10 vacancies", async () => {
    const plan = await getOrgPlan(client(), "bridge");
    assert.equal(plan.maxCvsPerMonth, 1000);
    assert.equal(plan.maxVacancies, 10);
    assert.equal(plan.maxNewVacanciesPerCycle, 10);
  });
  it("renewal restores write access", () => {
    assert.equal(canWriteOrg(org, Date.parse("2026-10-22T14:00:00Z")), true);
    assert.equal(canWriteOrg({ ...org, current_period_end: "2026-10-21T20:58:07Z" }, Date.parse("2026-10-22T14:00:00Z")), false);
  });
  it("CVs and new vacancies count only the renewed cycle", async () => {
    const filters: Array<[string, string]> = [];
    const cycle = await getCurrentCycle(client(), "bridge");
    assert.equal(cycle.start.toISOString(), org.usage_cycle_start);
    assert.equal(await getCvsThisCycle(client(filters), "bridge"), 0);
    assert.equal(await getNewVacanciesThisCycle(client(filters), "bridge"), 0);
    assert.deepEqual(filters, [["gte", org.usage_cycle_start], ["lt", org.current_period_end], ["gte", org.usage_cycle_start], ["lt", org.current_period_end]]);
  });
  it("approval delegates to the atomic payment operation and preserves retry results", async () => {
    let called = false;
    const sb = { rpc: async (name: string, input: Record<string, unknown>) => {
      called = true;
      assert.equal(name, "apply_verified_payment");
      assert.equal(input._payment_id, "renewal-123");
      assert.equal(input._org_id, "bridge");
      return { data: { periodEnd: org.current_period_end, duplicate: true }, error: null };
    } };
    const result = await applyApprovedPayment(sb, { orgId: "bridge", providerPaymentId: "renewal-123", amountArs: 48000 });
    assert.equal(called, true);
    assert.equal(result.duplicate, true);
    assert.equal(result.periodEnd, org.current_period_end);
  });
  it("failed activation is thrown so the provider retries", async () => {
    await assert.rejects(applyApprovedPayment({ rpc: async () => ({ error: new Error("write failed") }) }, {
      orgId: "bridge", providerPaymentId: "renewal-123", amountArs: 48000,
    }), /write failed/);
  });
});