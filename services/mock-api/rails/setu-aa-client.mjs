import { fetchRailJson, railAdapterMode } from "../clients/rail-client.mjs";

const setuConfig = {
  sandboxBaseUrl: process.env.AA_BASE_URL ?? "https://fiu-sandbox.setu.co",
  accessToken: process.env.AA_ACCESS_TOKEN,
  productInstanceId: process.env.AA_PRODUCT_INSTANCE_ID
};

export function setuAaCredentialStatus() {
  const missing = [];
  if (!setuConfig.accessToken) missing.push("AA_ACCESS_TOKEN");
  if (!setuConfig.productInstanceId) missing.push("AA_PRODUCT_INSTANCE_ID");
  return {
    provider: "setu",
    mode: railAdapterMode(),
    baseUrl: setuConfig.sandboxBaseUrl,
    missing
  };
}

export async function createSetuConsent(input) {
  const payload = buildConsentPayload(input);
  return setuRequest("/v2/consents", {
    operation: "createConsent",
    method: "POST",
    body: payload
  });
}

export async function getSetuConsent(consentId) {
  return setuRequest(`/v2/consents/${consentId}?expanded=true`, {
    operation: "getConsent"
  });
}

export function normalizeSetuConsent(input) {
  return {
    provider: "setu",
    id: input.id,
    status: input.status,
    url: input.url,
    redirectUrl: input.redirectUrl ?? input.url,
    traceId: input.traceId ?? null,
    detail: {
      vua: input.detail?.vua ?? null,
      purpose: input.detail?.purpose?.text ?? null,
      purposeCode: input.detail?.purpose?.code ?? null,
      fiTypes: input.detail?.fiTypes ?? [],
      dataRange: input.detail?.dataRange ?? null,
      consentTypes: input.detail?.consentTypes ?? []
    }
  };
}

export function normalizeSetuNotification(input) {
  return {
    provider: "setu",
    eventType: input.eventType ?? input.type ?? "consent.notification",
    consentId: input.consentId ?? input.id ?? input.consent?.id ?? null,
    status: input.status ?? input.consent?.status ?? null,
    traceId: input.traceId ?? null,
    receivedAt: new Date().toISOString(),
    raw: input
  };
}

async function setuRequest(path, options) {
  const mode = railAdapterMode();
  if (mode === "sandbox" || mode === "prod") {
    const credentialStatus = setuAaCredentialStatus();
    if (credentialStatus.missing.length > 0) {
      return {
        provider: "setu",
        status: "missing_credentials",
        missing: credentialStatus.missing,
        baseUrl: credentialStatus.baseUrl
      };
    }
  }

  const body = await fetchRailJson(path, {
    rail: "AA",
    operation: options.operation,
    method: options.method ?? "GET",
    headers: setuHeaders(),
    body: options.body
  });

  return normalizeSetuConsent(body);
}

function setuHeaders() {
  if (!setuConfig.accessToken || !setuConfig.productInstanceId) {
    return {};
  }

  return {
    authorization: `Bearer ${setuConfig.accessToken}`,
    "x-product-instance-id": setuConfig.productInstanceId
  };
}

function buildConsentPayload(input) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - Number(input.lookbackDays ?? 90));

  return {
    consentDuration: {
      unit: input.consentDurationUnit ?? "MONTH",
      value: String(input.consentDurationValue ?? 4)
    },
    vua: input.vua ?? "9999999999@setu",
    dataRange: {
      from: input.dataRange?.from ?? from.toISOString(),
      to: input.dataRange?.to ?? now.toISOString()
    },
    context: input.context ?? [],
    additionalParams: {
      tags: input.tags ?? ["india-stack-agent-os", "working-capital"]
    }
  };
}
