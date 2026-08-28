import { spawn } from "node:child_process";

const port = Number(process.env.INTEGRATION_PORT ?? 8877);
const baseUrl = `http://localhost:${port}`;
process.env.API_BASE_URL = baseUrl;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      await delay(250);
    }
  }

  throw new Error("mock API did not become healthy");
}

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

const child = spawn(process.execPath, ["services/mock-api/server.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForHealth();
  const { status } = await import("./contract-smoke.mjs");
  if (status !== "passed") {
    throw new Error("contract smoke did not export passed status");
  }

  const initialAaState = await request("/v1/rails/aa/state?businessId=ravi-stores");
  assertExactKeys(initialAaState, ["businessId", "provider", "credentialStatus", "latestConsent", "latestSession", "auditLogs", "canProceedToSandbox"], "initial AA state");
  assert(initialAaState.businessId === "ravi-stores", "AA state business id mismatch");
  assert(initialAaState.provider === "setu", "AA state provider mismatch");
  assert(initialAaState.latestConsent === null, "AA state should start without consent");
  assert(initialAaState.latestSession === null, "AA state should start without session");

  const consent = await request("/v1/rails/aa/consents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      businessId: "ravi-stores",
      vua: "9999999999@setu",
      purposeCode: "102",
      purposeText: "invoice-backed working capital",
      dataRange: { from: "2026-01-01T00:00:00.000Z", to: "2026-03-31T23:59:59.999Z" },
      consentTypes: ["TRANSACTIONS", "SUMMARY"]
    })
  });
  assert(consent.provider === "setu", "AA consent provider mismatch");
  assert(consent.status === "PENDING", "AA consent status mismatch");
  assert(consent.detail.purposeCode === "102", "AA consent purpose code mismatch");
  assert(consent.detail.purpose === "invoice-backed working capital", "AA consent purpose text mismatch");
  assert(consent.detail.consentTypes.join(",") === "TRANSACTIONS,SUMMARY", "AA consent types mismatch");

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
  assert(session.provider === "setu", "AA session provider mismatch");
  assert(session.consentId === consent.id, "AA session consent id mismatch");
  assert(session.status === "COMPLETED", "AA session status mismatch");

  const cashflow = await request(`/v1/rails/aa/sessions/${session.id}/cashflow`);
  assert(cashflow.rail === "AA", "AA cashflow rail mismatch");
  assert(cashflow.inflow90d === 480000, "AA cashflow inflow math mismatch");
  assert(cashflow.averageDailyBalance === 62000, "AA cashflow balance math mismatch");

  const updatedAaState = await request("/v1/rails/aa/state?businessId=ravi-stores");
  assertExactKeys(updatedAaState, ["businessId", "provider", "credentialStatus", "latestConsent", "latestSession", "auditLogs", "canProceedToSandbox"], "updated AA state");
  assertExactKeys(updatedAaState.latestConsent, ["provider", "id", "status", "url", "redirectUrl", "traceId", "detail"], "updated AA state latest consent");
  assertExactKeys(updatedAaState.latestSession, ["provider", "id", "consentId", "status", "format", "dataRange", "traceId"], "updated AA state latest session");
  assert(updatedAaState.latestConsent.id === consent.id, "AA state latest consent mismatch");
  assert(updatedAaState.latestSession.id === session.id, "AA state latest session mismatch");
  assert(updatedAaState.auditLogs.length === 2, "AA audit log should include consent and session events");
  assert(updatedAaState.canProceedToSandbox === true, "AA state should be ready after consent and session");

  console.log("integration test passed");
} catch (error) {
  console.error(output.trim());
  throw error;
} finally {
  child.kill("SIGTERM");
}
