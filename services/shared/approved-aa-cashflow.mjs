import { normalizeSetuCashflowAttestation, normalizeSetuDataSession } from "./setu-aa-normalizers.mjs";

export async function readApprovedAaCashflow(gateway, consentId, clock = Date.now, observe = async () => {}) {
  if (!consentId) throw new Error("No sandbox consent is configured");
  const consent = await gateway.request(`/v2/consents/${consentId}?expanded=true`);
  await observe("consent", consent);
  if (consent.status !== "ACTIVE") throw new Error("Consent is not active; a new approval is required");
  if (consent.detail?.consentExpiry && !Number.isFinite(Date.parse(consent.detail.consentExpiry))) throw new Error("Consent expiry is invalid");
  if (consent.detail?.consentExpiry && Date.parse(consent.detail.consentExpiry) <= clock()) throw new Error("Consent has expired");
  const listing = await gateway.request(`/v2/consents/${consentId}/data-sessions`);
  const id = listing.dataSessions?.[0]?.sessionId;
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error("No bank data session is available");
  const listedStatus = listing.dataSessions[0].status;
  if (listedStatus && listedStatus !== "COMPLETED") {
    await observe("session", { id, consentId, status: listedStatus });
    throw new Error(`Bank data session is ${listedStatus.toLowerCase()}; refresh status before retrying`);
  }
  const session = normalizeSetuDataSession(await gateway.request(`/v2/sessions/${id}`));
  if (session.consentId !== consentId) throw new Error("Bank session does not belong to this consent");
  await observe("session", session);
  if (session.status !== "COMPLETED") throw new Error("Bank data session is not complete; refresh when ready");
  const range = consent.detail?.dataRange;
  if (!range || !session.dataRange || ![range.from, range.to, session.dataRange.from, session.dataRange.to].every((v) => Number.isFinite(Date.parse(v)))) throw new Error("Approved statement dates are missing");
  if (Date.parse(session.dataRange.from) < Date.parse(range.from) || Date.parse(session.dataRange.to) > Date.parse(range.to)) throw new Error("Bank data exceeds the approved consent range");
  if (Date.parse(session.dataRange.to) > clock() + 60000 || clock() - Date.parse(session.dataRange.to) > 7 * 86400000) throw new Error("A recent statement is required for a new decision");
  return normalizeSetuCashflowAttestation(session);
}
