# Local And Production Parity

The local environment should mirror production at service boundaries, not by calling live regulated rails.

## Local Stack

Use Docker Compose for local runtime:

```bash
docker compose up --build
```

Services:

- `web`: Vite frontend.
- `mock-rails`: HTTP-compatible AA, GSTN, ONDC, OCEN, UPI, and Finternet mock services.
- `mock-api`: contract-compatible service boundary.
- `localstack`: local AWS-compatible infrastructure.

## Terraform

LocalStack resources live in `infra/terraform/localstack`:

- S3 bucket for proof payloads.
- SQS queue for rail events.
- DynamoDB table for proof-chain events.
- DynamoDB table for business snapshots.
- DynamoDB table for approval decisions.
- DynamoDB table for processed event IDs.
- Secrets Manager secret for adapter endpoint config.

Run:

```bash
cd infra/terraform/localstack
terraform init
terraform apply
```

Seed the local tables after Terraform has created them:

```bash
DB_DRIVER=dynamodb npm run db:seed
```

Run a DB-backed smoke test against a DynamoDB-mode API:

```bash
API_BASE_URL=http://localhost:8787 npm run test:db
```

Run an event-bus smoke test against a DynamoDB/SQS-mode API:

```bash
API_BASE_URL=http://localhost:8787 npm run test:events
```

## Test Levels

Adapter contract smoke:

```bash
npm run test:adapters
```

This pins the normalized AA, GSTN, ONDC, OCEN, UPI, and Finternet-facing payloads that real rail adapters must keep producing when mocks are replaced.

Contract smoke:

```bash
npm run test:contracts
```

Requires an API already running at `API_BASE_URL` or `http://localhost:8787`.

Integration test:

```bash
npm run test:integration
```

Starts the mock API on an isolated port, runs the contract smoke test, then shuts down the API.

Rail HTTP smoke:

```bash
npm run test:rails-http
```

Starts `mock-rails` and `mock-api` on isolated ports, sets `MOCK_RAILS_BASE_URL`, and runs the public `/v1` contract through service-to-service rail calls.

Full local verification:

```bash
npm test
```

Runs integration checks and the production build.

GitHub Actions CI runs the same fast app checks plus Terraform validation, Docker Compose config validation, LocalStack Terraform apply, DynamoDB seeding, DB smoke, and SQS event smoke on every push to `main` and every pull request.

The test harness uses in-memory repositories and in-process rail fixtures by default so it does not require Docker or LocalStack. Docker Compose sets `DB_DRIVER=dynamodb` to exercise LocalStack-backed persistence.
Docker Compose also sets `RAIL_EVENTS_QUEUE_URL`, which enables SQS publishing and the worker service.
Docker Compose sets `MOCK_RAILS_BASE_URL=http://mock-rails:8790`, which routes adapter calls over HTTP.

## Production Rail Integration

Do not wire real AA, ONDC, GSTN, OCEN, UPI, DigiLocker, or Finternet services directly into frontend code. Add or replace adapter implementations under `services/` and keep the `/v1` contract stable.

Every real adapter should support:

- deterministic contract tests with recorded or sandbox responses
- timeout and retry policy
- normalized error shape
- proof or audit event emitted for every irreversible action
- explicit consent or approval reference for sensitive operations
