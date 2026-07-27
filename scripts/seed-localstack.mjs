import { repositories } from "../services/mock-api/db/repositories.mjs";
import { businessId, scenario } from "../services/mock-api/lib/fixtures.mjs";

if (repositories.mode !== "dynamodb") {
  throw new Error("Set DB_DRIVER=dynamodb before running the LocalStack seed script");
}

await repositories.putBusinessSnapshot(businessId, scenario);
await repositories.appendProofEvents(businessId, scenario.proofs);

console.log(`seeded ${businessId} into LocalStack DynamoDB`);
