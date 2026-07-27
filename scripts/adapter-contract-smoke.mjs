import { readCashflowAttestation } from "../services/mock-api/adapters/account-aggregator.mjs";
import { readComplianceAttestation } from "../services/mock-api/adapters/gstn.mjs";
import { discoverCreditOffers } from "../services/mock-api/adapters/ocen.mjs";
import { readDemandSignals } from "../services/mock-api/adapters/ondc.mjs";
import { prepareRepaymentMandate } from "../services/mock-api/adapters/upi.mjs";
import { createWorkingCapitalDecision } from "../services/mock-api/services/agent-service.mjs";
import { captureApproval } from "../services/mock-api/services/approval-service.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertKeys(value, keys, label) {
  const missing = keys.filter((key) => !(key in value));
  assert(missing.length === 0, `${label} missing keys: ${missing.join(", ")}`);
}

const cashflow = readCashflowAttestation();
assertKeys(cashflow, ["rail", "inflow90d", "averageDailyBalance", "volatility", "consent"], "AA attestation");
assert(cashflow.rail === "AA", "AA rail mismatch");
assert(Number.isFinite(cashflow.inflow90d) && cashflow.inflow90d > 0, "AA inflow must be a positive number");
assert(Number.isFinite(cashflow.averageDailyBalance), "AA average daily balance must be numeric");
assert(cashflow.consent.status === "purpose-bound", "AA consent must be purpose-bound");

const demand = readDemandSignals();
assertKeys(demand, ["rail", "demandLift", "stockoutSkus", "window"], "ONDC demand");
assert(demand.rail === "ONDC", "ONDC rail mismatch");
assert(Number.isFinite(demand.demandLift), "ONDC demand lift must be numeric");
assert(Array.isArray(demand.stockoutSkus) && demand.stockoutSkus.length > 0, "ONDC stockout SKUs missing");

const compliance = readComplianceAttestation();
assertKeys(compliance, ["rail", "filingStreakMonths", "openLiability", "status"], "GSTN compliance");
assert(compliance.rail === "GSTN", "GSTN rail mismatch");
assert(Number.isFinite(compliance.filingStreakMonths), "GSTN filing streak must be numeric");
assert(typeof compliance.openLiability === "boolean", "GSTN open liability must be boolean");

const offers = discoverCreditOffers();
assert(Array.isArray(offers) && offers.length >= 1, "OCEN offers missing");
for (const offer of offers) {
  assertKeys(offer, ["lender", "apr", "tenure", "amount", "score", "fee"], "OCEN offer");
  assert(typeof offer.lender === "string" && offer.lender.length > 0, "OCEN lender missing");
  assert(Number.isFinite(offer.score), "OCEN offer score must be numeric");
}

const mandate = prepareRepaymentMandate({ amount: 72000, repaymentCapDays: 45 });
assertKeys(mandate, ["rail", "type", "amount", "repaymentCapDays", "status"], "UPI mandate");
assert(mandate.rail === "UPI", "UPI rail mismatch");
assert(mandate.type === "AutoPay", "UPI mandate type mismatch");
assert(mandate.amount === 72000, "UPI mandate amount mismatch");
assert(mandate.status === "prepared", "UPI mandate status mismatch");

const decision = createWorkingCapitalDecision("ravi-stores");
assert(decision.businessId === "ravi-stores", "decision business id mismatch");
assert(decision.evidence.cashflow.rail === cashflow.rail, "decision must embed AA evidence");
assert(decision.evidence.demand.rail === demand.rail, "decision must embed ONDC evidence");
assert(decision.evidence.compliance.rail === compliance.rail, "decision must embed GSTN evidence");
assert(decision.selectedOffer.lender === offers[0].lender, "decision must select the first normalized OCEN offer");

const approved = captureApproval({ businessId: "ravi-stores", action: "approve" });
assert(approved.actionState === "approved", "approval state mismatch");
assert(approved.proofsToPrepend.some((proof) => proof.rail === "Finternet"), "approval must write Finternet proof");
assert(approved.proofsToPrepend.some((proof) => proof.rail === "ONDC"), "approval must write ONDC proof");
assert(approved.proofsToPrepend.some((proof) => proof.rail === "UPI"), "approval must write UPI proof");

const rejected = captureApproval({ businessId: "ravi-stores", action: "reject" });
assert(rejected.actionState === "rejected", "rejection state mismatch");
assert(rejected.proofsToPrepend.length === 1, "rejection must not prepare rail execution proofs");
assert(rejected.proofsToPrepend[0].rail === "Finternet", "rejection must write Finternet proof");

console.log("adapter contract smoke passed");
