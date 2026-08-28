import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./main";

const snapshot = {
  business: { id: "ravi-stores", name: "Ravi Stores", city: "Bengaluru" },
  inventory: [{ sku: "AASHIRVAAD-5KG", name: "Aashirvaad Atta 5kg", stock: 18, daysLeft: 2, demandLift: 34, margin: 9 }],
  obligations: [{ label: "Electricity bill", due: "Jul 30", amount: "Rs 8,420", rail: "BBPS" }],
  loanOffers: [
    { lender: "Pragati NBFC", apr: "16.8%", tenure: "45 days", amount: "Rs 80,000", score: 91, fee: "Rs 680" },
    { lender: "JanSetu Finance", apr: "18.2%", tenure: "60 days", amount: "Rs 1,00,000", score: 84, fee: "Rs 950" }
  ],
  proofs: [
    { id: "pf-1028", time: "09:12", label: "Cashflow attestation", rail: "AA", hash: "a8f4c91b", status: "verified", detail: "90-day inflow" }
  ],
  messages: [{ id: 1, from: "agent", text: "I found a 2-day stockout risk.", meta: "AA + ONDC" }],
  railSummary: [{ rail: "AA", label: "Cashflow", value: "Rs 4.8L inflow" }],
  verifiedAssets: [{ label: "Bank statement consent", holder: "Owner approved", rail: "AA", state: "Consent" }]
};

const emptyAaState = {
  businessId: "ravi-stores",
  provider: "setu",
  credentialStatus: { baseUrl: "https://fiu-sandbox.setu.co", missing: [] },
  latestConsent: null,
  latestSession: null,
  auditLogs: [],
  canProceedToSandbox: false
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function pathOf(input: RequestInfo | URL) {
  const value = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return value.startsWith("http") ? new URL(value).pathname : value.split("?")[0];
}

describe("App AA workflow", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates an AA consent with the editable draft payload", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input);
      if (init?.body) requests.push({ path, body: JSON.parse(String(init.body)) });
      if (path === "/v1/businesses/ravi-stores/snapshot") return jsonResponse(snapshot);
      if (path === "/v1/rails/aa/state") return jsonResponse(emptyAaState);
      if (path === "/v1/rails/aa/consents") {
        return jsonResponse({
          provider: "setu",
          id: "setu-consent-created-001",
          status: "PENDING",
          url: "https://fiu-sandbox.setu.co/v2/consents/webview/setu-consent-created-001",
          redirectUrl: "https://fiu-sandbox.setu.co/v2/consents/webview/setu-consent-created-001",
          traceId: "trace-created",
          detail: { consentTypes: ["TRANSACTIONS", "SUMMARY", "PROFILE"] }
        });
      }
      return jsonResponse({ error: "not_found" }, 404);
    }));

    render(<App />);
    await screen.findByText("Editable consent and session prep");

    await userEvent.clear(screen.getByLabelText("Customer name"));
    await userEvent.type(screen.getByLabelText("Customer name"), "Meera Stores");
    await userEvent.click(screen.getByRole("button", { name: /create consent/i }));

    await screen.findByText("Consent created: setu-consent-created-001");
    expect(requests).toContainEqual({
      path: "/v1/rails/aa/consents",
      body: expect.objectContaining({
        businessId: "ravi-stores",
        customerName: "Meera Stores",
        customerMobile: "9999999999",
        vua: "9999999999@setu",
        purposeCode: "101",
        purposeText: "working capital affordability",
        consentTypes: ["TRANSACTIONS", "SUMMARY", "PROFILE"]
      })
    });
    expect(screen.getByText("setu-consent-created-001")).toBeInTheDocument();
  });

  it("uses the clicked owner consent record when creating a data session", async () => {
    localStorage.setItem("isao.aaSelectedConsent", "new-record");
    localStorage.setItem(
      "isao.aaConsents",
      JSON.stringify([
        {
          recordId: "new-record",
          businessId: "ravi-stores",
          customerName: "New Stores",
          customerMobile: "9999999999",
          vua: "9999999999@setu",
          purposeCode: "101",
          purposeText: "working capital affordability",
          dataFrom: "2026-01-01T00:00:00.000Z",
          dataTo: "2026-03-31T23:59:59.999Z",
          consentTypes: ["TRANSACTIONS"],
          createdAt: "2026-04-01T00:00:00.000Z",
          consentId: "setu-consent-new",
          status: "PENDING"
        },
        {
          recordId: "old-record",
          businessId: "ravi-stores",
          customerName: "Old Stores",
          customerMobile: "8888888888",
          vua: "8888888888@setu",
          purposeCode: "101",
          purposeText: "working capital affordability",
          dataFrom: "2026-01-01T00:00:00.000Z",
          dataTo: "2026-03-31T23:59:59.999Z",
          consentTypes: ["TRANSACTIONS"],
          createdAt: "2026-03-01T00:00:00.000Z",
          consentId: "setu-consent-old",
          status: "ACTIVE"
        }
      ])
    );

    const sessionBodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input);
      if (path === "/v1/businesses/ravi-stores/snapshot") return jsonResponse(snapshot);
      if (path === "/v1/rails/aa/state") {
        return jsonResponse({
          ...emptyAaState,
          latestConsent: { id: "setu-consent-new", status: "PENDING", url: "https://example.test/new" }
        });
      }
      if (path === "/v1/rails/aa/sessions") {
        const body = JSON.parse(String(init?.body));
        sessionBodies.push(body);
        return jsonResponse({ provider: "setu", id: "setu-session-old", consentId: body.consentId, status: "COMPLETED", format: "json" });
      }
      if (path === "/v1/rails/aa/sessions/setu-session-old/cashflow") {
        return jsonResponse({ rail: "AA", inflow90d: 480000, averageDailyBalance: 62000 });
      }
      return jsonResponse({ error: "not_found" }, 404);
    }));

    render(<App />);
    await screen.findByText("Old Stores");

    await userEvent.click(screen.getByRole("button", { name: /old stores/i }));
    await userEvent.click(screen.getByRole("button", { name: /create session/i }));

    await waitFor(() => expect(sessionBodies).toHaveLength(1));
    expect(sessionBodies[0]).toEqual(expect.objectContaining({ consentId: "setu-consent-old" }));
    expect(screen.getByText("Session created: setu-session-old · inflow Rs 4,80,000")).toBeInTheDocument();
  });

  it("lets the partner review selected AA evidence and record a lend verdict", async () => {
    localStorage.setItem("isao.aaSelectedConsent", "selected-record");
    localStorage.setItem(
      "isao.aaConsents",
      JSON.stringify([
        {
          recordId: "selected-record",
          businessId: "ravi-stores",
          customerName: "Partner Review Stores",
          customerMobile: "9999999999",
          vua: "9999999999@setu",
          purposeCode: "101",
          purposeText: "working capital affordability",
          dataFrom: "2026-01-01T00:00:00.000Z",
          dataTo: "2026-03-31T23:59:59.999Z",
          consentTypes: ["TRANSACTIONS"],
          createdAt: "2026-04-01T00:00:00.000Z",
          consentId: "setu-consent-review",
          status: "ACTIVE"
        }
      ])
    );
    localStorage.setItem(
      "isao.aaSessions",
      JSON.stringify([
        {
          recordId: "session-record",
          businessId: "ravi-stores",
          consentId: "setu-consent-review",
          sessionId: "setu-session-review",
          createdAt: "2026-04-01T00:10:00.000Z",
          dataFrom: "2026-01-01T00:00:00.000Z",
          dataTo: "2026-03-31T23:59:59.999Z",
          status: "COMPLETED",
          cashflowInflow90d: 480000,
          averageDailyBalance: 62000
        }
      ])
    );

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (path === "/v1/businesses/ravi-stores/snapshot") return jsonResponse(snapshot);
      if (path === "/v1/rails/aa/state") {
        return jsonResponse({
          ...emptyAaState,
          latestConsent: { id: "setu-consent-review", status: "ACTIVE", url: "https://example.test/review" },
          latestSession: { id: "setu-session-review", consentId: "setu-consent-review", status: "COMPLETED", format: "json" },
          canProceedToSandbox: true
        });
      }
      return jsonResponse({ error: "not_found" }, 404);
    }));

    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Partner" }));

    expect(screen.getAllByText("Partner Review Stores").length).toBeGreaterThan(0);
    expect(screen.getAllByText("setu-session-review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Strong").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /recommend lend/i }));
    expect(screen.getAllByText("LEND").length).toBeGreaterThan(0);
    expect(screen.getByText(/Proceed with Pragati NBFC/)).toBeInTheDocument();
  });
});
