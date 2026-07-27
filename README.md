# India Stack Agent OS

Contract-first prototype for a verifiable MSME working-capital agent.

The local environment keeps the same service boundary intended for production:

- `apps/web`: Vite/React frontend served from this package root.
- `services/mock-api`: local mock API using the same `/v1` contract production adapters will implement.
- `contracts/agent-os.openapi.yaml`: API contract for frontend, mock services, and future rail integrations.
- `infra/terraform/localstack`: local AWS-compatible resources for proof/event persistence experiments.

## Run Locally

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173  
Mock API: http://localhost:8787

## Tests

Run the full local verification:

```bash
npm test
```

Run a contract smoke test against an already running API:

```bash
npm run test:contracts
```

Run an integration test that starts and stops its own mock API:

```bash
npm run test:integration
```

## Docker Compose

```bash
docker compose up --build
```

This starts:

- `web` on port `5173`
- `mock-api` on port `8787`
- `localstack` on port `4566`

## Terraform With LocalStack

```bash
cd infra/terraform/localstack
terraform init
terraform apply
```

The Terraform stack creates local equivalents for:

- proof store bucket
- rail event queue
- proof chain table

## Production Integration Rule

Production services should implement the same OpenAPI contract as the mock API. Replace mock rail handlers with real adapters one at a time:

- AA adapter for consented cashflow reads
- ONDC adapter for catalog, demand, and order events
- GSTN adapter for compliance attestations
- OCEN adapter for offer discovery and loan execution
- UPI adapter for collect, payout, and mandate events
- Finternet adapter for tokenized assets, proof chains, and settlement proofs

Frontend code should continue to call `/v1/*`.

## Docs

- [Architecture](docs/architecture.md)
- [Local and production parity](docs/local-prod-parity.md)
- [Pilot plan](docs/pilot-plan.md)
