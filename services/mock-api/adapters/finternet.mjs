import { normalizeProofEvent } from "./normalizers/finternet.mjs";
import { readRailFixture } from "../clients/rail-fixtures.mjs";
import { fetchRailJson, railAdapterMode, usesRailHttp } from "../clients/rail-client.mjs";
import { makeProof } from "../lib/proofs.mjs";

export async function writeProofEvent({ label, detail, status = "simulated" }) {
  if (railAdapterMode() === "fixture") {
    const proof = normalizeProofEvent(await readRailFixture("Finternet", "writeProofEvent"));
    return { ...proof, label, detail, status };
  }

  if (usesRailHttp()) {
    return fetchRailJson("/finternet/proofs", {
      rail: "Finternet",
      operation: "writeProofEvent",
      method: "POST",
      body: { label, detail, status }
    });
  }

  return makeProof(label, "Finternet", detail, status);
}
