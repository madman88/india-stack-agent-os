import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { scenario } from "../lib/fixtures.mjs";

const defaultConfig = {
  driver: process.env.DB_DRIVER ?? "memory",
  region: process.env.AWS_REGION ?? "ap-south-1",
  endpoint: process.env.AWS_ENDPOINT_URL,
  proofChainTable: process.env.PROOF_CHAIN_TABLE ?? "agent-os-proof-chain",
  businessStateTable: process.env.BUSINESS_STATE_TABLE ?? "agent-os-business-state",
  approvalsTable: process.env.APPROVALS_TABLE ?? "agent-os-approvals",
  eventLedgerTable: process.env.EVENT_LEDGER_TABLE ?? "agent-os-event-ledger"
};

function createDocumentClient(config) {
  const client = new DynamoDBClient({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test"
    }
  });

  return DynamoDBDocumentClient.from(client);
}

function createMemoryRepositories() {
  const proofEvents = new Map();
  const approvals = new Map();
  const eventLedger = new Map();
  const snapshots = new Map([[scenario.business.id, scenario]]);

  return {
    mode: "memory",
    async getBusinessSnapshot(businessId) {
      return snapshots.get(businessId) ?? scenario;
    },
    async putBusinessSnapshot(businessId, snapshot) {
      snapshots.set(businessId, snapshot);
      return snapshot;
    },
    async listProofEvents(businessId) {
      return proofEvents.get(businessId) ?? [];
    },
    async appendProofEvents(businessId, proofs) {
      const existing = proofEvents.get(businessId) ?? [];
      proofEvents.set(businessId, [...proofs, ...existing]);
      return proofs;
    },
    async putApproval(businessId, approval) {
      const existing = approvals.get(businessId) ?? [];
      approvals.set(businessId, [approval, ...existing]);
      return approval;
    },
    async listApprovals(businessId) {
      return approvals.get(businessId) ?? [];
    },
    async hasProcessedEvent(eventId) {
      return eventLedger.has(eventId);
    },
    async markEventProcessed(event) {
      eventLedger.set(event.eventId, {
        event,
        processedAt: new Date().toISOString()
      });
      return event;
    }
  };
}

function createDynamoRepositories(config) {
  const doc = createDocumentClient(config);

  return {
    mode: "dynamodb",
    async getBusinessSnapshot(businessId) {
      const result = await doc.send(
        new GetCommand({
          TableName: config.businessStateTable,
          Key: { business_id: businessId }
        })
      );

      return result.Item?.snapshot ?? scenario;
    },
    async putBusinessSnapshot(businessId, snapshot) {
      await doc.send(
        new PutCommand({
          TableName: config.businessStateTable,
          Item: {
            business_id: businessId,
            snapshot,
            updated_at: new Date().toISOString()
          }
        })
      );
      return snapshot;
    },
    async listProofEvents(businessId) {
      const result = await doc.send(
        new QueryCommand({
          TableName: config.proofChainTable,
          KeyConditionExpression: "business_id = :businessId",
          ExpressionAttributeValues: {
            ":businessId": businessId
          },
          ScanIndexForward: false
        })
      );

      return (result.Items ?? []).map((item) => item.proof);
    },
    async appendProofEvents(businessId, proofs) {
      await Promise.all(
        proofs.map((proof, index) =>
          doc.send(
            new PutCommand({
              TableName: config.proofChainTable,
              Item: {
                business_id: businessId,
                proof_id: `${Date.now()}-${index}-${proof.id}`,
                proof,
                rail: proof.rail,
                status: proof.status,
                created_at: new Date().toISOString()
              }
            })
          )
        )
      );
      return proofs;
    },
    async putApproval(businessId, approval) {
      await doc.send(
        new PutCommand({
          TableName: config.approvalsTable,
          Item: {
            business_id: businessId,
            approval_id: `${Date.now()}-${approval.actionState}`,
            approval,
            action_state: approval.actionState,
            created_at: new Date().toISOString()
          }
        })
      );
      return approval;
    },
    async listApprovals(businessId) {
      const result = await doc.send(
        new QueryCommand({
          TableName: config.approvalsTable,
          KeyConditionExpression: "business_id = :businessId",
          ExpressionAttributeValues: {
            ":businessId": businessId
          },
          ScanIndexForward: false
        })
      );

      return (result.Items ?? []).map((item) => item.approval);
    },
    async hasProcessedEvent(eventId) {
      const result = await doc.send(
        new GetCommand({
          TableName: config.eventLedgerTable,
          Key: { event_id: eventId }
        })
      );

      return Boolean(result.Item);
    },
    async markEventProcessed(event) {
      await doc.send(
        new PutCommand({
          TableName: config.eventLedgerTable,
          Item: {
            event_id: event.eventId,
            event,
            event_type: event.type,
            business_id: event.businessId,
            processed_at: new Date().toISOString()
          },
          ConditionExpression: "attribute_not_exists(event_id)"
        })
      );
      return event;
    }
  };
}

export function createRepositories(config = defaultConfig) {
  if (config.driver === "dynamodb") {
    return createDynamoRepositories(config);
  }

  return createMemoryRepositories();
}

export const repositories = createRepositories();
