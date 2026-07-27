export function normalizeCashflowAttestation(input) {
  return {
    rail: "AA",
    inflow90d: input.summary.inflow90d,
    averageDailyBalance: input.summary.averageDailyBalance,
    volatility: input.summary.volatilityBand,
    consent: {
      id: input.accountAggregator.consentId,
      purpose: input.accountAggregator.purpose,
      expiresInDays: input.accountAggregator.expiresInDays,
      status: "purpose-bound"
    }
  };
}
