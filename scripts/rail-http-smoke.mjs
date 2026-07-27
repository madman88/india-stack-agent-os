import { spawn } from "node:child_process";

const railsPort = 9790;
const apiPort = 9791;
const railsUrl = `http://localhost:${railsPort}`;
const apiUrl = `http://localhost:${apiPort}`;

function start(name, command, args, env) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  return child;
}

async function waitForHealth(url, label) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // The process may still be binding its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`${label} did not become healthy`);
}

function stop(child) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
}

const rails = start("rails", process.execPath, ["services/mock-rails/server.mjs"], { PORT: String(railsPort) });
const api = start("api", process.execPath, ["services/mock-api/server.mjs"], {
  PORT: String(apiPort),
  MOCK_RAILS_BASE_URL: railsUrl
});

try {
  await waitForHealth(railsUrl, "mock rails");
  await waitForHealth(apiUrl, "mock API");
  process.env.API_BASE_URL = apiUrl;
  await import(`./contract-smoke.mjs?base=${Date.now()}`);
  console.log("rail HTTP smoke passed");
} finally {
  stop(api);
  stop(rails);
}
