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

async function handleApi(request, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return json({ status: "ok", service: "sites-worker" });
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
