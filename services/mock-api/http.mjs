import { createWorkingCapitalDecision, answerAgentMessage } from "./services/agent-service.mjs";
import { captureApproval } from "./services/approval-service.mjs";
import {
  createSetuConsent,
  createSetuDataSession,
  getSetuCashflowAttestation,
  getSetuConsent,
  getSetuDataSession,
  normalizeSetuNotification,
  setuAaCredentialStatus
} from "./rails/setu-aa-client.mjs";
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

  if (method === "GET" && pathname === "/v1/rails/aa/setu/preflight") {
    return { status: 200, body: setuAaCredentialStatus() };
  }

  if (method === "GET" && pathname === "/v1/rails/aa/state") {
    const requestedBusinessId = searchParams.get("businessId") ?? businessId;
    return {
      status: 200,
      body: await buildAaState(requestedBusinessId)
    };
  }

  if (method === "POST" && pathname === "/v1/rails/aa/consents") {
    const consent = await createSetuConsent(body);
    await repositories.upsertAaConsent(body.businessId ?? businessId, consent);
    await repositories.appendAaAuditLog(body.businessId ?? businessId, {
      rail: "AA",
      action: "consent.created",
      consentId: consent.id,
      status: consent.status,
      traceId: consent.traceId ?? null
    });
    return { status: 200, body: consent };
  }

  if (method === "POST" && pathname === "/v1/rails/aa/sessions") {
    const session = await createSetuDataSession(body);
    await repositories.upsertAaSession(body.businessId ?? businessId, session);
    await repositories.appendAaAuditLog(body.businessId ?? businessId, {
      rail: "AA",
      action: "session.created",
      consentId: session.consentId,
      sessionId: session.id,
      status: session.status,
      traceId: session.traceId ?? null
    });
    return { status: 200, body: session };
  }

  const aaConsentMatch = pathname.match(/^\/v1\/rails\/aa\/consents\/([^/]+)$/);
  if (method === "GET" && aaConsentMatch) {
    const consent = await getSetuConsent(aaConsentMatch[1]);
    return { status: 200, body: consent };
  }

  const aaSessionCashflowMatch = pathname.match(/^\/v1\/rails\/aa\/sessions\/([^/]+)\/cashflow$/);
  if (method === "GET" && aaSessionCashflowMatch) {
    const cashflow = await getSetuCashflowAttestation(aaSessionCashflowMatch[1]);
    return { status: 200, body: cashflow };
  }

  const aaSessionMatch = pathname.match(/^\/v1\/rails\/aa\/sessions\/([^/]+)$/);
  if (method === "GET" && aaSessionMatch) {
    const session = await getSetuDataSession(aaSessionMatch[1]);
    return { status: 200, body: session };
  }

  if (method === "POST" && pathname === "/v1/rails/aa/callback") {
    const notification = normalizeSetuNotification(body);
    const requestedBusinessId = body.businessId ?? businessId;
    await repositories.appendAaAuditLog(requestedBusinessId, {
      rail: "AA",
      action: "callback.received",
      consentId: notification.consentId,
      status: notification.status,
      eventType: notification.eventType,
      traceId: notification.traceId ?? null
    });

    if (notification.consentId) {
      const existingConsent = await repositories.getAaConsent(notification.consentId);
      if (existingConsent) {
        await repositories.upsertAaConsent(requestedBusinessId, {
          ...existingConsent,
          status: notification.status ?? existingConsent.status,
          traceId: notification.traceId ?? existingConsent.traceId ?? null
        });
      }
    }

    return { status: 200, body: notification };
  }

  if (method === "GET" && pathname === `/v1/businesses/${businessId}/snapshot`) {
    return { status: 200, body: await repositories.getBusinessSnapshot(businessId) };
  }

  if (method === "POST" && pathname === "/v1/decisions/working-capital") {
    return {
      status: 200,
      body: await createWorkingCapitalDecision(body.businessId ?? businessId)
    };
  }

  if (method === "POST" && pathname === "/v1/approvals") {
    const approval = await captureApproval({ ...body, businessId: body.businessId ?? businessId });
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

async function buildAaState(requestedBusinessId) {
  const [consents, sessions, auditLogs] = await Promise.all([
    repositories.listAaConsents(requestedBusinessId),
    repositories.listAaSessions(requestedBusinessId),
    repositories.listAaAuditLogs(requestedBusinessId)
  ]);

  const latestConsent = consents[0] ?? null;
  const latestSession = sessions[0] ?? null;
  return {
    businessId: requestedBusinessId,
    provider: "setu",
    credentialStatus: setuAaCredentialStatus(),
    latestConsent,
    latestSession,
    auditLogs,
    canProceedToSandbox: Boolean(latestConsent?.id) && Boolean(latestSession?.id)
  };
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
