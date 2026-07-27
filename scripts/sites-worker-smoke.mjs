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

console.log("sites worker smoke passed");
