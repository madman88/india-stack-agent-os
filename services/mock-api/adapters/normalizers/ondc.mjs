export function normalizeDemandSignals(input) {
  return {
    rail: "ONDC",
    demandLift: input.demandLiftPercent,
    stockoutSkus: input.stockout.skus,
    window: input.stockout.window
  };
}
