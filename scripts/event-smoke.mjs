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
assert(health.eventBus === "sqs", "API must be running with SQS event bus");

const idempotencyKey = `event-smoke-${Date.now()}`;
await request("/v1/approvals", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ businessId: "ravi-stores", action: "approve", idempotencyKey })
});

const { spawnSync } = await import("node:child_process");
const worker = spawnSync(process.execPath, ["services/mock-api/worker.mjs"], {
  env: { ...process.env, WORKER_ONCE: "true" },
  encoding: "utf8"
});

if (worker.status !== 0) {
  console.error(worker.stdout);
  console.error(worker.stderr);
  throw new Error(`worker failed with ${worker.status}`);
}

const afterFirstRun = await request("/v1/proof-chain?businessId=ravi-stores");
const eventProofs = afterFirstRun.proofs.filter((proof) =>
  ["Approval event processed", "UPI mandate event processed", "ONDC purchase order event processed"].includes(proof.label)
);
assert(eventProofs.length >= 3, "worker did not append expected event proofs");

const secondWorker = spawnSync(process.execPath, ["services/mock-api/worker.mjs"], {
  env: { ...process.env, WORKER_ONCE: "true" },
  encoding: "utf8"
});

if (secondWorker.status !== 0) {
  console.error(secondWorker.stdout);
  console.error(secondWorker.stderr);
  throw new Error(`second worker failed with ${secondWorker.status}`);
}

const afterSecondRun = await request("/v1/proof-chain?businessId=ravi-stores");
assert(afterSecondRun.proofs.length === afterFirstRun.proofs.length, "worker should not duplicate processed event proofs");

console.log("event smoke passed");
