const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";

const requiredSnapshotKeys = [
  "business",
  "inventory",
  "obligations",
  "loanOffers",
  "proofs",
  "messages",
  "railSummary",
  "verifiedAssets"
];

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

const health = await request("/health");
assert(health.status === "ok", "health status must be ok");

const snapshot = await request("/v1/businesses/ravi-stores/snapshot");
for (const key of requiredSnapshotKeys) {
  assert(key in snapshot, `snapshot missing ${key}`);
}
assert(snapshot.business.id === "ravi-stores", "snapshot business id mismatch");
assert(Array.isArray(snapshot.proofs) && snapshot.proofs.length >= 4, "snapshot proofs missing");

const decision = await request("/v1/decisions/working-capital", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ businessId: "ravi-stores" })
});
assert(decision.recommendation.requiredApproval === true, "decision must require approval");

const approval = await request("/v1/approvals", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ businessId: "ravi-stores", action: "approve" })
});
assert(approval.actionState === "approved", "approval state mismatch");
assert(approval.proofsToPrepend.length >= 3, "approval proofs missing");

const agent = await request("/v1/agent/messages", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ businessId: "ravi-stores", message: "why", proofCount: 4, verifiedProofCount: 3 })
});
assert(typeof agent.message === "string" && agent.message.length > 20, "agent response invalid");

console.log("contract smoke passed");
