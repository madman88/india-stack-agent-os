export function readCashflowAttestation() {
  return {
    rail: "AA",
    inflow90d: 480000,
    averageDailyBalance: 62000,
    volatility: "moderate",
    consent: {
      purpose: "working-capital-affordability",
      expiresInDays: 30,
      status: "purpose-bound"
    }
  };
}
