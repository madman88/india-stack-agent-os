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

export function normalizeSetuDataSession(input) {
  return {
    provider: "setu",
    id: input.id,
    consentId: input.consentId ?? null,
    status: input.status,
    format: input.format ?? "json",
    dataRange: input.dataRange ?? null,
    traceId: input.traceId ?? null,
    fips: input.fips ?? input.fiData ?? []
  };
}

export function normalizeSetuCashflowAttestation(session) {
  if (!session?.id) {
    throw new Error("Setu data session is missing an id");
  }

  if (!["PARTIAL", "COMPLETED"].includes(session.status)) {
    throw new Error(`Setu data session ${session.id} is not ready: ${session.status ?? "unknown"}`);
  }

  const accounts = collectAccounts(session.fips);
  const transactions = accounts.flatMap((account) => collectTransactions(account.data ?? account.decryptedFI ?? account));
  const credits = transactions.filter((transaction) => isCredit(transaction));
  const inflow90d = credits.reduce((sum, transaction) => sum + transactionAmount(transaction), 0);
  const balances = accounts.map(accountBalance).filter(Number.isFinite);

  return {
    rail: "AA",
    inflow90d,
    averageDailyBalance: balances.length ? balances.reduce((sum, value) => sum + value, 0) / balances.length : 0,
    volatility: calculateVolatility(transactions),
    consent: {
      id: session.consentId,
      purpose: "working-capital-affordability",
      expiresInDays: null,
      status: "purpose-bound"
    },
    source: {
      provider: "setu",
      sessionId: session.id,
      status: session.status,
      traceId: session.traceId
    }
  };
}

async function setuRequest(path, options) {
  const mode = railAdapterMode();
  if (mode !== "mock-http" && mode !== "sandbox" && mode !== "prod") {
    return mockSetuRequest(path, options);
  }

  if (mode === "sandbox" || mode === "prod") {
    const credentialStatus = setuAaCredentialStatus();
    if (credentialStatus.missing.length > 0) {
      throw new Error(`Setu credentials are missing: ${credentialStatus.missing.join(", ")}`);
    }
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

function collectAccounts(fips) {
  return (Array.isArray(fips) ? fips : []).flatMap((fip) => {
    const accounts = fip.accounts ?? fip.data ?? [];
    return Array.isArray(accounts) ? accounts : [];
  });
}

function collectTransactions(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectTransactions);

  const transactions = value.transactions?.transaction ?? value.transactions?.transactions ?? value.transactions;
  if (Array.isArray(transactions)) return transactions;
  if (Array.isArray(value.transaction)) return value.transaction;
  return [];
}

function transactionAmount(transaction) {
  const value = transaction.amount ?? transaction.transactionAmount ?? transaction.depositAmount ?? 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function isCredit(transaction) {
  const type = String(transaction.transactionType ?? transaction.type ?? transaction.mode ?? "").toUpperCase();
  if (type) {
    return ["CREDIT", "CR", "DEPOSIT", "INFLOW"].includes(type);
  }
  return Number(transaction.amount) > 0;
}

function accountBalance(account) {
  const summary = account.data?.summary ?? account.decryptedFI?.summary ?? account.summary ?? {};
  const value = summary.currentBalance ?? summary.balance ?? summary.availableBalance;
  const balance = Number(value);
  return Number.isFinite(balance) ? balance : Number.NaN;
}

function calculateVolatility(transactions) {
  if (transactions.length < 3) return "unknown";
  const amounts = transactions.map(transactionAmount).filter((amount) => amount > 0);
  if (amounts.length < 3) return "unknown";
  const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
  const variance = amounts.reduce((sum, amount) => sum + (amount - mean) ** 2, 0) / amounts.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  if (coefficientOfVariation < 0.35) return "low";
  if (coefficientOfVariation < 0.8) return "moderate";
  return "high";
}
