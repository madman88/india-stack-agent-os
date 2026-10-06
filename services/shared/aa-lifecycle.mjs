export function effectiveConsent(raw, now = Date.now()) {
  const expiry = raw.expiresAt ?? raw.detail?.consentExpiry;
  if (raw.status === "ACTIVE" && expiry && (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= now)) return "EXPIRED";
  return raw.status;
}
export function aaLifecycle(consent, session, now = Date.now()) {
  const status = effectiveConsent(consent, now);
  const result = (stage, message, canFetch = false, canRetry = false) => ({ stage, message, canFetch, canRetry, checkedAt: new Date(now).toISOString() });
  if (status === "PENDING") return result("approval_pending", "Approve the consent in Setu, then refresh its status.");
  if (status !== "ACTIVE") return result("approval_required", `Consent is ${String(status ?? "unavailable").toLowerCase()}. A new consent approval is required.`);
  const approvedTo = Date.parse(consent.detail?.dataRange?.to);
  if (Number.isFinite(approvedTo) && (now - approvedTo > 7 * 86400000 || approvedTo > now + 60000)) return result("evidence_stale", "The approved statement range is stale. A new consent with recent dates is required.");
  if (!session) return result("fetch_ready", "Consent is active. You can request the approved bank statement.", true);
  if (["PENDING", "PARTIAL"].includes(session.status)) return result("fetch_pending", "Setu is preparing the bank statement. Refresh status; no new fetch is needed.");
  if (["FAILED", "EXPIRED"].includes(session.status)) return result("retry_available", `The data session is ${session.status.toLowerCase()}. You can explicitly retry while this consent remains active.`, false, true);
  if (session.status !== "COMPLETED") return result("fetch_unavailable", "The session status is unavailable. Refresh before requesting more data.");
  const to = Date.parse(session.dataRange?.to);
  if (!Number.isFinite(to) || now - to > 7 * 86400000 || to > now + 60000) return result("evidence_stale", "This statement is stale or has invalid dates. A new consent with a recent date range is required.");
  return result("ready", "Bank statement is ready. Refresh updates the estimate without starting another fetch.");
}
