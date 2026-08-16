import { spawn } from "node:child_process";

const railsPort = 9792;
const apiPort = 9793;
const railsUrl = `http://localhost:${railsPort}`;
const apiUrl = `http://localhost:${apiPort}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function start(name, args, env) {
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  return child;
}

async function request(path, options) {
  const response = await fetch(`${apiUrl}${path}`, options);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

async function waitForHealth(url, label) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become healthy`);
}

function stop(child) {
  if (!child.killed) child.kill("SIGTERM");
}

const rails = start("rails", ["services/mock-rails/server.mjs"], { PORT: String(railsPort) });
const api = start("api", ["services/mock-api/server.mjs"], {
  PORT: String(apiPort),
  MOCK_RAILS_BASE_URL: railsUrl
});

try {
  await waitForHealth(railsUrl, "mock rails");
  await waitForHealth(apiUrl, "mock API");

  const preflight = await request("/v1/rails/aa/setu/preflight");
  assert(preflight.provider === "setu", "Setu preflight provider mismatch");

  const consent = await request("/v1/rails/aa/consents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      vua: "9999999999@setu",
      tags: ["india-stack-agent-os", "ci"]
    })
  });
  assert(consent.provider === "setu", "consent provider mismatch");
  assert(consent.status === "PENDING", "consent should start pending");
  assert(consent.url.includes("/v2/consents/webview/"), "consent redirect URL missing");
  assert(consent.detail.purposeCode === "101", "consent purpose code mismatch");

  const status = await request(`/v1/rails/aa/consents/${consent.id}`);
  assert(status.status === "ACTIVE", "mock consent status should become active");

  const session = await request("/v1/rails/aa/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consentId: consent.id,
      dataRange: { from: "2026-01-01T00:00:00.000Z", to: "2026-03-31T23:59:59.999Z" },
      format: "json"
    })
  });
  assert(session.provider === "setu", "data-session provider mismatch");
  assert(session.status === "COMPLETED", "mock data session should be completed");

  const cashflow = await request(`/v1/rails/aa/sessions/${session.id}/cashflow`);
  assert(cashflow.rail === "AA", "cashflow rail mismatch");
  assert(cashflow.inflow90d === 480000, "cashflow must sum credit transactions");
  assert(cashflow.averageDailyBalance === 62000, "cashflow balance mismatch");
  assert(cashflow.source.sessionId === session.id, "cashflow must identify source session");

  const callback = await request("/v1/rails/aa/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ consentId: consent.id, status: "ACTIVE", traceId: "trace-setu-callback" })
  });
  assert(callback.provider === "setu", "callback provider mismatch");
  assert(callback.consentId === consent.id, "callback consent id mismatch");
  assert(callback.status === "ACTIVE", "callback status mismatch");

  console.log("setu AA smoke passed");
} finally {
  stop(api);
  stop(rails);
}
