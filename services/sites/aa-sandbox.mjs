import { createSetuGateway } from "../shared/setu-aa-gateway.mjs";
import { normalizeSetuConsent, normalizeSetuDataSession, normalizeSetuCashflowAttestation } from "../shared/setu-aa-normalizers.mjs";
import { readApprovedAaCashflow } from "../shared/approved-aa-cashflow.mjs";
import { evaluateWorkingCapital } from "../shared/working-capital.mjs";
import { createAaStore } from "./aa-store.mjs";
import { aaLifecycle, effectiveConsent } from "../shared/aa-lifecycle.mjs";
import { authorizeBusiness } from "./business-access.mjs";

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
export async function handleAaSandbox(request, env = {}, scenario = {}) {
  const url = new URL(request.url);
  const decisionPath = url.pathname === "/v1/decisions/working-capital";
  const messagePath = url.pathname === "/v1/agent/messages";
  const approvalPath = url.pathname === "/v1/approvals";
  if (!(url.pathname.startsWith("/v1/rails/aa/") || decisionPath || messagePath || approvalPath)) return null;
  if (request.headers.has("x-aa-sandbox-key")) return json({ error: "sign_in_required", message: "Private access links have been replaced by sign-in." }, 401);
  if (!request.headers.has("x-business-id")) return null;
  if (env.AA_ADAPTER_MODE !== "sandbox") return json({ error: "sandbox_unavailable" }, 503);
  if (url.pathname.endsWith("/callback")) return json({ error: "sandbox_uses_polling" }, 503);
  let access;
  try {
    const ownerOnly = request.method === "POST" && !decisionPath && !messagePath;
    access = await authorizeBusiness(request, env, ownerOnly);
  } catch (error) { return json({ error: "access_denied", message: error.status ? error.message : "Access records are unavailable." }, error.status ?? 503); }
  if (url.searchParams.has("businessId") && url.searchParams.get("businessId") !== access.businessId) return json({ error: "access_denied" }, 403);
  const gateway = client(env);
  let store;
  const consentId = access.consentId;
  const idPattern = /^[a-f0-9-]{36}$/i;

  async function consent() {
    const raw = await gateway.request(`/v2/consents/${consentId}?expanded=true`);
    const value = { ...normalizeSetuConsent(raw), status: effectiveConsent(raw), expiresAt: raw.detail?.consentExpiry ?? null };
    await store.record("consent", consentId, value);
    return value;
  }
  async function session(id) {
    if (!idPattern.test(id)) throw new Error("Invalid sandbox session ID");
    const value = normalizeSetuDataSession(await gateway.request(`/v2/sessions/${id}`));
    if (value.consentId !== consentId) throw new Error("Session does not belong to this sandbox consent");
    await store.record("session", consentId, value);
    return value;
  }
  async function latestSession() {
    const listing = await gateway.request(`/v2/consents/${consentId}/data-sessions`);
    const latest = listing.dataSessions?.[0];
    if (!latest) return null;
    if (!idPattern.test(latest.sessionId)) throw new Error("Invalid sandbox session ID");
    if (!latest.status || latest.status === "COMPLETED") return { ...await session(latest.sessionId), providerCreatedAt: latest.createdAt ?? latest.created_at ?? null };
    const value = normalizeSetuDataSession({ id: latest.sessionId, consentId, status: latest.status });
    await store.record("session", consentId, value);
    return { ...value, providerCreatedAt: latest.createdAt ?? latest.created_at ?? null };
  }
  async function reconcile(latest) {
    const pending = await store.fetchRequest(consentId);
    if (pending?.state === "SENT" && !latest) return { stage: "fetch_pending", message: "A fetch was submitted. Waiting for Setu to list the session; refresh status instead of starting another fetch.", canFetch: false, canRetry: false, checkedAt: new Date().toISOString() };
    if (pending && ["INFLIGHT", "UNKNOWN"].includes(pending.state)) {
      // An uncertain POST may have reached Setu. Never resend it automatically.
      if (latest && (pending.session_id === latest.id || (Number.isFinite(Date.parse(latest.providerCreatedAt)) && Date.parse(latest.providerCreatedAt) >= Date.parse(pending.created_at)))) {
        await store.finish(consentId, pending.request_id, "SENT", latest.id);
        await store.audit(consentId, "session.reconciled", latest.status, latest.id);
      }
      else return { stage: "fetch_uncertain", message: "A previous fetch may have reached Setu. Refresh to reconcile it; another fetch is blocked to prevent duplicates.", canFetch: false, canRetry: false, checkedAt: new Date().toISOString() };
    }
    return null;
  }
  const credentialStatus = { provider: "setu", mode: "sandbox", baseUrl: env.AA_BASE_URL ?? "https://fiu-sandbox.setu.co", missing: [] };
  try {
    store = createAaStore(env.DB, access);
    if (request.method === "POST" && approvalPath) return json({ error: "preview_only", message: "Sandbox estimates are for review; execution is disabled." }, 409);
    if (request.method === "POST" && (decisionPath || messagePath)) {
      const body = await request.json();
      if (body.businessId && body.businessId !== access.businessId) return json({ error: "not_found" }, 404);
      let decision;
      try {
        const cashflow = await readApprovedAaCashflow(gateway, consentId, Date.now, async (kind, raw) => {
          await store.record(kind, consentId, kind === "consent" ? { ...normalizeSetuConsent(raw), status: effectiveConsent(raw), expiresAt: raw.detail?.consentExpiry ?? null } : raw);
        });
        decision = evaluateWorkingCapital(access.businessId, cashflow, scenario.loanOffers?.[0], {
          demand: { rail: "ONDC", simulated: true }, compliance: { rail: "GSTN", simulated: true }, loanOffers: scenario.loanOffers ?? []
        });
      } catch (error) {
        decision = { businessId: access.businessId, mode: "aa-sandbox", loanOffers: scenario.loanOffers ?? [], recommendation: { amount: 0, status: "hold", reason: `Hold: ${error.message}. No fixture cashflow was substituted.`, requiredApproval: true, repaymentCapDays: 45 }, provenance: { aa: "unavailable", offers: "simulated", execution: "disabled" } };
      }
      await store.audit(consentId, "decision.evaluated", decision.recommendation.status, decision.evidence?.cashflow?.source?.sessionId ?? null);
      return json(messagePath ? { message: `${decision.recommendation.reason} This is a sandbox estimate using dummy bank data and simulated offers; execution is disabled.`, meta: "AA sandbox calculation" } : decision);
    }
    if (request.method === "GET" && url.pathname.endsWith("/setu/preflight")) return json(credentialStatus);
    if (request.method === "GET" && url.pathname.endsWith("/state")) {
      try {
        const latestConsent = await consent();
        // Do not fetch FI data after consent has expired or been revoked.
        const latest = latestConsent.status === "ACTIVE" ? await latestSession() : null;
        const lifecycle = latestConsent.status === "ACTIVE" ? await reconcile(latest) ?? aaLifecycle(latestConsent, latest) : aaLifecycle(latestConsent, null);
        const history = await store.history(consentId);
        return json({ businessId: access.businessId, role: access.role, provider: "setu", credentialStatus, latestConsent, latestSession: latest, ...history, lifecycle, canProceedToSandbox: lifecycle.stage === "ready" });
      } catch {
        const history = await store.history(consentId);
        return json({ businessId: access.businessId, role: access.role, provider: "setu", credentialStatus, latestConsent: null, latestSession: null, ...history, lifecycle: { stage: "provider_unavailable", message: "Could not verify Setu status. Saved references are historical; retry refresh before reading data.", canFetch: false, canRetry: false }, canProceedToSandbox: false });
      }
    }
    if (request.method === "POST" && url.pathname.endsWith("/consents")) return json(await consent());
    const consentMatch = url.pathname.match(/\/consents\/([^/]+)$/);
    if (request.method === "GET" && consentMatch) {
      if (consentMatch[1] !== consentId) return json({ error: "not_found" }, 404);
      return json(await consent());
    }
    if (request.method === "POST" && url.pathname.endsWith("/sessions")) {
      const body = await request.json();
      if (body.businessId && body.businessId !== access.businessId) return json({ error: "access_denied" }, 403);
      const approved = await consent();
      if (body.consentId !== consentId) return json({ error: "invalid_consent" }, 400);
      if (approved.status !== "ACTIVE") return json({ error: "consent_not_active", message: aaLifecycle(approved, null).message }, 409);
      const latest = await latestSession();
      const readiness = aaLifecycle(approved, latest);
      if (readiness.stage === "evidence_stale") return json({ error: "evidence_stale", message: readiness.message }, 409);
      const uncertain = await reconcile(latest);
      if (uncertain) return json({ error: "fetch_uncertain", message: uncertain.message }, 409);
      if (latest && !["FAILED", "EXPIRED"].includes(latest.status)) {
        await store.audit(consentId, "session.reused", latest.status, latest.id);
        return json({ ...latest, reused: true });
      }
      if (latest && !body.retry) return json({ error: "explicit_retry_required", message: "Choose Retry failed fetch to request a replacement session." }, 409);
      if (latest) {
        const existing = await store.fetchRequest(consentId);
        if (!existing) {
          const bootstrap = crypto.randomUUID();
          if (await store.acquire(consentId, bootstrap)) await store.finish(consentId, bootstrap, "SENT", latest.id);
        }
        await store.allowRetry(consentId, latest.id);
      }
      const requestId = crypto.randomUUID();
      if (!approved.detail.dataRange || ![approved.detail.dataRange.from, approved.detail.dataRange.to].every((d) => Number.isFinite(Date.parse(d)))) return json({ error: "invalid_range", message: "The approved data range is missing or invalid. A new consent is required." }, 409);
      if (!await store.acquire(consentId, requestId)) return json({ error: "fetch_in_progress", message: "A fetch was already submitted. Refresh its status before trying again." }, 409);
      await store.audit(consentId, "session.requested", "INFLIGHT");
      // Use the provider-approved range, rather than a browser-supplied range.
      try {
        const created = normalizeSetuDataSession(await gateway.request("/v2/sessions", { method: "POST", body: { consentId, dataRange: approved.detail.dataRange, format: "json" } }));
        if (!created.id || created.consentId !== consentId) throw new Error("Could not verify the created data session");
        await store.finish(consentId, requestId, "SENT", created.id);
        await store.record("session", consentId, created);
        return json(created);
      } catch (error) {
        const definite = [400, 401, 403, 404, 422].includes(error.status);
        await store.finish(consentId, requestId, definite ? "FAILED" : "UNKNOWN");
        await store.audit(consentId, "session.request_failed", definite ? "FAILED" : "UNKNOWN");
        return json({ error: definite ? "fetch_rejected" : "fetch_uncertain", message: definite ? "Setu rejected the request. Check consent and refresh before retrying." : "The fetch outcome is uncertain. Refresh status; do not submit a second request." }, 503);
      }
    }
    const sessionMatch = url.pathname.match(/\/sessions\/([^/]+)(\/cashflow)?$/);
    if (request.method === "GET" && sessionMatch) {
      if ((await consent()).status !== "ACTIVE") return json({ error: "consent_not_active" }, 409);
      const listing = await gateway.request(`/v2/consents/${consentId}/data-sessions`);
      const listed = listing.dataSessions?.find((s) => s.sessionId === sessionMatch[1]);
      if (!listed) return json({ error: "not_found" }, 404);
      if (sessionMatch[2] && listed.status && !["PARTIAL", "COMPLETED"].includes(listed.status)) return json({ error: "session_not_ready" }, 409);
      const value = await session(sessionMatch[1]);
      if (sessionMatch[2] && !["PARTIAL", "COMPLETED"].includes(value.status)) return json({ error: "session_not_ready" }, 409);
      return json(sessionMatch[2] ? normalizeSetuCashflowAttestation(value) : value);
    }
    return json({ error: "not_found" }, 404);
  } catch (error) {
    // Provider responses can contain personal data; expose only our sanitized messages.
    return json({ error: "sandbox_request_failed", message: "The AA service or saved history is unavailable. Refresh to retry safely." }, 503);
  }
}
