# Provider Onboarding

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

Adapter operation:

- `readCashflowAttestation`
- Normalized output: cashflow, balance, volatility, and purpose-bound consent reference.

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
