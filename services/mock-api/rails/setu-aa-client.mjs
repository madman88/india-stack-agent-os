import { normalizeSetuConsent, normalizeSetuDataSession, normalizeSetuCashflowAttestation } from "../../shared/setu-aa-normalizers.mjs";
export { normalizeSetuConsent, normalizeSetuDataSession, normalizeSetuCashflowAttestation, normalizeSetuNotification } from "../../shared/setu-aa-normalizers.mjs";
import { createSetuGateway } from "../../shared/setu-aa-gateway.mjs";
import { fetchRailJson, railAdapterMode } from "../clients/rail-client.mjs";

const setuConfig = {
  sandboxBaseUrl: process.env.AA_BASE_URL ?? "https://fiu-sandbox.setu.co",
  accessToken: process.env.AA_ACCESS_TOKEN,
  productInstanceId: process.env.AA_PRODUCT_INSTANCE_ID,
  clientId: process.env.AA_CLIENT_ID,
  clientSecret: process.env.AA_CLIENT_SECRET
};

export function setuAaCredentialStatus() {
  const missing = [];
  if (!setuConfig.accessToken && !(setuConfig.clientId && setuConfig.clientSecret)) missing.push("AA_ACCESS_TOKEN or AA_CLIENT_ID + AA_CLIENT_SECRET");
  if (!setuConfig.productInstanceId) missing.push("AA_PRODUCT_INSTANCE_ID");
  return {
    provider: "setu",
    mode: setuMode(),
    baseUrl: setuConfig.sandboxBaseUrl,
    missing
  };
}

export async function createSetuConsent(input) {
  const payload = buildConsentPayload(input);
  return normalizeSetuConsent(
    await setuRequest("/v2/consents", {
      operation: "createConsent",
      method: "POST",
      body: payload
    })
  );
}

export async function getSetuConsent(consentId) {
  return normalizeSetuConsent(
    await setuRequest(`/v2/consents/${consentId}?expanded=true`, {
      operation: "getConsent"
    })
  );
}

export async function createSetuDataSession(input) {
  if (!input.consentId) {
    throw new Error("consentId is required to create an AA data session");
  }
  if (!input.dataRange?.from || !input.dataRange?.to) {
    throw new Error("dataRange.from and dataRange.to are required to create an AA data session");
  }

  const payload = {
    consentId: input.consentId,
    dataRange: input.dataRange,
    format: input.format ?? "json"
  };

  return normalizeSetuDataSession(
    await setuRequest("/v2/sessions", {
      operation: "createDataSession",
      method: "POST",
      body: payload
    })
  );
}

export async function getSetuDataSession(sessionId) {
  return normalizeSetuDataSession(
    await setuRequest(`/v2/sessions/${encodeURIComponent(sessionId)}`, {
      operation: "getDataSession"
    })
  );
}

export async function getSetuCashflowAttestation(sessionId) {
  const session = await getSetuDataSession(sessionId);
  return normalizeSetuCashflowAttestation(session);
}

async function setuRequest(path, options) {
  const mode = setuMode();
  if (mode !== "mock-http" && mode !== "sandbox" && mode !== "prod") {
    return mockSetuRequest(path, options);
  }

  if (mode === "sandbox" || mode === "prod") {
    const credentialStatus = setuAaCredentialStatus();
    if (credentialStatus.missing.length > 0) {
      throw new Error(`Setu credentials are missing: ${credentialStatus.missing.join(", ")}`);
    }
  }

  if (mode === "sandbox" || mode === "prod") {
    return gateway.request(path, options);
  }

  const body = await fetchRailJson(path, {
    rail: "AA",
    operation: options.operation,
    method: options.method ?? "GET",
    headers: setuHeaders(),
    body: options.body
  });

  return body;
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

async function mockSetuRequest(path, options) {
  if (path === "/v2/consents" && options.method === "POST") {
    return buildMockConsent(options.body);
  }

  const consentMatch = path.match(/^\/v2\/consents\/([^/?]+)(?:\?expanded=true)?$/);
  if (consentMatch && (!options.method || options.method === "GET")) {
    return buildMockConsent({ id: consentMatch[1], status: "ACTIVE" });
  }

  if (path === "/v2/sessions" && options.method === "POST") {
    return buildMockSession(options.body);
  }

  const sessionMatch = path.match(/^\/v2\/sessions\/([^/]+)$/);
  if (sessionMatch && (!options.method || options.method === "GET")) {
    return buildMockSession({ id: sessionMatch[1] });
  }

  return {};
}

function buildConsentPayload(input) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - Number(input.lookbackDays ?? 90));

  if (setuMode() === "sandbox") {
    const vua = input.vua ?? input.customerMobile;
    if (!vua) throw new Error("A test mobile number or VUA is required for sandbox consent");
    return {
      vua,
      consentDuration: { unit: "DAY", value: "1" },
      consentMode: "STORE",
      fetchType: "ONETIME",
      consentTypes: ["SUMMARY", "TRANSACTIONS"],
      fiTypes: ["DEPOSIT"],
      purpose: { code: "105", refUri: "https://api.rebit.org.in/aa/purpose/105.xml", text: "Explicit one-time consent for accessing data from the accounts", category: { type: "string" } },
      frequency: { unit: "DAY", value: 1 },
      dataLife: { unit: "DAY", value: 1 },
      dataRange: { from: input.dataRange?.from ?? from.toISOString(), to: input.dataRange?.to ?? now.toISOString() },
      context: [{ key: "fipId", value: "setu-fip-2" }, { key: "purposeCode", value: "105" }],
      redirectUrl: input.redirectUrl ?? process.env.AA_REDIRECT_URL
    };
  }

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
    purposeCode: input.purposeCode ?? "101",
    purposeText: input.purposeText ?? "working capital affordability",
    consentTypes: input.consentTypes ?? ["TRANSACTIONS", "SUMMARY", "PROFILE"],
    additionalParams: {
      tags: input.tags ?? ["india-stack-agent-os", "working-capital"]
    }
  };
}

function buildMockConsent(body) {
  const suffix = String(body.customerMobile ?? body.vua ?? body.customerName ?? "local")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16)
    .toLowerCase();
  const stamp = Date.now().toString(36);
  const id = body.id ?? `setu-consent-${suffix || "local"}-${stamp}`;
  return {
    id,
    status: body.status ?? "PENDING",
    url: `https://fiu-sandbox.setu.co/v2/consents/webview/${id}`,
    redirectUrl: `https://fiu-sandbox.setu.co/v2/consents/webview/${id}`,
    traceId: "trace-setu-consent-001",
    detail: {
      vua: body.vua ?? "9999999999@setu",
      purpose: {
        code: body.purposeCode ?? "101",
        text: body.purposeText ?? "working capital affordability"
      },
      fiTypes: ["DEPOSIT"],
      dataRange: body.dataRange ?? null,
      consentTypes: body.consentTypes ?? ["TRANSACTIONS", "SUMMARY", "PROFILE"]
    }
  };
}

function buildMockSession(body) {
  const suffix = String(body.consentId ?? body.id ?? "local")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16)
    .toLowerCase();
  const stamp = Date.now().toString(36);
  const id = body.id ?? `setu-session-${suffix || "local"}-${stamp}`;
  return {
    id,
    consentId: body.consentId ?? "setu-consent-ravi-001",
    status: body.status ?? "COMPLETED",
    format: body.format ?? "json",
    dataRange: body.dataRange ?? null,
    traceId: "trace-setu-session-001",
    fips: [
      {
        fipID: "Setu-FIP",
        accounts: [
          {
            maskedAccNumber: "XXXXXX4373",
            FIstatus: "READY",
            data: {
              summary: { currentBalance: "62000" },
              transactions: {
                transaction: [
                  { transactionType: "CREDIT", amount: "180000" },
                  { transactionType: "CREDIT", amount: "155000" },
                  { transactionType: "CREDIT", amount: "145000" },
                  { transactionType: "DEBIT", amount: "93000" }
                ]
              }
            }
          }
        ]
      }
    ]
  };
}


function setuMode() {
  return process.env.AA_ADAPTER_MODE ?? railAdapterMode();
}

const gateway = createSetuGateway(process.env);
