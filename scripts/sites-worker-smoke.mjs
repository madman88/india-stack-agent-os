const mod = await import(`../dist/server/index.js?cache=${Date.now()}`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
    body: JSON.stringify({ vua: "9999999999@setu" })
  })
);
assert(consent.status === 200, `Setu consent returned ${consent.status}`);
const consentBody = await consent.json();
assert(consentBody.provider === "setu", "Setu consent provider mismatch");
assert(consentBody.status === "PENDING", "Setu consent status mismatch");

const consentStatus = await mod.default.fetch(new Request(`https://example.test/v1/rails/aa/consents/${consentBody.id}`));
const consentStatusBody = await consentStatus.json();
assert(consentStatusBody.status === "ACTIVE", "Setu consent status route mismatch");

console.log("sites worker smoke passed");
