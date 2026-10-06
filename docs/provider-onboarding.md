# Provider Onboarding

## Setu sandbox pilot on Sites

The hosted app can run one real Setu sandbox consent while public visitors retain
the simulated demo. Configure these server runtime values through Sites:

- `AA_ADAPTER_MODE=sandbox` (other rails remain simulated)
- `AA_BASE_URL=https://fiu-sandbox.setu.co`
- `AA_CLIENT_ID`, `AA_CLIENT_SECRET` (secrets; exchanged for short-lived tokens)
- `AA_PRODUCT_INSTANCE_ID`
- `AA_SANDBOX_CONSENT_ID` (the provider-created consent pinned to this pilot)
- `AA_SANDBOX_ACCESS_KEY` (a randomly generated secret for the private workspace)

Open the app using `/#aa-access=<private workspace key>` or enter the key with
**Open private sandbox**. The app removes the fragment and keeps the key only in
session storage. Never share this private link publicly. Requests carry the key
to the same origin only; keys and provider credentials are excluded from builds.

The pilot reads consent and session state directly from Setu, so it survives
Worker restarts. It reuses the pinned consent, checks ACTIVE status before data
fetches, uses the provider-approved range, and rejects sessions for other
consents. Approve using Setu's returned URL; choose Setu FIP-2 for dummy data.
Create a session after approval and use **Refresh AA state** to fetch its status
and cashflow when ready. Consent/session references, status observations, fetch
requests and decision audit events persist in the Site's D1 database (`DB`). Saved
history contains no raw bank statements or secrets. These are application
observations, not signed provider attestations.

Pending/partial sessions are polled for status without fetching their financial
payload. Completed sessions are reused; failed/expired sessions require an
explicit **Retry failed fetch**. A database-enforced fetch lock prevents duplicate
POSTs across workers. An uncertain POST is never automatically replayed: a new
provider session is reconciled only by its ID or a creation timestamp at or after
the saved request time. If Setu cannot supply either, the fetch stays blocked for
operator reconciliation. There is no timeout-based unlocking.

Expired/revoked consent blocks FI reads and session creation. Stale dates require
a new approval. Provider outages preserve historical references but disable reads
and estimates until current permission can be verified. Private session history
comes from D1 rather than browser storage. Missing storage fails closed.

Schema is in `db/schema.ts`; generated Drizzle migrations are applied by Sites
before Worker upload. Applied migration files and metadata are immutable.

Callbacks are disabled for this pilot until sender authentication is implemented.
Consent and session status are checked by polling Setu. The private workspace
calculates a working-capital estimate from the latest completed Setu statement.
Demand, compliance, lender offers and proof events remain simulated. The private
workspace disables approval/execution both in the UI and at the API.

Sandbox policy `sandbox-net-inflow-v1` allocates 25% of net inflows projected to
45 days, multiplied by 1 / 0.75 / 0.5 for low / moderate / high volatility.
After the simulated APR and fee, principal is capped by the simulated Rs 72,000
restock target and offer limit, then rounded down to Rs 1,000. Negative net
inflows, incomplete data, or insufficient fee coverage produce a zero estimate.
This illustrative policy does not account for existing debts, tax or future
sales changes and is not a lender underwriting model.

The source requires active unexpired consent, a completed session belonging to
that consent, approved dates and a statement ending within the past seven days.
The policy requires at least 30 days, dated transactions and valid amounts/types.
No fixture cashflow is substituted when the source is unavailable. The UI labels
reported balances accurately; `averageDailyBalance` remains a deprecated API
compatibility field.

For local Node testing, use `AA_ADAPTER_MODE=sandbox` with
`RAIL_ADAPTER_MODE=fixture` to switch only the consent/session client to Setu.
Set `AA_SANDBOX_CONSENT_ID` to the approved consent ID. The working-capital adapter
reads its latest completed session; the default pilot business is `ravi-stores`.
The preflight now calls the authenticated FIP endpoint, rather than a root URL.
Security/token-refresh checks: `npm run test:setu-security`.

This is the handoff checklist for moving from mock or fixture rail adapters to real India Stack sandbox and production integrations.

## Current Adapter Modes

- `in-process`: default deterministic fixtures compiled into adapters.
- `fixture`: recorded provider response fixtures under `fixtures/rails/*`, normalized through provider-specific mappers.
- `mock-http`: local HTTP mock rail service via `MOCK_RAILS_BASE_URL`.
- `sandbox`: future provider sandbox endpoints using the same adapter contract.
- `prod`: future production provider endpoints using the same adapter contract.

The adapter contract is `contracts/rail-adapters.json`. Real providers must preserve the normalized service outputs already covered by `npm run test:fixtures`, `npm run test:adapters`, and `npm run test:rails-http`.

## Access Needed

### Account Aggregator

Needed:

- FIU registration or access through an FIU partner.
- Sandbox base URL.
- OAuth/client credentials or signed request details.
- Consent creation and consent artifact APIs.
- Sample consent handle and financial information response.

Selected sandbox path:

- Setu FIU sandbox: gateway-style API at `https://fiu-sandbox.setu.co` using bearer token plus `x-product-instance-id`.

Other candidate path:

- Finvu AA sandbox: FIU calls use `client_api_key` plus detached JWS in `x-jws-signature`.

Run `npm run sandbox:aa:check` after credentials are available.

Adapter operation:

- `readCashflowAttestation`
- Normalized output: cashflow, balance, volatility, and purpose-bound consent reference.

### Setu AA Implementation Flow

1. Create consent through `POST /v1/rails/aa/consents` and redirect the customer to the returned Setu URL.
2. Receive the consent notification at `POST /v1/rails/aa/callback`, then confirm the consent is active with `GET /v1/rails/aa/consents/:id`.
3. Create a JSON financial-information session through `POST /v1/rails/aa/sessions` with the approved consent ID and permitted data range.
4. Wait for the Setu FI-data notification, then fetch the session at `GET /v1/rails/aa/sessions/:id` only when its status is `PARTIAL` or `COMPLETED`.
5. Read the normalized affordability evidence at `GET /v1/rails/aa/sessions/:id/cashflow`.

The service never puts AA credentials in the browser. Configure the Setu Bridge webhook to reach the deployed backend over HTTPS. Verify the provider's configured notification-authentication mechanism before persisting or acting on a callback.

### GSTN

Needed:

- GSP/ASP partner access or sandbox credentials.
- GSTIN test profile.
- Auth mode, headers, and token refresh process.
- Filing summary and liability response samples.

Adapter operation:

- `readComplianceAttestation`
- Normalized output: filing streak, open liability flag, and compliance status.

### ONDC

Needed:

- Buyer/seller network participant sandbox access, or a partner API.
- Signing key flow and registry details if using protocol-level integration.
- Catalog, order, search, or demand-signal response samples.

Adapter operation:

- `readDemandSignals`
- Normalized output: demand lift, stockout SKUs, and demand window.

### OCEN

Needed:

- Lending service provider or lender sandbox credentials.
- Borrower/loan application test profile.
- Offer discovery API response samples.
- Consent and bureau/GST/bank-statement dependency references.

Adapter operation:

- `discoverCreditOffers`
- Normalized output: comparable lender offers with APR, tenure, amount, score, and fee.

### UPI

Needed:

- PSP, bank, or payment aggregator sandbox access.
- UPI AutoPay mandate creation API.
- Test VPA or account handles.
- Approval reference required before mandate creation.
- Webhook or status callback contract.

Adapter operation:

- `prepareRepaymentMandate`
- Normalized output: UPI mandate type, amount, cap days, and prepared status.

### Finternet

Needed:

- Partner sandbox or proof-ledger API access.
- Proof write endpoint, auth, and idempotency semantics.
- Verified asset and obligation response samples.
- Settlement proof or audit event schema.

Adapter operation:

- `writeProofEvent`
- Normalized output: proof id, timestamp, label, rail, hash, status, and detail.

## Secrets And Env

Do not commit real credentials. The expected runtime configuration shape is:

```bash
RAIL_ADAPTER_MODE=sandbox
MOCK_RAILS_BASE_URL=
RAIL_ADAPTER_TIMEOUT_MS=1500
RAIL_ADAPTER_RETRIES=1
AA_BASE_URL=
AA_CLIENT_ID=
AA_CLIENT_SECRET=
GSTN_BASE_URL=
GSTN_API_KEY=
ONDC_BASE_URL=
ONDC_SIGNING_KEY=
OCEN_BASE_URL=
OCEN_PARTNER_TOKEN=
UPI_BASE_URL=
UPI_CLIENT_ID=
UPI_CLIENT_SECRET=
FINTERNET_BASE_URL=
FINTERNET_PARTNER_TOKEN=
```

Store these in the deployment environment or a secrets manager, not in `.env` committed to Git.

## First Real Integration Sequence

1. Replace `fixtures/rails/<rail>/*.json` with recorded sandbox responses.
2. Update the matching normalizer under `services/mock-api/adapters/normalizers/`.
3. Run `npm run test:fixtures`.
4. Implement the sandbox HTTP call behind that adapter.
5. Run `RAIL_ADAPTER_MODE=sandbox npm run test:adapters` with sandbox credentials loaded locally.
6. Run the API contract and event smoke tests against LocalStack.
7. Only then point a deployed environment at sandbox credentials.

Do irreversible operations last. Start with AA/GSTN/ONDC read paths, then OCEN offer discovery, then UPI mandate preparation and Finternet proof writes.

## Sandbox-Ready Strategy Without Full Data

When credentials or test identities are missing, keep the integration shape but preserve the mock fallback.

Use this rule for every rail:

- if sandbox credentials exist, use the sandbox adapter path;
- if only fixture or sample payloads exist, normalize them through the existing adapter;
- if neither exists, keep the in-process or mock-http path and surface the missing inputs in preflight.

That lets us make the whole product sandbox-ready in this order:

1. AA read flow and consent/session lifecycle.
2. GSTN compliance read flow.
3. ONDC demand signal read flow.
4. OCEN offer discovery.
5. UPI repayment mandate preparation.
6. Finternet proof write flow.
7. DigiLocker verified-document reads.
8. BBPS bill obligation reads.

For DigiLocker and BBPS, we are currently keeping the sandbox-ready adapter shape and using fixture/mock fallback until real partner access or test credentials are available.

## What To Test Locally

Run these in order:

1. Install and start the local app.

```bash
npm install
npm run dev
```

2. Run the AA sandbox-ready smoke test.

```bash
node scripts/setu-aa-smoke.mjs
```

3. Run adapter contract checks.

```bash
npm run test:adapters
npm run test:fixtures
```

4. Run the app-level smoke and integration checks.

```bash
npm run test:integration
npm run test:rails-http
```

5. Run the production build.

```bash
npm run build
```

6. If you later have sandbox credentials, export them and run the preflight check before switching any environment to sandbox.

```bash
npm run sandbox:aa:check
```

Expected behavior while you are still missing real data:

- UI should work with mock/local AA state.
- Consent should create successfully.
- Session should create after consent.
- Cashflow should normalize from the mock session.
- Other rails should keep using their current mock/fixture paths.
