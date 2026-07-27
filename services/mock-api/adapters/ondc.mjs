import { scenario } from "../lib/fixtures.mjs";
import { normalizeDemandSignals } from "./normalizers/ondc.mjs";
import { readRailFixture } from "../clients/rail-fixtures.mjs";
import { fetchRailJson, railAdapterMode, usesRailHttp } from "../clients/rail-client.mjs";

function fallbackDemandSignals() {
  return {
    rail: "ONDC",
    demandLift: 31,
    stockoutSkus: scenario.inventory.filter((item) => item.daysLeft <= 2).map((item) => item.sku),
    window: "weekend"
  };
}

export async function readDemandSignals() {
  if (railAdapterMode() === "fixture") {
    return normalizeDemandSignals(await readRailFixture("ONDC", "readDemandSignals"));
  }

  if (usesRailHttp()) {
    return fetchRailJson("/ondc/demand", { rail: "ONDC", operation: "readDemandSignals" });
  }

  return fallbackDemandSignals();
}
