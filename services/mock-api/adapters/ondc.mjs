import { scenario } from "../lib/fixtures.mjs";
import { fetchRailJson, railBaseUrl } from "../clients/rail-client.mjs";

function fallbackDemandSignals() {
  return {
    rail: "ONDC",
    demandLift: 31,
    stockoutSkus: scenario.inventory.filter((item) => item.daysLeft <= 2).map((item) => item.sku),
    window: "weekend"
  };
}

export async function readDemandSignals() {
  if (railBaseUrl()) {
    return fetchRailJson("/ondc/demand", { rail: "ONDC" });
  }

  return fallbackDemandSignals();
}
