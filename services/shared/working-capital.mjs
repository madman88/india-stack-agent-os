const rupees = (value) => `Rs ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const numeric = (text) => {
  if (typeof text !== "string" && typeof text !== "number") return NaN;
  const digits = String(text).replace(/[^\d.-]/g, "");
  return digits ? Number(digits) : NaN;
};

// Transparent sandbox policy, not a lender underwriting model. Demand and offers
// are still simulated. Keep the cashflow-derived amount separate from execution.
export function evaluateWorkingCapital(businessId, cashflow, selectedOffer, evidence = {}) {
  const repaymentCapDays = 45;
  const restockTarget = 72000;
  const surplusShare = 0.25;
  const volatilityFactor = { low: 1, moderate: 0.75, high: 0.5 }[cashflow?.volatility];
  const apr = numeric(selectedOffer?.apr);
  const fee = numeric(selectedOffer?.fee);
  const offerLimit = numeric(selectedOffer?.amount);
  const inflow = cashflow?.inflow90d;
  const outflow = cashflow?.outflow90d;
  const days = cashflow?.observedDays;
  let blockedReason;
  if (!cashflow?.dataQuality?.decisionReady || !Number.isFinite(days) || days < 30 || days > 90) {
    blockedReason = "Hold: a complete, dated bank statement covering at least 30 days is required.";
  } else if (![inflow, outflow, apr, fee, offerLimit].every(Number.isFinite) || inflow < 0 || outflow < 0 || apr < 0 || fee < 0 || offerLimit <= 0 || !volatilityFactor) {
    blockedReason = "Hold: cashflow or simulated offer terms are incomplete.";
  }
  const netInflow = Number.isFinite(inflow) && Number.isFinite(outflow) ? Math.round((inflow - outflow) * 100) / 100 : 0;
  if (!blockedReason && netInflow <= 0) blockedReason = "Hold: debits meet or exceed credits over the statement period.";
  const budget = blockedReason ? 0 : netInflow / days * repaymentCapDays * surplusShare * volatilityFactor;
  const affordablePrincipal = Math.max(0, (budget - fee) / (1 + apr / 100 * repaymentCapDays / 365));
  const amount = blockedReason ? 0 : Math.floor(Math.min(restockTarget, offerLimit, affordablePrincipal) / 1000) * 1000;
  const interest = Math.round(amount * apr / 100 * repaymentCapDays / 365 * 100) / 100;
  const reason = blockedReason ?? (amount > 0
    ? `${rupees(inflow)} credits minus ${rupees(outflow)} debits gives ${rupees(netInflow)} net inflows over ${days} days. The sandbox rule allocates 25% of the projected 45-day surplus, applies a ${volatilityFactor} volatility factor, and includes the simulated offer's interest and ${rupees(fee)} fee. The resulting restock estimate is ${rupees(amount)}, capped at the simulated ${rupees(restockTarget)} demand target.`
    : "Hold: the cashflow budget does not cover the simulated loan fee and minimum Rs 1,000 estimate.");
  return {
    businessId,
    mode: "aa-sandbox",
    recommendation: { amount, reason, repaymentCapDays, requiredApproval: true, status: amount > 0 ? "review" : "hold" },
    selectedOffer,
    loanOffers: evidence.loanOffers ?? [selectedOffer],
    evidence: { ...evidence, cashflow },
    calculation: {
      policy: "sandbox-net-inflow-v1", observedDays: days ?? null, netInflow,
      surplusShare, volatilityFactor: volatilityFactor ?? null,
      repaymentBudget: Math.round(budget * 100) / 100,
      restockTarget, offerLimit: Number.isFinite(offerLimit) ? offerLimit : null,
      estimatedInterest: Number.isFinite(interest) ? interest : 0,
      estimatedFee: amount > 0 ? fee : 0,
      estimatedRepayment: amount > 0 ? Math.round((amount + interest + fee) * 100) / 100 : 0,
      reportedBalance: cashflow?.reportedBalance ?? null
    },
    provenance: { aa: "Setu sandbox dummy statement", demand: "simulated", compliance: "simulated", offers: "simulated", execution: "disabled" }
  };
}
