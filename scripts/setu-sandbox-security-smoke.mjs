import assert from "node:assert/strict";
import { createSetuGateway } from "../services/shared/setu-aa-gateway.mjs";
import { normalizeSetuCashflowAttestation } from "../services/shared/setu-aa-normalizers.mjs";
import { handleAaSandbox } from "../services/sites/aa-sandbox.mjs";
import { testDb, testOwnerHeaders } from "./d1-test-db.mjs";

let now = 0;
let logins = 0;
let rejectToken = false;
const config = { AA_CLIENT_ID: "test-client", AA_CLIENT_SECRET: "test-secret", AA_PRODUCT_INSTANCE_ID: "test-product" };
const gateway = createSetuGateway(config, async (url, options) => {
  if (String(url).includes("/users/login")) {
    logins++;
    assert.equal(JSON.parse(options.body).grant_type, "client_credentials");
    return Response.json({ access_token: `token-${logins}`, expires_in: 300 });
  }
  assert.equal(options.headers["x-product-instance-id"], "test-product");
  if (rejectToken) { rejectToken = false; return new Response(null, { status: 401 }); }
  return Response.json({ ok: true });
}, () => now);
await Promise.all([gateway.request("/v2/fips"), gateway.request("/v2/fips")]);
assert.equal(logins, 1, "concurrent requests should share one token login");
now = 271000;
await gateway.request("/v2/fips");
assert.equal(logins, 2, "refresh before expiry");
rejectToken = true;
await gateway.request("/v2/fips");
assert.equal(logins, 3, "refresh once on rejected token");

const consentId = "11111111-1111-1111-1111-111111111111";
const env = { ...config, DB: testDb(), AA_ADAPTER_MODE: "sandbox", AA_OWNER_EMAIL: "owner@example.test", AA_SANDBOX_CONSENT_ID: consentId };
const originalFetch = globalThis.fetch;
let calls = 0;
let consentStatus = "PENDING";
const approvedRange = { from: new Date(Date.now() - 90 * 86400000).toISOString(), to: new Date().toISOString() };
const request = (path, body, key = "private-key") => new Request(`https://example.test/v1/rails/aa/${path}`, {
  method: body ? "POST" : "GET", headers: key === "private-key" ? testOwnerHeaders : key ? { "x-business-id": "ravi-stores" } : {}, ...(body ? { body: JSON.stringify(body) } : {})
});
try {
  globalThis.fetch = async (url, options) => {
    calls++;
    if (String(url).includes("/users/login")) return Response.json({ access_token: "private-token", expires_in: 300 });
    if (String(url).includes("/consents/")) return Response.json({ id: consentId, status: consentStatus, detail: { dataRange: approvedRange } });
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.equal(body.dataRange.from, approvedRange.from, "use consent range, not browser range");
      return Response.json({ id: "22222222-2222-2222-2222-222222222222", consentId, status: "PENDING" });
    }
    return Response.json({ id: "22222222-2222-2222-2222-222222222222", consentId: "another-consent", status: "COMPLETED", fips: [] });
  };
  assert.equal(await handleAaSandbox(request("state", null, null), env), null);
  assert.equal((await handleAaSandbox(request("state", null, "wrong-key"), env)).status, 401);
  assert.equal(calls, 0, "no provider calls without sandbox authorization");
  assert.equal((await handleAaSandbox(request("sessions", { consentId }), env)).status, 409);
  consentStatus = "ACTIVE";
  assert.equal((await handleAaSandbox(request("sessions", { consentId: "another-consent" }), env)).status, 400);
  assert.equal((await handleAaSandbox(request("sessions", { consentId, dataRange: { from: "unapproved" } }), env)).status, 200);
  const response = await handleAaSandbox(request("sessions/22222222-2222-2222-2222-222222222222/cashflow"), env);
  assert.equal(response.status, 404, "reject sessions outside the scoped consent listing before fetching financial data");
  assert.equal((await handleAaSandbox(request("callback", {}), env)).status, 503);
} finally { globalThis.fetch = originalFetch; }

const cashflow = normalizeSetuCashflowAttestation({ id: "test", status: "COMPLETED", fips: [{ accounts: [{ data: { account: { summary: { currentBalance: "500" }, transactions: { transaction: [{ type: "CREDIT", amount: "100" }] } } } }] }] });
assert.equal(cashflow.inflow90d, 100);
assert.equal(cashflow.averageDailyBalance, 500);
console.log("Setu sandbox authentication and access checks passed");
