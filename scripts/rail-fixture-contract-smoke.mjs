import { readFile } from "node:fs/promises";
import { normalizeCashflowAttestation } from "../services/mock-api/adapters/normalizers/aa.mjs";
import { normalizeComplianceAttestation } from "../services/mock-api/adapters/normalizers/gstn.mjs";
import { normalizeDemandSignals } from "../services/mock-api/adapters/normalizers/ondc.mjs";
import { normalizeCreditOffers } from "../services/mock-api/adapters/normalizers/ocen.mjs";
import { normalizeRepaymentMandate } from "../services/mock-api/adapters/normalizers/upi.mjs";
import { normalizeProofEvent } from "../services/mock-api/adapters/normalizers/finternet.mjs";
import { RailAdapterError, fetchRailJson, normalizeRailErrorShape } from "../services/mock-api/clients/rail-client.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertKeys(value, keys, label) {
  const missing = keys.filter((key) => !(key in value));
  assert(missing.length === 0, `${label} missing keys: ${missing.join(", ")}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const contract = await readJson("contracts/rail-adapters.json");
assert(contract.version === "0.1.0", "rail adapter contract version mismatch");
for (const mode of ["fixture", "mock-http", "sandbox", "prod"]) {
  assert(contract.modes.includes(mode), `contract missing ${mode} mode`);
}
assertKeys(contract.defaults, ["timeoutMs", "retries", "errorShape"], "contract defaults");

const cashflow = normalizeCashflowAttestation(await readJson("fixtures/rails/aa/cashflow.json"));
assertKeys(cashflow, contract.rails.AA.operations.readCashflowAttestation.normalizedShape, "AA fixture normalization");
assert(cashflow.consent.id === "consent-ravi-aa-001", "AA consent id missing");

const compliance = normalizeComplianceAttestation(await readJson("fixtures/rails/gstn/compliance.json"));
assertKeys(compliance, contract.rails.GSTN.operations.readComplianceAttestation.normalizedShape, "GSTN fixture normalization");

const demand = normalizeDemandSignals(await readJson("fixtures/rails/ondc/demand.json"));
assertKeys(demand, contract.rails.ONDC.operations.readDemandSignals.normalizedShape, "ONDC fixture normalization");

const offers = normalizeCreditOffers(await readJson("fixtures/rails/ocen/offers.json"));
assert(Array.isArray(offers) && offers.length === 3, "OCEN fixture normalization should return three offers");
for (const offer of offers) {
  assertKeys(offer, ["lender", "apr", "tenure", "amount", "score", "fee"], "OCEN normalized offer");
}

const mandate = normalizeRepaymentMandate(await readJson("fixtures/rails/upi/mandate.json"));
assertKeys(mandate, contract.rails.UPI.operations.prepareRepaymentMandate.normalizedShape, "UPI fixture normalization");

const proof = normalizeProofEvent(await readJson("fixtures/rails/finternet/proof.json"));
assertKeys(proof, contract.rails.Finternet.operations.writeProofEvent.normalizedShape, "Finternet fixture normalization");

const error = normalizeRailErrorShape(
  new RailAdapterError("Rail adapter returned 503", {
    rail: "UPI",
    operation: "prepareRepaymentMandate",
    status: 503,
    retryable: true,
    correlationId: "corr-fixture"
  })
);
assertKeys(error, contract.defaults.errorShape, "rail error shape");
assert(error.retryable === true, "rail error retryable flag mismatch");
assert(error.correlationId === "corr-fixture", "rail error correlation id mismatch");

try {
  await fetchRailJson("/missing-config", {
    rail: "AA",
    operation: "readCashflowAttestation"
  });
  throw new Error("missing rail base URL should fail");
} catch (missingConfigError) {
  const normalized = normalizeRailErrorShape(missingConfigError);
  assert(normalized.rail === "AA", "missing config error rail mismatch");
  assert(normalized.operation === "readCashflowAttestation", "missing config error operation mismatch");
  assert(normalized.retryable === false, "missing config error must not be retryable");
}

console.log("rail fixture contract smoke passed");
