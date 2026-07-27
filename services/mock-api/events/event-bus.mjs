import { DeleteMessageCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createHash, randomUUID } from "node:crypto";

const defaultConfig = {
  driver: process.env.EVENT_BUS_DRIVER ?? (process.env.RAIL_EVENTS_QUEUE_URL ? "sqs" : "memory"),
  region: process.env.AWS_REGION ?? "ap-south-1",
  endpoint: process.env.AWS_ENDPOINT_URL,
  queueUrl: process.env.RAIL_EVENTS_QUEUE_URL
};

const memoryQueue = [];

function eventIdFor(input) {
  if (input.idempotencyKey) {
    return createHash("sha256").update(`${input.type}:${input.businessId}:${input.idempotencyKey}`).digest("hex");
  }

  return randomUUID();
}

export function createDomainEvent(input) {
  return {
    eventId: eventIdFor(input),
    type: input.type,
    businessId: input.businessId,
    idempotencyKey: input.idempotencyKey ?? null,
    payload: input.payload ?? {},
    occurredAt: new Date().toISOString()
  };
}

function createSqsClient(config) {
  return new SQSClient({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test"
    }
  });
}

export function createEventBus(config = defaultConfig) {
  if (config.driver === "sqs") {
    const client = createSqsClient(config);

    return {
      mode: "sqs",
      async publish(event) {
        await client.send(
          new SendMessageCommand({
            QueueUrl: config.queueUrl,
            MessageBody: JSON.stringify(event),
            MessageAttributes: {
              type: {
                DataType: "String",
                StringValue: event.type
              },
              businessId: {
                DataType: "String",
                StringValue: event.businessId
              }
            }
          })
        );
        return event;
      },
      async receive({ maxMessages = 5, waitTimeSeconds = 1 } = {}) {
        const result = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: config.queueUrl,
            MaxNumberOfMessages: maxMessages,
            WaitTimeSeconds: waitTimeSeconds
          })
        );

        return (result.Messages ?? []).map((message) => ({
          receiptHandle: message.ReceiptHandle,
          event: JSON.parse(message.Body ?? "{}")
        }));
      },
      async ack(message) {
        await client.send(
          new DeleteMessageCommand({
            QueueUrl: config.queueUrl,
            ReceiptHandle: message.receiptHandle
          })
        );
      }
    };
  }

  return {
    mode: "memory",
    async publish(event) {
      memoryQueue.push(event);
      return event;
    },
    async receive({ maxMessages = 5 } = {}) {
      return memoryQueue.splice(0, maxMessages).map((event) => ({ event }));
    },
    async ack() {}
  };
}

export const eventBus = createEventBus();
