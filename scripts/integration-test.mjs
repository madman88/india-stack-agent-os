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
  console.log("integration test passed");
} catch (error) {
  console.error(output.trim());
  throw error;
} finally {
  child.kill("SIGTERM");
}
