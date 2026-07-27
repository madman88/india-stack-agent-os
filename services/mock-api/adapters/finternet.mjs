import { fetchRailJson, railBaseUrl } from "../clients/rail-client.mjs";
import { makeProof } from "../lib/proofs.mjs";

export async function writeProofEvent({ label, detail, status = "simulated" }) {
  if (railBaseUrl()) {
    return fetchRailJson("/finternet/proofs", {
      rail: "Finternet",
      method: "POST",
      body: { label, detail, status }
    });
  }

  return makeProof(label, "Finternet", detail, status);
}
