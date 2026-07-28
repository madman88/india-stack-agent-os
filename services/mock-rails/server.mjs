import { createServer } from "node:http";
import { scenario } from "../mock-api/lib/fixtures.mjs";
import { makeProof } from "../mock-api/lib/proofs.mjs";

const port = Number(process.env.PORT ?? 8790);

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

function demandSignals() {
  return {
    rail: "ONDC",
    demandLift: 31,
    stockoutSkus: scenario.inventory.filter((item) => item.daysLeft <= 2).map((item) => item.sku),
    window: "weekend"
  };
}

function setuConsent(body) {
  const id = body.id ?? "setu-consent-ravi-001";
  return {
    id,
    url: `https://fiu-sandbox.setu.co/v2/consents/webview/${id}`,
    status: body.status ?? "PENDING",
    detail: {
      consentStart: new Date().toISOString(),
      fiTypes: ["DEPOSIT"],
      fetchType: "PERIODIC",
      purpose: {
        refUri: "https://api.rebit.org.in/aa/purpose/101.xml",
        code: "101",
        text: "Loan underwriting"
      },
      vua: body.vua ?? "9999999999@setu",
      dataRange: body.dataRange,
      consentTypes: ["TRANSACTIONS", "PROFILE", "SUMMARY"],
      consentMode: "STORE"
    },
    redirectUrl: "https://india-stack-agent-os.madhusudan-prahlad.chatgpt.site",
    context: body.context ?? [],
    tags: body.additionalParams?.tags ?? [],
    traceId: "trace-setu-mock-001"
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      return json(res, 204, {});
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { status: "ok", service: "mock-rails" });
    }

    if (req.method === "GET" && url.pathname === "/aa/cashflow") {
      return json(res, 200, {
        rail: "AA",
        inflow90d: 480000,
        averageDailyBalance: 62000,
        volatility: "moderate",
        consent: {
          purpose: "working-capital-affordability",
          expiresInDays: 30,
          status: "purpose-bound"
        }
      });
    }

    if (req.method === "POST" && url.pathname === "/v2/consents") {
      return json(res, 200, setuConsent(await readJson(req)));
    }

    const consentMatch = url.pathname.match(/^\/v2\/consents\/([^/]+)$/);
    if (req.method === "GET" && consentMatch) {
      return json(res, 200, setuConsent({ id: consentMatch[1], status: "ACTIVE" }));
    }

    if (req.method === "GET" && url.pathname === "/gstn/compliance") {
      return json(res, 200, {
        rail: "GSTN",
        filingStreakMonths: 9,
        openLiability: false,
        status: "clean"
      });
    }

    if (req.method === "GET" && url.pathname === "/ondc/demand") {
      return json(res, 200, demandSignals());
    }

    if (req.method === "GET" && url.pathname === "/ocen/offers") {
      return json(res, 200, { rail: "OCEN", offers: scenario.loanOffers });
    }

    if (req.method === "POST" && url.pathname === "/upi/mandates") {
      const body = await readJson(req);
      return json(res, 200, {
        rail: "UPI",
        type: "AutoPay",
        amount: body.amount,
        repaymentCapDays: body.repaymentCapDays,
        status: "prepared"
      });
    }

    if (req.method === "POST" && url.pathname === "/finternet/proofs") {
      const body = await readJson(req);
      return json(res, 200, makeProof(body.label, "Finternet", body.detail, body.status ?? "simulated"));
    }

    return json(res, 404, { error: "not_found", path: url.pathname });
  } catch (error) {
    return json(res, 500, {
      error: "internal_error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

server.listen(port, () => {
  console.log(`mock-rails listening on http://localhost:${port}`);
});
