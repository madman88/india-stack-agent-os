import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { businessId, scenario } from "../services/mock-api/lib/fixtures.mjs";

const serverPath = join("dist", "server", "index.js");
const hostingPath = join("dist", ".openai", "hosting.json");

mkdirSync(dirname(serverPath), { recursive: true });
mkdirSync(dirname(hostingPath), { recursive: true });

writeFileSync(hostingPath, readFileSync(join(".openai", "hosting.json")));

function contentType(path) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function collectAssets(dir, prefix = "") {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "server" || entry === ".openai") return [];

    const absolute = join(dir, entry);
    const relative = `${prefix}/${entry}`;

    if (statSync(absolute).isDirectory()) {
      return collectAssets(absolute, relative);
    }

    return [
      {
        path: relative,
        content: readFileSync(absolute, "utf8"),
        contentType: contentType(relative)
      }
    ];
  });
}

const indexHtml = readFileSync(join("dist", "index.html"), "utf8");
const embeddedAssets = collectAssets("dist");

writeFileSync(
  serverPath,
  `
const embeddedIndexHtml = ${JSON.stringify(indexHtml)};
const embeddedAssets = ${JSON.stringify(embeddedAssets)};
const businessId = ${JSON.stringify(businessId)};
const scenario = ${JSON.stringify(scenario)};

const corsHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function nowTime() {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

function proof(label, rail, detail, status = "simulated") {
  const hash = Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return {
    id: "pf-" + hash.slice(0, 4),
    time: nowTime(),
    label,
    rail,
    hash,
    status,
    detail
  };
}

function handleMessage(body) {
  const text = String(body.message ?? "").toLowerCase();
  if (text.includes("why")) {
    return {
      message: "Because expected gross margin is Rs 10,900, repayment cost is Rs 1,310, and the stockout risk affects three high-velocity SKUs.",
      meta: "Decision rationale"
    };
  }

  if (text.includes("risk")) {
    return {
      message: "Main risk is slower-than-expected sell-through. The plan caps exposure at 45 days and avoids the higher APR offers.",
      meta: "Risk explanation"
    };
  }

  if (text.includes("proof")) {
    return {
      message: "Current proof chain has " + (body.proofCount ?? scenario.proofs.length) + " events, " + (body.verifiedProofCount ?? 3) + " verified attestations, and no failed settlement event.",
      meta: "Proof chain"
    };
  }

  return {
    message: "I can monitor cashflow, compare credit offers, prepare approvals, and write proof events before execution.",
    meta: "Agent response"
  };
}

function setuConsent(body = {}) {
  const id = body.id ?? "setu-consent-ravi-001";
  return {
    provider: "setu",
    id,
    status: body.status ?? "PENDING",
    url: "https://fiu-sandbox.setu.co/v2/consents/webview/" + id,
    redirectUrl: "https://fiu-sandbox.setu.co/v2/consents/webview/" + id,
    traceId: "trace-setu-sites-001",
    detail: {
      vua: body.vua ?? "9999999999@setu",
      purpose: body.purposeText ?? "Loan underwriting",
      purposeCode: body.purposeCode ?? "101",
      fiTypes: ["DEPOSIT"],
      dataRange: body.dataRange ?? null,
      consentTypes: body.consentTypes ?? ["TRANSACTIONS", "PROFILE", "SUMMARY"]
    }
  };
}

function setuDataSession(body = {}) {
  const id = body.id ?? "setu-session-ravi-001";
  return {
    provider: "setu",
    id,
    consentId: body.consentId ?? "setu-consent-ravi-001",
    status: body.status ?? "COMPLETED",
    format: body.format ?? "json",
    dataRange: body.dataRange ?? null,
    traceId: "trace-setu-sites-session-001",
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

function setuNotification(body = {}) {
  return {
    provider: "setu",
    eventType: body.eventType ?? body.type ?? "consent.notification",
    consentId: body.consentId ?? body.id ?? (body.consent && body.consent.id) ?? null,
    status: body.status ?? (body.consent && body.consent.status) ?? null,
    traceId: body.traceId ?? null,
    receivedAt: new Date().toISOString(),
    raw: body
  };
}

function collectAccounts(fips) {
  return (Array.isArray(fips) ? fips : []).flatMap((fip) => Array.isArray(fip.accounts) ? fip.accounts : []);
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
  const amount = Number(transaction.amount ?? transaction.transactionAmount ?? transaction.depositAmount ?? 0);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function isCredit(transaction) {
  const type = String(transaction.transactionType ?? transaction.type ?? transaction.mode ?? "").toUpperCase();
  if (type) return ["CREDIT", "CR", "DEPOSIT", "INFLOW"].includes(type);
  return Number(transaction.amount) > 0;
}

function accountBalance(account) {
  const summary = account.data?.summary ?? account.decryptedFI?.summary ?? account.summary ?? {};
  const balance = Number(summary.currentBalance ?? summary.balance ?? summary.availableBalance);
  return Number.isFinite(balance) ? balance : Number.NaN;
}

function calculateVolatility(transactions) {
  const amounts = transactions.map(transactionAmount).filter((amount) => amount > 0);
  if (amounts.length < 3) return "unknown";
  const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
  const variance = amounts.reduce((sum, amount) => sum + (amount - mean) ** 2, 0) / amounts.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  if (coefficientOfVariation < 0.35) return "low";
  if (coefficientOfVariation < 0.8) return "moderate";
  return "high";
}

function setuCashflow(session) {
  const accounts = collectAccounts(session.fips);
  const transactions = accounts.flatMap((account) => collectTransactions(account.data ?? account.decryptedFI ?? account));
  const credits = transactions.filter((transaction) => isCredit(transaction));
  const balances = accounts.map(accountBalance).filter(Number.isFinite);
  return {
    rail: "AA",
    inflow90d: credits.reduce((sum, transaction) => sum + transactionAmount(transaction), 0),
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

const aaConsents = [];
const aaSessions = [];
const aaAuditLogs = [];

function appendAaAudit(entry) {
  const item = { ...entry, createdAt: new Date().toISOString() };
  aaAuditLogs.unshift(item);
  return item;
}

function aaState(requestedBusinessId) {
  const consents = aaConsents.filter((item) => item.businessId === requestedBusinessId);
  const sessions = aaSessions.filter((item) => item.businessId === requestedBusinessId);
  return {
    businessId: requestedBusinessId,
    provider: "setu",
    credentialStatus: {
      provider: "setu",
      mode: "sites-demo",
      baseUrl: "https://fiu-sandbox.setu.co",
      missing: ["AA_ACCESS_TOKEN", "AA_PRODUCT_INSTANCE_ID"]
    },
    latestConsent: consents[0] ? publicConsent(consents[0]) : null,
    latestSession: sessions[0] ? publicSession(sessions[0]) : null,
    auditLogs: aaAuditLogs.filter((item) => item.businessId === requestedBusinessId).map(publicAuditLog),
    canProceedToSandbox: Boolean(consents[0]?.id) && Boolean(sessions[0]?.id)
  };
}

function publicConsent(consent) {
  return {
    provider: consent.provider,
    id: consent.id,
    status: consent.status,
    url: consent.url,
    redirectUrl: consent.redirectUrl,
    traceId: consent.traceId ?? null,
    detail: consent.detail
  };
}

function publicSession(session) {
  return {
    provider: session.provider,
    id: session.id,
    consentId: session.consentId ?? null,
    status: session.status,
    format: session.format ?? "json",
    dataRange: session.dataRange ?? null,
    traceId: session.traceId ?? null
  };
}

function publicAuditLog(entry) {
  return {
    rail: entry.rail,
    action: entry.action,
    consentId: entry.consentId ?? null,
    sessionId: entry.sessionId ?? null,
    status: entry.status ?? null,
    eventType: entry.eventType ?? null,
    traceId: entry.traceId ?? null,
    createdAt: entry.createdAt
  };
}

async function handleApi(request, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return json({ status: "ok", service: "sites-worker" });
  }

  if (request.method === "GET" && url.pathname === "/v1/rails/aa/setu/preflight") {
    return json({
      provider: "setu",
      mode: "sites-demo",
      baseUrl: "https://fiu-sandbox.setu.co",
      missing: ["AA_ACCESS_TOKEN", "AA_PRODUCT_INSTANCE_ID"]
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/rails/aa/consents") {
    const body = await request.json();
    const consent = setuConsent(body);
    const storedConsent = { ...consent, businessId: body.businessId ?? businessId };
    aaConsents.unshift(storedConsent);
    appendAaAudit({
      businessId: storedConsent.businessId,
      rail: "AA",
      action: "consent.created",
      consentId: consent.id,
      status: consent.status,
      traceId: consent.traceId
    });
    return json(consent);
  }

  const aaConsentMatch = url.pathname.match(/^\\/v1\\/rails\\/aa\\/consents\\/([^/]+)$/);
  if (request.method === "GET" && aaConsentMatch) {
    return json(aaConsents.find((item) => item.id === aaConsentMatch[1]) ?? setuConsent({ id: aaConsentMatch[1], status: "ACTIVE" }));
  }

  if (request.method === "GET" && url.pathname === "/v1/rails/aa/state") {
    return json(aaState(url.searchParams.get("businessId") ?? businessId));
  }

  if (request.method === "POST" && url.pathname === "/v1/rails/aa/sessions") {
    const body = await request.json();
    const session = setuDataSession(body);
    const storedSession = { ...session, businessId: body.businessId ?? businessId };
    aaSessions.unshift(storedSession);
    appendAaAudit({
      businessId: storedSession.businessId,
      rail: "AA",
      action: "session.created",
      consentId: session.consentId,
      sessionId: session.id,
      status: session.status,
      traceId: session.traceId
    });
    return json(session);
  }

  const aaSessionCashflowMatch = url.pathname.match(/^\\/v1\\/rails\\/aa\\/sessions\\/([^/]+)\\/cashflow$/);
  if (request.method === "GET" && aaSessionCashflowMatch) {
    const session = aaSessions.find((item) => item.id === aaSessionCashflowMatch[1]) ?? setuDataSession({ id: aaSessionCashflowMatch[1] });
    return json(setuCashflow(session));
  }

  const aaSessionMatch = url.pathname.match(/^\\/v1\\/rails\\/aa\\/sessions\\/([^/]+)$/);
  if (request.method === "GET" && aaSessionMatch) {
    return json(aaSessions.find((item) => item.id === aaSessionMatch[1]) ?? setuDataSession({ id: aaSessionMatch[1] }));
  }

  if (request.method === "POST" && url.pathname === "/v1/rails/aa/callback") {
    const notification = setuNotification(await request.json());
    appendAaAudit({
      businessId,
      rail: "AA",
      action: "callback.received",
      consentId: notification.consentId,
      status: notification.status,
      eventType: notification.eventType,
      traceId: notification.traceId
    });
    return json(notification);
  }

  if (request.method === "GET" && url.pathname === "/v1/businesses/" + businessId + "/snapshot") {
    return json(scenario);
  }

  if (request.method === "POST" && url.pathname === "/v1/decisions/working-capital") {
    const body = await request.json();
    return json({
      businessId: body.businessId ?? businessId,
      recommendation: {
        amount: 72000,
        reason: "Weekend stockout risk across atta and edible oil with sufficient 45-day cashflow buffer.",
        repaymentCapDays: 45,
        requiredApproval: true
      },
      selectedOffer: scenario.loanOffers[0],
      evidence: {
        cashflow: {
          rail: "AA",
          inflow90d: 480000,
          averageDailyBalance: 62000,
          volatility: "moderate",
          consent: {
            purpose: "working-capital-affordability",
            expiresInDays: 30,
            status: "purpose-bound"
          }
        },
        demand: {
          rail: "ONDC",
          demandLift: 31,
          stockoutSkus: scenario.inventory.filter((item) => item.daysLeft <= 2).map((item) => item.sku),
          window: "weekend"
        },
        compliance: {
          rail: "GSTN",
          filingStreakMonths: 9,
          openLiability: false,
          status: "clean"
        }
      },
      loanOffers: scenario.loanOffers
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/approvals") {
    const body = await request.json();
    const actionState = body.action === "reject" ? "rejected" : "approved";
    const proofsToPrepend =
      actionState === "approved"
        ? [
            proof("Owner approval proof", "Finternet", "Signed approval for Rs 72,000 restock and 45-day repayment cap", "verified"),
            proof("Purchase order created", "ONDC", "PO issued to Shakti Wholesale for fast-moving SKUs"),
            proof("UPI AutoPay mandate", "UPI", "Repayment instruction prepared for owner confirmation")
          ]
        : [proof("Owner rejection proof", "Finternet", "Owner declined credit execution; no payment instruction created", "verified")];

    const messagesToAppend =
      actionState === "approved"
        ? [
            { from: "owner", text: "Approve the working-capital plan.", meta: "Owner approval" },
            {
              from: "agent",
              text: "Approved. I created the purchase order, prepared the repayment mandate, and wrote the proof chain for audit.",
              meta: "Execution started"
            }
          ]
        : [
            { from: "owner", text: "Reject this plan for now.", meta: "Owner decision" },
            {
              from: "agent",
              text: "Rejected. I will not execute the credit workflow and will keep monitoring stockout risk.",
              meta: "Execution blocked"
            }
          ];

    return json({
      businessId: body.businessId ?? businessId,
      actionState,
      proofsToPrepend,
      messagesToAppend
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/agent/messages") {
    return json(handleMessage(await request.json()));
  }

  if (request.method === "GET" && url.pathname === "/v1/proof-chain") {
    return json({
      businessId: url.searchParams.get("businessId") ?? businessId,
      proofs: scenario.proofs
    });
  }

  return null;
}

function serveAsset(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (url.pathname === "/" || url.pathname === "/index.html" || !url.pathname.includes(".")) {
    return new Response(embeddedIndexHtml, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  const asset = embeddedAssets.find((item) => item.path === url.pathname);
  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(asset.content, {
    status: 200,
    headers: {
      "content-type": asset.contentType,
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const apiResponse = await handleApi(request, url);
    if (apiResponse) return apiResponse;
    return serveAsset(request, url);
  }
};
`.trimStart()
);

console.log("prepared Sites build artifact");
