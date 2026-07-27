import { readFile } from "node:fs/promises";
import { join } from "node:path";

const fixturePaths = {
  "AA.readCashflowAttestation": "fixtures/rails/aa/cashflow.json",
  "GSTN.readComplianceAttestation": "fixtures/rails/gstn/compliance.json",
  "ONDC.readDemandSignals": "fixtures/rails/ondc/demand.json",
  "OCEN.discoverCreditOffers": "fixtures/rails/ocen/offers.json",
  "UPI.prepareRepaymentMandate": "fixtures/rails/upi/mandate.json",
  "Finternet.writeProofEvent": "fixtures/rails/finternet/proof.json"
};

export async function readRailFixture(rail, operation) {
  const path = fixturePaths[`${rail}.${operation}`];
  if (!path) {
    throw new Error(`No rail fixture configured for ${rail}.${operation}`);
  }

  return JSON.parse(await readFile(join(process.cwd(), path), "utf8"));
}
