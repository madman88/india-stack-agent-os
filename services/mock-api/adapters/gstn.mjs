import { fetchRailJson, railBaseUrl } from "../clients/rail-client.mjs";

const fallbackComplianceAttestation = {
  rail: "GSTN",
  filingStreakMonths: 9,
  openLiability: false,
  status: "clean"
};

export async function readComplianceAttestation() {
  if (railBaseUrl()) {
    return fetchRailJson("/gstn/compliance", { rail: "GSTN" });
  }

  return fallbackComplianceAttestation;
}
