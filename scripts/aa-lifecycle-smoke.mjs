import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testDb, testOwnerHeaders } from "./d1-test-db.mjs";
import { createAaStore } from "../services/sites/aa-store.mjs";
import { aaLifecycle } from "../services/shared/aa-lifecycle.mjs";
import { handleAaSandbox } from "../services/sites/aa-sandbox.mjs";

const consentId = "11111111-1111-1111-1111-111111111111";
const sessionId = "22222222-2222-2222-2222-222222222222";
const now = Date.now();
const range = { from: new Date(now - 90 * 86400000).toISOString(), to: new Date(now).toISOString() };
assert.equal(aaLifecycle({ status: "PENDING" }, null).canFetch, false);
for (const status of ["REVOKED", "EXPIRED", "REJECTED"]) assert.equal(aaLifecycle({ status }, null).stage, "approval_required");
assert.equal(aaLifecycle({ status: "ACTIVE", expiresAt: new Date(now - 1000).toISOString() }, null).stage, "approval_required");
for (const status of ["PENDING", "PARTIAL"]) assert.equal(aaLifecycle({ status: "ACTIVE" }, { status }).stage, "fetch_pending");
for (const status of ["FAILED", "EXPIRED"]) assert.equal(aaLifecycle({ status: "ACTIVE" }, { status }).canRetry, true);
assert.equal(aaLifecycle({ status: "ACTIVE" }, { status: "COMPLETED", dataRange: { to: new Date(now - 8 * 86400000).toISOString() } }).stage, "evidence_stale");

const dir = mkdtempSync(join(tmpdir(), "aa-lifecycle-"));
let db = testDb(join(dir, "state.sqlite"));
let store = createAaStore(db);
await store.record("consent", consentId, { id: consentId, status: "ACTIVE", detail: { dataRange: range } });
db.close();
db = testDb(join(dir, "state.sqlite"), false);
store = createAaStore(db);
assert.equal((await store.history(consentId)).records[0].status, "ACTIVE", "history survives a database reopen");

let status = "ACTIVE";
let expiry = new Date(now + 86400000).toISOString();
let latest;
let posts = 0;
let reads = 0;
let outage = false;
let loseResponse = false;
const originalFetch = globalThis.fetch;
const env = () => ({ DB: db, AA_ADAPTER_MODE: "sandbox", AA_OWNER_EMAIL: "owner@example.test", AA_SANDBOX_CONSENT_ID: consentId, AA_ACCESS_TOKEN: "token", AA_PRODUCT_INSTANCE_ID: "product" });
const request = (path, body) => new Request(`https://example.test/v1/rails/aa/${path}`, { method: body ? "POST" : "GET", headers: testOwnerHeaders, ...(body ? { body: JSON.stringify(body) } : {}) });
try {
  globalThis.fetch = async (url, options) => {
    if (outage) throw new Error("network unavailable");
    const path = new URL(url).pathname;
    if (path.includes("data-sessions")) return Response.json({ dataSessions: latest ? [{ sessionId: latest.id, status: latest.status, createdAt: latest.createdAt }] : [] });
    if (path.includes("/consents/")) return Response.json({ id: consentId, status, detail: { consentExpiry: expiry, dataRange: range } });
    if (options.method === "POST") {
      posts++;
      latest = { id: sessionId, consentId, status: "PENDING", dataRange: range, createdAt: new Date().toISOString() };
      if (loseResponse) throw new Error("response lost after provider accepted request");
      return Response.json(latest);
    }
    reads++;
    return Response.json(latest);
  };
  const results = await Promise.all(Array.from({ length: 5 }, () => handleAaSandbox(request("sessions", { consentId }), env())));
  assert.equal(posts, 1, "concurrent workers submit one provider fetch");
  assert(results.some((r) => r.status === 200));
  const reused = await (await handleAaSandbox(request("sessions", { consentId }), env())).json();
  assert.equal(reused.reused, true);
  assert.equal(posts, 1);
  const pending = await (await handleAaSandbox(request("state"), env())).json();
  assert.equal(pending.lifecycle.stage, "fetch_pending");
  assert.equal(reads, 0, "pending status polling does not fetch financial data");
  latest.status = "FAILED";
  assert.equal((await handleAaSandbox(request("sessions", { consentId }), env())).status, 409);
  await handleAaSandbox(request("sessions", { consentId, retry: true }), env());
  assert.equal(posts, 2, "only explicit retry replaces a failed session");

  // New consent scope to exercise a lost response without historical request state.
  await db.prepare("DELETE FROM aa_fetch_requests WHERE consent_id = ?").bind(consentId).run();
  latest = undefined;
  loseResponse = true;
  assert.equal((await handleAaSandbox(request("sessions", { consentId }), env())).status, 503);
  assert.equal((await store.fetchRequest(consentId)).state, "UNKNOWN");
  const reconciled = await (await handleAaSandbox(request("state"), env())).json();
  assert.equal(reconciled.lifecycle.stage, "fetch_pending");
  assert.equal((await store.fetchRequest(consentId)).state, "SENT");
  await handleAaSandbox(request("sessions", { consentId }), env());
  assert.equal(posts, 3, "reconciled ambiguous requests are reused, not resent");

  const readsBefore = reads;
  status = "REVOKED";
  const revoked = await (await handleAaSandbox(request("state"), env())).json();
  assert.equal(revoked.lifecycle.stage, "approval_required");
  assert.equal((await handleAaSandbox(request(`sessions/${sessionId}/cashflow`), env())).status, 409);
  assert.equal(reads, readsBefore, "revocation blocks financial data reads");
  status = "ACTIVE";
  expiry = new Date(now - 1000).toISOString();
  assert.equal((await handleAaSandbox(request("sessions", { consentId }), env())).status, 409);
  assert.equal(posts, 3);
  outage = true;
  const unavailable = await (await handleAaSandbox(request("state"), env())).json();
  assert.equal(unavailable.lifecycle.stage, "provider_unavailable");
  assert.equal(unavailable.lifecycle.canFetch, false);
  assert(unavailable.records.length > 0 && unavailable.auditLogs.length > 0);
  assert.equal(JSON.stringify(unavailable.records).includes("token"), false);
  assert.equal((await handleAaSandbox(request("state"), { ...env(), DB: undefined })).status, 503);
} finally { globalThis.fetch = originalFetch; db.close(); rmSync(dir, { recursive: true }); }
console.log("AA lifecycle, durable history, duplicate-fetch and reconciliation checks passed");
