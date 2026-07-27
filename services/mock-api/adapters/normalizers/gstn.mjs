export function normalizeComplianceAttestation(input) {
  return {
    rail: "GSTN",
    filingStreakMonths: input.filings.cleanStreakMonths,
    openLiability: input.filings.hasOpenLiability,
    status: input.riskStatus
  };
}
