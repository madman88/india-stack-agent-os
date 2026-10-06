import assert from "node:assert/strict";
import { testDb, testOwnerHeaders } from "./d1-test-db.mjs";
import { authorizeBusiness, handleBusinessAccess } from "../services/sites/business-access.mjs";
import { handleAaSandbox } from "../services/sites/aa-sandbox.mjs";

const db = testDb();
const consentId = "11111111-1111-1111-1111-111111111111";
const env = { DB: db, AA_OWNER_EMAIL: "owner@example.test", AA_SANDBOX_CONSENT_ID: consentId, AA_ADAPTER_MODE: "sandbox" };
const request = (path, headers = testOwnerHeaders, body, method) => new Request(`https://example.test/v1/${path}`, { method: method ?? (body ? "POST" : "GET"), headers, ...(body ? { body: JSON.stringify(body) } : {}) });
const reviewer = { ...testOwnerHeaders, "oai-authenticated-user-id": "reviewer-subject", "oai-authenticated-user-email": "reviewer@example.test" };
const stranger = { ...reviewer, "oai-authenticated-user-id": "stranger", "oai-authenticated-user-email": "stranger@example.test" };
assert.equal((await (await handleBusinessAccess(request("auth/me", {}), env)).json()).authenticated, false);
assert.equal((await handleAaSandbox(request("rails/aa/state", { "x-business-id": "ravi-stores" }), env)).status, 401);
assert.equal((await handleAaSandbox(request("rails/aa/state", { "x-aa-sandbox-key": "former-secret" }), env)).status, 401);
assert.equal((await handleBusinessAccess(request("auth/me", stranger), env)).status, 403);
assert.equal(await db.prepare("SELECT * FROM business_access WHERE id=?").bind("ravi-stores").first(), null, "uninvited users cannot bootstrap a business");

const profile = await (await handleBusinessAccess(request("auth/me"), env)).json();
assert.equal(profile.role, "owner");
assert.equal((await authorizeBusiness(request("auth/me", { ...testOwnerHeaders, "oai-authenticated-user-email": "new-owner-email@example.test" }), env)).role, "owner", "stable subject survives email changes");
await assert.rejects(authorizeBusiness(request("auth/me", { ...testOwnerHeaders, "oai-authenticated-user-id": "different-subject" }), env), /Only the business owner/);
await assert.rejects(authorizeBusiness(request("auth/me", { ...testOwnerHeaders, "x-business-id": "other-business" }), env), /do not have access/);
assert.equal((await handleBusinessAccess(request("access/reviewers", reviewer), env)).status, 403);
assert.equal((await handleBusinessAccess(request("access/reviewers", { ...testOwnerHeaders, origin: "https://attacker.test" }, { email: "reviewer@example.test" }), env)).status, 403);
assert.equal((await handleBusinessAccess(request("access/reviewers", testOwnerHeaders, { email: "reviewer@example.test", role: "owner", userId: "stranger" }), env)).status, 200);
assert.equal((await (await handleBusinessAccess(request("auth/me", reviewer), env)).json()).role, "reviewer", "client role escalation is ignored");
assert.equal((await handleBusinessAccess(request("access/reviewers", reviewer, { email: "stranger@example.test" }), env)).status, 403);

let providerCalls = 0;
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => { providerCalls++; throw new Error("provider unavailable"); };
  const scopedEnv = { ...env, AA_ACCESS_TOKEN: "token", AA_PRODUCT_INSTANCE_ID: "product" };
  assert.equal((await handleAaSandbox(request("rails/aa/sessions", reviewer, { consentId }), scopedEnv)).status, 403);
  assert.equal((await handleAaSandbox(request("rails/aa/state", stranger), scopedEnv)).status, 403);
  assert.equal(providerCalls, 0, "permissions are checked before provider access");
  assert.equal((await handleAaSandbox(request("rails/aa/state", reviewer), scopedEnv)).status, 200, "reviewers can read scoped status/history");
  const decision = await (await handleAaSandbox(request("decisions/working-capital", reviewer, { businessId: "ravi-stores" }), scopedEnv)).json();
  assert.equal(decision.recommendation.status, "hold");
  const actor = await db.prepare("SELECT actor_user_id, actor_role FROM aa_audit_events WHERE action='decision.evaluated' ORDER BY created_at DESC LIMIT 1").first();
  assert.equal(actor.actor_user_id, "reviewer-subject");
  assert.equal(actor.actor_role, "reviewer");
  assert.equal((await handleBusinessAccess(request("access/reviewers", testOwnerHeaders, { email: "reviewer@example.test" }, "DELETE"), env)).status, 200);
  const before = providerCalls;
  assert.equal((await handleAaSandbox(request("rails/aa/state", reviewer), scopedEnv)).status, 403);
  assert.equal(providerCalls, before, "revoked membership blocks subsequent data reads");
} finally { globalThis.fetch = originalFetch; db.close(); }
console.log("Business ownership, reviewer grants, revocation, CSRF and actor audit checks passed");
