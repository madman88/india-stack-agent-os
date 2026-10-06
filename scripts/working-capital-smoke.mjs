import assert from "node:assert/strict";
import { evaluateWorkingCapital } from "../services/shared/working-capital.mjs";
import { readApprovedAaCashflow } from "../services/shared/approved-aa-cashflow.mjs";
import { normalizeSetuCashflowAttestation } from "../services/shared/setu-aa-normalizers.mjs";
import { handleAaSandbox } from "../services/sites/aa-sandbox.mjs";
import { testDb, testOwnerHeaders } from "./d1-test-db.mjs";

const offer = { lender: "Simulated lender", apr: "16.8%", fee: "Rs 680", amount: "Rs 80,000" };
const base = { inflow90d: 600000, outflow90d: 300000, observedDays: 90, volatility: "moderate", dataQuality: { decisionReady: true }, reportedBalance: 40000 };
const calculate = (patch = {}, terms = offer) => evaluateWorkingCapital("ravi-stores", { ...base, ...patch }, terms);
const normal = calculate();
assert(normal.recommendation.amount > 0 && normal.recommendation.amount < 72000);
assert(calculate({ inflow90d: 450000 }).recommendation.amount < normal.recommendation.amount, "lower inflows lower amount");
assert(calculate({ outflow90d: 450000 }).recommendation.amount < normal.recommendation.amount, "higher outflows lower amount");
assert(calculate({ volatility: "high" }).recommendation.amount < normal.recommendation.amount, "volatility reduces budget");
assert(calculate({ inflow90d: 6000000 }).recommendation.amount === 72000, "respect demand target");
assert(calculate({}, { ...offer, amount: "Rs 10,000" }).recommendation.amount <= 10000, "respect offer limit");
assert(normal.calculation.estimatedRepayment <= normal.calculation.repaymentBudget, "repayment fits allocated budget");
for (const patch of [{ outflow90d: 900000 }, { dataQuality: { decisionReady: false } }, { observedDays: 7 }, { inflow90d: NaN }, { volatility: "unknown" }]) {
  assert.equal(calculate(patch).recommendation.status, "hold");
  assert.equal(calculate(patch).recommendation.amount, 0);
}
assert.equal(calculate({}, { ...offer, fee: "Rs 999999" }).recommendation.amount, 0);
assert.equal(calculate({}, { ...offer, apr: undefined }).recommendation.amount, 0);

const consentId = "11111111-1111-1111-1111-111111111111";
const sessionId = "22222222-2222-2222-2222-222222222222";
const now = Date.now();
const range = { from: new Date(now - 90 * 86400000).toISOString(), to: new Date(now).toISOString() };
let consentStatus = "ACTIVE";
let expiry = new Date(now + 86400000).toISOString();
let sessionStatus = "COMPLETED";
let sessionConsent = consentId;
let listed = true;
let rawRange = range;
const txDate = new Date(now - 86400000).toISOString();
const rawSession = () => ({ id: sessionId, consentId: sessionConsent, status: sessionStatus, dataRange: rawRange,
  fips: [{ accounts: [{ status: "DELIVERED", data: { account: { summary: { currentBalance: "40000" }, transactions: { transaction: [
    { type: "CREDIT", amount: "600000", transactionTimestamp: txDate },
    { type: "DEBIT", amount: "150000", transactionTimestamp: txDate },
    { type: "DEBIT", amount: "150000", transactionTimestamp: txDate }
  ] } } } }] }] });
const fakeGateway = { request: async (path) => {
  if (path.includes("data-sessions")) return { dataSessions: listed ? [{ sessionId }] : [] };
  if (path.includes("/consents/")) return { id: consentId, status: consentStatus, detail: { consentExpiry: expiry, dataRange: range } };
  return rawSession();
} };
assert.equal((await readApprovedAaCashflow(fakeGateway, consentId, () => now)).outflow90d, 300000);
consentStatus = "REVOKED";
await assert.rejects(readApprovedAaCashflow(fakeGateway, consentId, () => now), /not active/);
consentStatus = "ACTIVE";
expiry = new Date(now - 1000).toISOString();
await assert.rejects(readApprovedAaCashflow(fakeGateway, consentId, () => now), /expired/);
expiry = new Date(now + 86400000).toISOString();
sessionStatus = "PARTIAL";
await assert.rejects(readApprovedAaCashflow(fakeGateway, consentId, () => now), /not complete/);
sessionStatus = "COMPLETED";
sessionConsent = "another-consent";
await assert.rejects(readApprovedAaCashflow(fakeGateway, consentId, () => now), /does not belong/);
sessionConsent = consentId;
rawRange = { ...range, from: new Date(now - 100 * 86400000).toISOString() };
await assert.rejects(readApprovedAaCashflow(fakeGateway, consentId, () => now), /exceeds/);
rawRange = range;
listed = false;
await assert.rejects(readApprovedAaCashflow(fakeGateway, consentId, () => now), /No bank data/);
listed = true;
const undated = rawSession();
delete undated.fips[0].accounts[0].data.account.transactions.transaction[0].transactionTimestamp;
assert.equal(normalizeSetuCashflowAttestation(undated).dataQuality.decisionReady, false);

const env = { DB: testDb(), AA_ADAPTER_MODE: "sandbox", AA_OWNER_EMAIL: "owner@example.test", AA_SANDBOX_CONSENT_ID: consentId, AA_ACCESS_TOKEN: "test-token", AA_PRODUCT_INSTANCE_ID: "test-product" };
const request = (path, key = "key", body = {}) => new Request(`https://example.test/v1/${path}`, { method: "POST", headers: key === "key" ? testOwnerHeaders : key ? { "x-business-id": "ravi-stores" } : {}, body: JSON.stringify(body) });
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url) => Response.json(await fakeGateway.request(new URL(url).pathname + new URL(url).search));
  assert.equal(await handleAaSandbox(request("decisions/working-capital", null), env), null);
  assert.equal((await handleAaSandbox(request("decisions/working-capital", "wrong"), env)).status, 401);
  const response = await handleAaSandbox(request("decisions/working-capital", "key", { cashflow: { inflow90d: 9999999 } }), env, { loanOffers: [offer] });
  const decision = await response.json();
  assert.equal(decision.evidence.cashflow.inflow90d, 600000, "ignore browser-supplied evidence");
  assert.equal(decision.recommendation.amount, normal.recommendation.amount);
  assert.equal((await handleAaSandbox(request("approvals"), env)).status, 409);
  consentStatus = "REVOKED";
  const held = await (await handleAaSandbox(request("decisions/working-capital"), env, { loanOffers: [offer] })).json();
  assert.equal(held.recommendation.amount, 0, "hold instead of falling back to fixtures");
  assert.equal(held.recommendation.status, "hold");
} finally { globalThis.fetch = originalFetch; }
console.log("Working-capital sensitivity, provenance and hold checks passed");
