import { fetchRailJson, railBaseUrl } from "../clients/rail-client.mjs";

const fallbackCashflowAttestation = {
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

export async function readCashflowAttestation() {
  if (railBaseUrl()) {
    return fetchRailJson("/aa/cashflow", { rail: "AA" });
  }

  return fallbackCashflowAttestation;
}
