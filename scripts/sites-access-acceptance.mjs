import assert from "node:assert/strict";
import { testDb, testOwnerHeaders } from "./d1-test-db.mjs";

// Exercise the shipped Worker router, with dispatcher identity represented by
// synthetic subjects. Real dispatcher sign-in is a separate hosted acceptance.
const { default: worker } = await import("../dist/server/index.js");
const db = testDb();
const env = { DB: db, AA_ADAPTER_MODE: "sandbox", AA_OWNER_EMAIL: "owner@example.test", AA_SANDBOX_CONSENT_ID: "11111111-1111-1111-1111-111111111111" };
const reviewer = { ...testOwnerHeaders, "oai-authenticated-user-id": "reviewer-subject", "oai-authenticated-user-email": "reviewer@example.test" };
const stranger = { ...reviewer, "oai-authenticated-user-id": "stranger-subject", "oai-authenticated-user-email": "stranger@example.test" };
const call = (path, headers = testOwnerHeaders, method = "GET", body) => worker.fetch(new Request(`https://example.test/v1/${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
let providerCalls = 0;
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => { providerCalls++; throw new Error("Provider unavailable during acceptance"); };
  assert.equal((await (await call("auth/me", {})).json()).authenticated, false);
  assert.equal((await call("rails/aa/state", { "x-business-id": "ravi-stores" })).status, 401);
  assert.equal((await call("rails/aa/state", { "x-aa-sandbox-key": "retired" })).status, 401);
  assert.equal((await call("auth/me", stranger)).status, 403);
  assert.equal((await (await call("auth/me")).json()).role, "owner");
  assert.equal((await call("rails/aa/state", { ...testOwnerHeaders, "x-business-id": "other-business" })).status, 403);
  assert.equal((await call("access/reviewers", { ...testOwnerHeaders, origin: "https://attacker.test" }, "POST", { email: reviewer["oai-authenticated-user-email"] })).status, 403);
  assert.equal(providerCalls, 0, "Access denials must precede provider calls");
  assert.equal((await call("access/reviewers", testOwnerHeaders, "POST", { email: reviewer["oai-authenticated-user-email"], role: "owner" })).status, 200);
  assert.equal((await (await call("auth/me", reviewer)).json()).role, "reviewer");
  assert.equal((await call("access/reviewers", reviewer)).status, 403);
  assert.equal((await call("rails/aa/sessions", reviewer, "POST", { consentId: env.AA_SANDBOX_CONSENT_ID })).status, 403);
  assert.equal((await call("rails/aa/state", reviewer)).status, 200);
  const decision = await (await call("decisions/working-capital", reviewer, "POST", { businessId: "ravi-stores" })).json();
  assert.equal(decision.recommendation.status, "hold", "Provider outages cannot substitute demo evidence");
  assert.equal((await call("approvals", testOwnerHeaders, "POST", {})).status, 409, "Execution remains disabled");
  assert.equal((await call("access/reviewers", testOwnerHeaders, "DELETE", { email: reviewer["oai-authenticated-user-email"] })).status, 200);
  const callsBeforeRevokedRead = providerCalls;
  assert.equal((await call("rails/aa/state", reviewer)).status, 403);
  assert.equal((await call("decisions/working-capital", reviewer, "POST", { businessId: "ravi-stores" })).status, 403);
  assert.equal(providerCalls, callsBeforeRevokedRead);
  const events = (await db.prepare("SELECT action, actor_user_id, actor_role FROM aa_audit_events").all()).results;
  for (const action of ["reviewer.granted", "reviewer.revoked"]) {
    assert(events.some((event) => event.action === action && event.actor_user_id === "test-owner" && event.actor_role === "owner"));
  }
  assert(events.some((event) => event.action === "decision.evaluated" && event.actor_user_id === "reviewer-subject" && event.actor_role === "reviewer"));
} finally { globalThis.fetch = originalFetch; db.close(); }
console.log("Built Sites Worker access acceptance passed (synthetic identities; hosted sign-in pending)");
