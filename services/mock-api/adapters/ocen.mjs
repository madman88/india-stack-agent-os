import { scenario } from "../lib/fixtures.mjs";
import { fetchRailJson, railBaseUrl } from "../clients/rail-client.mjs";

export async function discoverCreditOffers() {
  if (railBaseUrl()) {
    const response = await fetchRailJson("/ocen/offers", { rail: "OCEN" });
    return response.offers;
  }

  return scenario.loanOffers;
}
