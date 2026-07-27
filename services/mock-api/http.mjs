import { createWorkingCapitalDecision, answerAgentMessage } from "./services/agent-service.mjs";
import { captureApproval } from "./services/approval-service.mjs";
import { repositories } from "./db/repositories.mjs";
import { createDomainEvent, eventBus } from "./events/event-bus.mjs";
import { businessId, scenario } from "./lib/fixtures.mjs";

export async function routeRequest({ method, pathname, searchParams, body = {} }) {
  if (method === "OPTIONS") {
    return { status: 204, body: {} };
  }

  if (method === "GET" && pathname === "/health") {
    return { status: 200, body: { status: "ok", service: "mock-api", db: repositories.mode, eventBus: eventBus.mode } };
  }

  if (method === "GET" && pathname === `/v1/businesses/${businessId}/snapshot`) {
    return { status: 200, body: await repositories.getBusinessSnapshot(businessId) };
  }

  if (method === "POST" && pathname === "/v1/decisions/working-capital") {
    return {
      status: 200,
      body: createWorkingCapitalDecision(body.businessId ?? businessId)
    };
  }

  if (method === "POST" && pathname === "/v1/approvals") {
    const approval = captureApproval({ ...body, businessId: body.businessId ?? businessId });
    await repositories.putApproval(approval.businessId, approval);
    await repositories.appendProofEvents(approval.businessId, approval.proofsToPrepend);
    await publishApprovalEvents(approval, body.idempotencyKey);

    return {
      status: 200,
      body: approval
    };
  }

  if (method === "POST" && pathname === "/v1/agent/messages") {
    const verifiedCount = scenario.proofs.filter((proof) => proof.status === "verified").length;
    return {
      status: 200,
      body: answerAgentMessage(body, { count: scenario.proofs.length, verifiedCount })
    };
  }

  if (method === "GET" && pathname === "/v1/proof-chain") {
    const requestedBusinessId = searchParams.get("businessId") ?? businessId;
    const persistedProofs = await repositories.listProofEvents(requestedBusinessId);

    return {
      status: 200,
      body: {
        businessId: requestedBusinessId,
        proofs: [...persistedProofs, ...scenario.proofs]
      }
    };
  }

  return { status: 404, body: { error: "not_found", path: pathname } };
}

async function publishApprovalEvents(approval, idempotencyKey) {
  const eventBase = {
    businessId: approval.businessId,
    idempotencyKey: idempotencyKey ?? `${approval.businessId}:${approval.actionState}:${approval.proofsToPrepend[0]?.hash}`,
    payload: {
      actionState: approval.actionState,
      proofIds: approval.proofsToPrepend.map((proof) => proof.id)
    }
  };

  await eventBus.publish(createDomainEvent({ ...eventBase, type: "approval.captured" }));

  if (approval.actionState !== "approved") {
    return;
  }

  await eventBus.publish(
    createDomainEvent({
      ...eventBase,
      type: "upi.mandate.prepared",
      idempotencyKey: `${eventBase.idempotencyKey}:upi`
    })
  );
  await eventBus.publish(
    createDomainEvent({
      ...eventBase,
      type: "ondc.purchase_order.created",
      idempotencyKey: `${eventBase.idempotencyKey}:ondc`
    })
  );
}
