import { normalizeCashflowAttestation } from "./normalizers/aa.mjs";
import { readRailFixture } from "../clients/rail-fixtures.mjs";
import { fetchRailJson, railAdapterMode, usesRailHttp } from "../clients/rail-client.mjs";

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
  if (railAdapterMode() === "fixture") {
    return normalizeCashflowAttestation(await readRailFixture("AA", "readCashflowAttestation"));
  }

  if (usesRailHttp()) {
    return fetchRailJson("/aa/cashflow", { rail: "AA", operation: "readCashflowAttestation" });
  }

  return fallbackCashflowAttestation;
}
