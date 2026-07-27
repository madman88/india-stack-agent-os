import { scenario } from "../lib/fixtures.mjs";
import { normalizeCreditOffers } from "./normalizers/ocen.mjs";
import { readRailFixture } from "../clients/rail-fixtures.mjs";
import { fetchRailJson, railAdapterMode, usesRailHttp } from "../clients/rail-client.mjs";

export async function discoverCreditOffers() {
  if (railAdapterMode() === "fixture") {
    return normalizeCreditOffers(await readRailFixture("OCEN", "discoverCreditOffers"));
  }

  if (usesRailHttp()) {
    const response = await fetchRailJson("/ocen/offers", { rail: "OCEN", operation: "discoverCreditOffers" });
    return response.offers;
  }

  return scenario.loanOffers;
}
