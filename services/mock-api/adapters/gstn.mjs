import { normalizeComplianceAttestation } from "./normalizers/gstn.mjs";
import { readRailFixture } from "../clients/rail-fixtures.mjs";
import { fetchRailJson, railAdapterMode, usesRailHttp } from "../clients/rail-client.mjs";

const fallbackComplianceAttestation = {
  rail: "GSTN",
  filingStreakMonths: 9,
  openLiability: false,
  status: "clean"
};

export async function readComplianceAttestation() {
  if (railAdapterMode() === "fixture") {
    return normalizeComplianceAttestation(await readRailFixture("GSTN", "readComplianceAttestation"));
  }

  if (usesRailHttp()) {
    return fetchRailJson("/gstn/compliance", { rail: "GSTN", operation: "readComplianceAttestation" });
  }

  return fallbackComplianceAttestation;
}
