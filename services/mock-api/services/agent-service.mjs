import { readCashflowAttestation } from "../adapters/account-aggregator.mjs";
import { readComplianceAttestation } from "../adapters/gstn.mjs";
import { discoverCreditOffers } from "../adapters/ocen.mjs";
import { readDemandSignals } from "../adapters/ondc.mjs";

export async function createWorkingCapitalDecision(businessId) {
  const [cashflow, demand, compliance, loanOffers] = await Promise.all([
    readCashflowAttestation(),
    readDemandSignals(),
    readComplianceAttestation(),
    discoverCreditOffers()
  ]);
  const selectedOffer = loanOffers[0];

  return {
    businessId,
    recommendation: {
      amount: 72000,
      reason: "Weekend stockout risk across atta and edible oil with sufficient 45-day cashflow buffer.",
      repaymentCapDays: 45,
      requiredApproval: true
    },
    selectedOffer,
    evidence: {
      cashflow,
      demand,
      compliance
    },
    loanOffers
  };
}

export function answerAgentMessage(body, proofDefaults) {
  const text = String(body.message ?? "").toLowerCase();

  if (text.includes("why")) {
    return {
      message: "Because expected gross margin is Rs 10,900, repayment cost is Rs 1,310, and the stockout risk affects three high-velocity SKUs.",
      meta: "Decision rationale"
    };
  }

  if (text.includes("risk")) {
    return {
      message: "Main risk is slower-than-expected sell-through. The plan caps exposure at 45 days and avoids the higher APR offers.",
      meta: "Risk explanation"
    };
  }

  if (text.includes("proof")) {
    return {
      message: `Current proof chain has ${body.proofCount ?? proofDefaults.count} events, ${body.verifiedProofCount ?? proofDefaults.verifiedCount} verified attestations, and no failed settlement event.`,
      meta: "Proof chain"
    };
  }

  return {
    message: "I can monitor cashflow, compare credit offers, prepare approvals, and write proof events before execution.",
    meta: "Agent response"
  };
}
