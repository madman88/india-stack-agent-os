# AA Sandbox Research

Checked on July 27, 2026.

## Can We Use A Dev Sandbox?

Yes, but not as an unauthenticated public API. Sahamati lists multiple Account Aggregator sandboxes that implement ReBIT AA specifications. For our first integration, the most practical routes are:

- Finvu AA sandbox, because the public docs describe FIU/FIP and AA REST API sandbox flows.
- Setu FIU sandbox, because the docs expose a higher-level FIU gateway model with sandbox and production base URLs.

## What The Docs Require

Sahamati says only entities registered and regulated by RBI, SEBI, IRDAI, or PFRDA can be FIUs/FIPs on the AA network. It also says FIUs should test with an AA sandbox and write to `services@sahamati.org.in` for access to AA Common Services such as Central Registry and Token Server.

Finvu sandbox docs state that FIU calls use `client_api_key` and `x-jws-signature`, and that request/response bodies need detached JWS signatures.

Setu docs show a gateway-style sandbox at `https://fiu-sandbox.setu.co`, with `Authorization: Bearer <access_token>` and `x-product-instance-id` headers for consent APIs. The consent flow starts with `POST /consents`, returns an `id`, `status = PENDING`, and a redirect `url`, then status is read with `GET /consents/:id`. Their docs also note notification/webhook support and mock Setu FIP/FIP-2 accounts for staging data.

## Repo Support Added

Use this once credentials exist:

```bash
npm run sandbox:aa:check
```

Default Setu-style integration:

```bash
AA_SANDBOX_PROVIDER=setu
AA_BASE_URL=https://fiu-sandbox.setu.co
AA_ACCESS_TOKEN=
AA_PRODUCT_INSTANCE_ID=
AA_CALLBACK_BASE_URL=
```

For Finvu-style integration:

```bash
AA_SANDBOX_PROVIDER=finvu
AA_BASE_URL=
AA_CLIENT_API_KEY=
AA_JWS_PRIVATE_KEY=
AA_JWS_KEY_ID=
AA_CALLBACK_BASE_URL=
```

The preflight script reports missing credentials without failing, so we can keep it in the repo before onboarding is complete.

Setu routes now scaffolded locally:

```bash
GET  /v1/rails/aa/setu/preflight
POST /v1/rails/aa/consents
GET  /v1/rails/aa/consents/:id
POST /v1/rails/aa/callback
```

Local mock Setu consent flow is covered by:

```bash
npm run test:setu-aa
```

## Practical Onboarding Ask

Start with one AA provider, not all of them. Ask for:

- FIU sandbox credentials.
- Test VUA handles and dummy FIP accounts.
- Consent request parameters for MSME working-capital underwriting.
- Callback/webhook setup requirements.
- JWS signing requirements and public-key registration flow.
- Current ReBIT API version supported by their sandbox.

Once you have those, we can record the first sandbox responses into `fixtures/rails/aa/*`, update the AA normalizer, and turn on `RAIL_ADAPTER_MODE=sandbox` locally.
