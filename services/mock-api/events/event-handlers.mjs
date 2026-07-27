import { writeProofEvent } from "../adapters/finternet.mjs";
import { makeProof } from "../lib/proofs.mjs";

export async function handleRailEvent(event, repositories) {
  if (await repositories.hasProcessedEvent(event.eventId)) {
    return { status: "duplicate", eventId: event.eventId };
  }

  const proofs = await proofsForEvent(event);
  if (proofs.length > 0) {
    await repositories.appendProofEvents(event.businessId, proofs);
  }

  await repositories.markEventProcessed(event);

  return {
    status: "processed",
    eventId: event.eventId,
    proofCount: proofs.length
  };
}

async function proofsForEvent(event) {
  if (event.type === "approval.captured") {
    return [
      await writeProofEvent({
        label: "Approval event processed",
        detail: `Event bus processed ${event.payload.actionState} owner decision`,
        status: "verified"
      })
    ];
  }

  if (event.type === "upi.mandate.prepared") {
    return [
      makeProof("UPI mandate event processed", "UPI", "Worker confirmed repayment mandate event dispatch", "simulated")
    ];
  }

  if (event.type === "ondc.purchase_order.created") {
    return [
      makeProof("ONDC purchase order event processed", "ONDC", "Worker confirmed purchase order event dispatch", "simulated")
    ];
  }

  return [];
}
