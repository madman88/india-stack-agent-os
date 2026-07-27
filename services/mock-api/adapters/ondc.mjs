import { scenario } from "../lib/fixtures.mjs";

export function readDemandSignals() {
  return {
    rail: "ONDC",
    demandLift: 31,
    stockoutSkus: scenario.inventory.filter((item) => item.daysLeft <= 2).map((item) => item.sku),
    window: "weekend"
  };
}
