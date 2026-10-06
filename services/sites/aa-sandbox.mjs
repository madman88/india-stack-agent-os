import { createSetuGateway } from "../shared/setu-aa-gateway.mjs";
import { normalizeSetuConsent, normalizeSetuDataSession, normalizeSetuCashflowAttestation } from "../shared/setu-aa-normalizers.mjs";

const clients = new WeakMap();
function client(env) {
  if (!clients.has(env)) clients.set(env, createSetuGateway(env));
  return clients.get(env);
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

// A single, pinned sandbox consent. Public visitors retain the simulated demo.
// Poll Setu directly; callbacks are disabled until sender verification is configured.
export async function handleAaSandbox(request, env = {}) {
  const url = new URL(request.url);
  if (env.AA_ADAPTER_MODE !== "sandbox" || !url.pathname.startsWith("/v1/rails/aa/")) return null;
  if (url.pathname.endsWith("/callback")) return json({ error: "sandbox_uses_polling" }, 503);
  const supplied = request.headers.get("x-aa-sandbox-key");
  if (!supplied) return null;
  if (!env.AA_SANDBOX_ACCESS_KEY || supplied !== env.AA_SANDBOX_ACCESS_KEY) return json({ error: "unauthorized" }, 401);
  if (!env.AA_SANDBOX_CONSENT_ID) return json({ error: "sandbox_consent_not_configured" }, 503);
  const gateway = client(env);
  const consentId = env.AA_SANDBOX_CONSENT_ID;
  const idPattern = /^[a-f0-9-]{36}$/i;

  async function consent() {
    return normalizeSetuConsent(await gateway.request(`/v2/consents/${consentId}?expanded=true`));
  }
  async function session(id) {
    if (!idPattern.test(id)) throw new Error("Invalid sandbox session ID");
    const value = normalizeSetuDataSession(await gateway.request(`/v2/sessions/${id}`));
    if (value.consentId !== consentId) throw new Error("Session does not belong to this sandbox consent");
    return value;
  }
  const credentialStatus = { provider: "setu", mode: "sandbox", baseUrl: env.AA_BASE_URL ?? "https://fiu-sandbox.setu.co", missing: [] };
  try {
    if (request.method === "GET" && url.pathname.endsWith("/setu/preflight")) return json(credentialStatus);
    if (request.method === "GET" && url.pathname.endsWith("/state")) {
      const latestConsent = await consent();
      const listing = await gateway.request(`/v2/consents/${consentId}/data-sessions`);
      const latest = listing.dataSessions?.[0];
      const latestSession = latest ? await session(latest.sessionId) : null;
      return json({ businessId: "ravi-stores", provider: "setu", credentialStatus, latestConsent, latestSession, auditLogs: [], canProceedToSandbox: latestConsent.status === "ACTIVE" });
    }
    if (request.method === "POST" && url.pathname.endsWith("/consents")) return json(await consent());
    const consentMatch = url.pathname.match(/\/consents\/([^/]+)$/);
    if (request.method === "GET" && consentMatch) {
      if (consentMatch[1] !== consentId) return json({ error: "not_found" }, 404);
      return json(await consent());
    }
    if (request.method === "POST" && url.pathname.endsWith("/sessions")) {
      const body = await request.json();
      const approved = await consent();
      if (body.consentId !== consentId) return json({ error: "invalid_consent" }, 400);
      if (approved.status !== "ACTIVE") return json({ error: "consent_not_active", message: "Approve the Setu consent before fetching data." }, 409);
      // Use the provider-approved range, rather than a browser-supplied range.
      const created = await gateway.request("/v2/sessions", { method: "POST", body: { consentId, dataRange: approved.detail.dataRange, format: "json" } });
      return json(normalizeSetuDataSession(created));
    }
    const sessionMatch = url.pathname.match(/\/sessions\/([^/]+)(\/cashflow)?$/);
    if (request.method === "GET" && sessionMatch) {
      if ((await consent()).status !== "ACTIVE") return json({ error: "consent_not_active" }, 409);
      const value = await session(sessionMatch[1]);
      if (sessionMatch[2] && !["PARTIAL", "COMPLETED"].includes(value.status)) return json({ error: "session_not_ready" }, 409);
      return json(sessionMatch[2] ? normalizeSetuCashflowAttestation(value) : value);
    }
    return json({ error: "not_found" }, 404);
  } catch (error) {
    // Provider responses can contain personal data; expose only our sanitized messages.
    return json({ error: "sandbox_request_failed", message: error.message }, error.status === 401 ? 502 : 400);
  }
}
