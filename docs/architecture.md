# Architecture

India Stack Agent OS is contract-first. The frontend talks only to `/v1/*`; local mocks, LocalStack-backed services, and future production adapters must preserve those contracts.

## Runtime Shape

- `src/` is the owner and partner console.
- `contracts/agent-os.openapi.yaml` is the API source of truth.
- `services/mock-api/server.mjs` is the local HTTP server.
- `services/mock-api/http.mjs` is the route layer that maps HTTP requests to service functions.
- `services/mock-api/services/` holds business workflows such as working-capital decisions and approvals.
- `services/mock-api/adapters/` holds mock India Stack rail adapters.
- `services/mock-api/db/` holds repository implementations for memory and DynamoDB-backed local/prod parity.
- `services/mock-api/lib/fixtures.mjs` holds shared scenario data for mock API and production demo packaging.
- `scripts/prepare-sites-build.mjs` creates a self-contained Sites worker artifact for the public demo.

## Adapter Rule

Each regulated rail is hidden behind an adapter:

- AA: cashflow and consented financial data.
- ONDC: demand, catalog, order, and inventory signals.
- GSTN: compliance and filing attestations.
- OCEN: lender offer discovery and execution.
- UPI: payment, collect, refund, and mandate actuation.
- DigiLocker: identity and verified documents.
- Finternet: proof chain, verified assets, obligations, and settlement proofs.

Production integration should replace adapter internals without changing service outputs or `/v1` response shapes.

## First Workflow

The first closed loop is MSME working capital:

1. Read cashflow attestation from AA.
2. Read demand and stockout signal from ONDC.
3. Read compliance attestation from GSTN.
4. Discover comparable offers through OCEN.
5. Ask owner approval.
6. Prepare UPI repayment mandate.
7. Append proof events for audit.

## Databases

The service uses repository interfaces so local tests can run in memory while Docker Compose can use LocalStack DynamoDB:

- `agent-os-business-state`: current business snapshot keyed by `business_id`.
- `agent-os-proof-chain`: proof events keyed by `business_id` and `proof_id`.
- `agent-os-approvals`: owner approval or rejection decisions keyed by `business_id` and `approval_id`.

## Local/Production Parity

Local runs the same frontend and API contract as production. LocalStack is used for AWS-shaped dependencies, and mock adapters stand in for regulated rails until real credentials or partner sandboxes exist.

The invariant: callers do not know whether they are talking to a mock adapter or real rail adapter.
