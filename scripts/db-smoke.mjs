const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(
    actual.length === expected.length && actual.every((key, index) => key === expected[index]),
    `${label} keys mismatch: expected ${expected.join(", ")} got ${actual.join(", ")}`
  );
}

const health = await request("/health");
assert(health.db === "dynamodb", "API must be running with DB_DRIVER=dynamodb");

const snapshot = await request("/v1/businesses/ravi-stores/snapshot");
assert(snapshot.business.id === "ravi-stores", "business snapshot missing from DynamoDB path");

await request("/v1/approvals", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ businessId: "ravi-stores", action: "approve" })
});

const proofChain = await request("/v1/proof-chain?businessId=ravi-stores");
assert(
  proofChain.proofs.some((proof) => proof.label === "Owner approval proof"),
  "approval proof was not persisted"
);

const consent = await request("/v1/rails/aa/consents", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    businessId: "ravi-stores",
    vua: "9999999999@setu",
    dataRange: { from: "2026-01-01T00:00:00.000Z", to: "2026-03-31T23:59:59.999Z" },
    consentTypes: ["TRANSACTIONS", "SUMMARY", "PROFILE"]
  })
});
assert(consent.id, "AA consent was not created");

const session = await request("/v1/rails/aa/sessions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    businessId: "ravi-stores",
    consentId: consent.id,
    dataRange: { from: "2026-01-01T00:00:00.000Z", to: "2026-03-31T23:59:59.999Z" },
    format: "json"
  })
});
assert(session.consentId === consent.id, "AA session did not persist consent id");

const aaState = await request("/v1/rails/aa/state?businessId=ravi-stores");
assertExactKeys(aaState, ["businessId", "provider", "credentialStatus", "latestConsent", "latestSession", "auditLogs", "canProceedToSandbox"], "AA state");
assertExactKeys(aaState.latestConsent, ["provider", "id", "status", "url", "redirectUrl", "traceId", "detail"], "AA latest consent");
assertExactKeys(aaState.latestSession, ["provider", "id", "consentId", "status", "format", "dataRange", "traceId"], "AA latest session");
assert(aaState.latestConsent.id === consent.id, "AA consent was not persisted");
assert(aaState.latestSession.id === session.id, "AA session was not persisted");
assert(aaState.auditLogs.length >= 2, "AA audit logs were not persisted");

console.log("db smoke passed");
