import { normalizeCashflowAttestation } from "./normalizers/aa.mjs";
import { readRailFixture } from "../clients/rail-fixtures.mjs";
import { fetchRailJson, railAdapterMode, usesRailHttp } from "../clients/rail-client.mjs";
import { createSetuGateway } from "../../shared/setu-aa-gateway.mjs";
import { readApprovedAaCashflow } from "../../shared/approved-aa-cashflow.mjs";

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

export async function readCashflowAttestation(businessId) {
  if (process.env.AA_ADAPTER_MODE === "sandbox") {
    if (businessId !== (process.env.AA_SANDBOX_BUSINESS_ID ?? "ravi-stores")) throw new Error("Business does not own this sandbox consent");
    return readApprovedAaCashflow(sandboxGateway, process.env.AA_SANDBOX_CONSENT_ID);
  }
  if (railAdapterMode() === "fixture") {
    return normalizeCashflowAttestation(await readRailFixture("AA", "readCashflowAttestation"));
  }

  if (usesRailHttp()) {
    return fetchRailJson("/aa/cashflow", { rail: "AA", operation: "readCashflowAttestation" });
  }

  return fallbackCashflowAttestation;
}

const sandboxGateway = createSetuGateway(process.env);
