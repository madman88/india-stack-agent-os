import { eventBus } from "./events/event-bus.mjs";
import { handleRailEvent } from "./events/event-handlers.mjs";
import { repositories } from "./db/repositories.mjs";

const once = process.env.WORKER_ONCE === "true";
const pollMs = Number(process.env.WORKER_POLL_MS ?? 1000);

async function processBatch() {
  const messages = await eventBus.receive({ maxMessages: 10, waitTimeSeconds: once ? 1 : 5 });

  for (const message of messages) {
    const result = await handleRailEvent(message.event, repositories);
    await eventBus.ack(message);
    console.log(`${result.status} ${message.event.type} ${message.event.eventId}`);
  }

  return messages.length;
}

if (once) {
  await processBatch();
} else {
  console.log(`worker listening on ${eventBus.mode} event bus`);
  while (true) {
    await processBatch();
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
