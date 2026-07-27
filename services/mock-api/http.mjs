import { createWorkingCapitalDecision, answerAgentMessage } from "./services/agent-service.mjs";
import { captureApproval } from "./services/approval-service.mjs";
import { businessId, scenario } from "./lib/fixtures.mjs";

export async function routeRequest({ method, pathname, searchParams, body = {} }) {
  if (method === "OPTIONS") {
    return { status: 204, body: {} };
  }

  if (method === "GET" && pathname === "/health") {
    return { status: 200, body: { status: "ok", service: "mock-api" } };
  }

  if (method === "GET" && pathname === `/v1/businesses/${businessId}/snapshot`) {
    return { status: 200, body: scenario };
  }

  if (method === "POST" && pathname === "/v1/decisions/working-capital") {
    return {
      status: 200,
      body: createWorkingCapitalDecision(body.businessId ?? businessId)
    };
  }

  if (method === "POST" && pathname === "/v1/approvals") {
    return {
      status: 200,
      body: captureApproval({ ...body, businessId: body.businessId ?? businessId })
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
    return {
      status: 200,
      body: {
        businessId: searchParams.get("businessId") ?? businessId,
        proofs: scenario.proofs
      }
    };
  }

  return { status: 404, body: { error: "not_found", path: pathname } };
}
