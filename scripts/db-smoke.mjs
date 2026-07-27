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

console.log("db smoke passed");
