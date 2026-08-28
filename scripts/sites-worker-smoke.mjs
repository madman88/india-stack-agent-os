const mod = await import(`../dist/server/index.js?cache=${Date.now()}`);

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

const root = await mod.default.fetch(new Request("https://example.test/"));
assert(root.status === 200, `root returned ${root.status}`);

const html = await root.text();
assert(html.includes("/assets/"), "root html must include built asset references");

const assetPath = html.match(/\/assets\/[^"]+\.js/)?.[0];
assert(assetPath, "built JS asset path missing");

const asset = await mod.default.fetch(new Request(`https://example.test${assetPath}`));
assert(asset.status === 200, `asset returned ${asset.status}`);

const decision = await mod.default.fetch(
  new Request("https://example.test/v1/decisions/working-capital", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessId: "ravi-stores" })
  })
);
assert(decision.status === 200, `decision returned ${decision.status}`);

const body = await decision.json();
assert(body.selectedOffer.lender === "Pragati NBFC", "worker selected offer mismatch");
assert(body.evidence.cashflow.rail === "AA", "worker AA evidence missing");
assert(body.evidence.demand.rail === "ONDC", "worker ONDC evidence missing");
assert(body.evidence.compliance.rail === "GSTN", "worker GSTN evidence missing");

const setuPreflight = await mod.default.fetch(new Request("https://example.test/v1/rails/aa/setu/preflight"));
assert(setuPreflight.status === 200, `Setu preflight returned ${setuPreflight.status}`);
const preflightBody = await setuPreflight.json();
assert(preflightBody.provider === "setu", "Setu preflight provider mismatch");
assert(Array.isArray(preflightBody.missing), "Setu preflight missing list invalid");

const consent = await mod.default.fetch(
  new Request("https://example.test/v1/rails/aa/consents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      businessId: "ravi-stores",
      vua: "9999999999@setu",
      purposeCode: "102",
      purposeText: "invoice-backed working capital",
      consentTypes: ["TRANSACTIONS", "SUMMARY"]
    })
  })
);
assert(consent.status === 200, `Setu consent returned ${consent.status}`);
const consentBody = await consent.json();
assert(consentBody.provider === "setu", "Setu consent provider mismatch");
assert(consentBody.status === "PENDING", "Setu consent status mismatch");
assert(consentBody.detail.purposeCode === "102", "Setu consent purpose code mismatch");
assert(consentBody.detail.purpose === "invoice-backed working capital", "Setu consent purpose text mismatch");
assert(consentBody.detail.consentTypes.join(",") === "TRANSACTIONS,SUMMARY", "Setu consent consentTypes mismatch");

const consentStatus = await mod.default.fetch(new Request(`https://example.test/v1/rails/aa/consents/${consentBody.id}`));
const consentStatusBody = await consentStatus.json();
assert(consentStatusBody.id === consentBody.id, "Setu consent status route id mismatch");

const session = await mod.default.fetch(
  new Request("https://example.test/v1/rails/aa/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      businessId: "ravi-stores",
      consentId: consentBody.id,
      dataRange: { from: "2026-01-01T00:00:00.000Z", to: "2026-03-31T23:59:59.999Z" },
      format: "json"
    })
  })
);
assert(session.status === 200, `Setu session returned ${session.status}`);
const sessionBody = await session.json();
assert(sessionBody.provider === "setu", "Setu session provider mismatch");
assert(sessionBody.consentId === consentBody.id, "Setu session consent id mismatch");
assert(sessionBody.status === "COMPLETED", "Setu session status mismatch");

const cashflow = await mod.default.fetch(new Request(`https://example.test/v1/rails/aa/sessions/${sessionBody.id}/cashflow`));
assert(cashflow.status === 200, `Setu cashflow returned ${cashflow.status}`);
const cashflowBody = await cashflow.json();
assert(cashflowBody.rail === "AA", "Setu cashflow rail mismatch");
assert(cashflowBody.inflow90d === 480000, "Setu cashflow inflow mismatch");
assert(cashflowBody.averageDailyBalance === 62000, "Setu cashflow balance mismatch");

const aaState = await mod.default.fetch(new Request("https://example.test/v1/rails/aa/state?businessId=ravi-stores"));
assert(aaState.status === 200, `Setu AA state returned ${aaState.status}`);
const aaStateBody = await aaState.json();
assertExactKeys(aaStateBody, ["businessId", "provider", "credentialStatus", "latestConsent", "latestSession", "auditLogs", "canProceedToSandbox"], "Setu AA state");
assertExactKeys(aaStateBody.latestConsent, ["provider", "id", "status", "url", "redirectUrl", "traceId", "detail"], "Setu AA state latest consent");
assertExactKeys(aaStateBody.latestSession, ["provider", "id", "consentId", "status", "format", "dataRange", "traceId"], "Setu AA state latest session");
assert(aaStateBody.latestConsent.id === consentBody.id, "Setu AA state latest consent mismatch");
assert(aaStateBody.latestSession.id === sessionBody.id, "Setu AA state latest session mismatch");
assert(aaStateBody.auditLogs.length === 2, "Setu AA state audit log mismatch");
assert(aaStateBody.canProceedToSandbox === true, "Setu AA state readiness mismatch");

console.log("sites worker smoke passed");
