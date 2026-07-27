import { createHash } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8787);
const businessId = "ravi-stores";

const scenario = {
  business: {
    id: businessId,
    name: "Ravi Stores",
    city: "Bengaluru"
  },
  inventory: [
    { sku: "AASHIRVAAD-5KG", name: "Aashirvaad Atta 5kg", stock: 18, daysLeft: 2, demandLift: 34, margin: 9 },
    { sku: "AMUL-TAAZA-1L", name: "Amul Taaza 1L", stock: 42, daysLeft: 4, demandLift: 18, margin: 6 },
    { sku: "FORTUNE-OIL-1L", name: "Fortune Oil 1L", stock: 11, daysLeft: 1, demandLift: 41, margin: 12 }
  ],
  obligations: [
    { label: "Electricity bill", due: "Jul 30", amount: "Rs 8,420", rail: "BBPS" },
    { label: "Distributor payable", due: "Aug 02", amount: "Rs 52,000", rail: "UPI" },
    { label: "GST filing", due: "Aug 11", amount: "GSTR-3B", rail: "GSTN" }
  ],
  loanOffers: [
    { lender: "Pragati NBFC", apr: "16.8%", tenure: "45 days", amount: "Rs 80,000", score: 91, fee: "Rs 680" },
    { lender: "JanSetu Finance", apr: "18.2%", tenure: "60 days", amount: "Rs 1,00,000", score: 84, fee: "Rs 950" },
    { lender: "Kirana Credit Co", apr: "19.4%", tenure: "30 days", amount: "Rs 60,000", score: 78, fee: "Rs 420" }
  ],
  proofs: [
    {
      id: "pf-1028",
      time: "09:12",
      label: "Cashflow attestation",
      rail: "AA",
      hash: "a8f4c91b",
      status: "verified",
      detail: "90-day bank inflow pattern, purpose-bound consent"
    },
    {
      id: "pf-1029",
      time: "09:13",
      label: "Demand signal",
      rail: "ONDC",
      hash: "bb18e42d",
      status: "verified",
      detail: "Local grocery searches up 31% week over week"
    },
    {
      id: "pf-1030",
      time: "09:14",
      label: "GST compliance credential",
      rail: "GSTN",
      hash: "d05ac710",
      status: "verified",
      detail: "Clean filing streak, no open liability alerts"
    },
    {
      id: "pf-1031",
      time: "09:15",
      label: "OCEN offer comparison",
      rail: "OCEN",
      hash: "f7319d44",
      status: "simulated",
      detail: "Three working-capital offers normalized"
    }
  ],
  messages: [
    {
      id: 1,
      from: "agent",
      text: "I found a 2-day stockout risk in atta and edible oil. Cashflow supports a Rs 72,000 restock if repayment is capped at 45 days.",
      meta: "AA + ONDC + GSTN + OCEN"
    },
    {
      id: 2,
      from: "agent",
      text: "Recommended action: accept Pragati NBFC offer, create distributor PO, and schedule UPI AutoPay. Owner approval required before execution.",
      meta: "Pending approval"
    }
  ],
  railSummary: [
    { rail: "AA", label: "Cashflow", value: "Rs 4.8L inflow" },
    { rail: "ONDC", label: "Demand", value: "+31% grocery" },
    { rail: "GSTN", label: "Compliance", value: "Clean streak" },
    { rail: "OCEN", label: "Credit", value: "3 offers" },
    { rail: "UPI", label: "Actuation", value: "Mandate ready" },
    { rail: "Finternet", label: "Proofs", value: "4 verified" }
  ],
  verifiedAssets: [
    { label: "Udyam registration", holder: "Ravi Stores", rail: "DigiLocker", state: "Verified Asset" },
    { label: "Bank statement consent", holder: "Owner approved", rail: "AA", state: "Consent" },
    { label: "Distributor invoice", holder: "Shakti Wholesale", rail: "Finternet", state: "Obligation" },
    { label: "Repayment mandate", holder: "Pending approval", rail: "UPI", state: "Settlement" }
  ]
};

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function proof(label, rail, detail, status = "simulated") {
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
  const hash = createHash("sha256").update(`${label}:${rail}:${detail}:${time}`).digest("hex").slice(0, 8);

  return {
    id: `pf-${hash.slice(0, 4)}`,
    time,
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
      message: `Current proof chain has ${body.proofCount ?? scenario.proofs.length} events, ${body.verifiedProofCount ?? 3} verified attestations, and no failed settlement event.`,
      meta: "Proof chain"
    };
  }

  return {
    message: "I can monitor cashflow, compare credit offers, prepare approvals, and write proof events before execution.",
    meta: "Agent response"
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { status: "ok", service: "mock-api" });
  }

  if (req.method === "GET" && url.pathname === `/v1/businesses/${businessId}/snapshot`) {
    return json(res, 200, scenario);
  }

  if (req.method === "POST" && url.pathname === "/v1/decisions/working-capital") {
    const body = await readJson(req);
    return json(res, 200, {
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

  if (req.method === "POST" && url.pathname === "/v1/approvals") {
    const body = await readJson(req);
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

    return json(res, 200, {
      businessId: body.businessId ?? businessId,
      actionState,
      proofsToPrepend,
      messagesToAppend
    });
  }

  if (req.method === "POST" && url.pathname === "/v1/agent/messages") {
    const body = await readJson(req);
    return json(res, 200, handleMessage(body));
  }

  if (req.method === "GET" && url.pathname === "/v1/proof-chain") {
    return json(res, 200, {
      businessId: url.searchParams.get("businessId") ?? businessId,
      proofs: scenario.proofs
    });
  }

  return json(res, 404, { error: "not_found", path: url.pathname });
});

server.listen(port, () => {
  console.log(`mock-api listening on http://localhost:${port}`);
});
