import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  Building2,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  DatabaseZap,
  FileCheck2,
  Fingerprint,
  GitBranch,
  History,
  IndianRupee,
  Landmark,
  Layers3,
  MessageSquareText,
  PackageCheck,
  ReceiptIndianRupee,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  WalletCards,
  X
} from "lucide-react";
import "./styles.css";

type Rail = "AA" | "ONDC" | "GSTN" | "OCEN" | "UPI" | "DigiLocker" | "Finternet" | "BBPS";
type View = "owner" | "partner";
type ActionState = "pending" | "approved" | "rejected";

type InventoryItem = {
  sku: string;
  name: string;
  stock: number;
  daysLeft: number;
  demandLift: number;
  margin: number;
};

type Obligation = {
  label: string;
  due: string;
  amount: string;
  rail: Rail;
};

type LoanOffer = {
  lender: string;
  apr: string;
  tenure: string;
  amount: string;
  score: number;
  fee: string;
};

type RailSummaryItem = {
  rail: Rail;
  label: string;
  value: string;
};

type VerifiedAsset = {
  label: string;
  holder: string;
  rail: Rail;
  state: string;
};

type ProofEvent = {
  id: string;
  time: string;
  label: string;
  rail: Rail;
  hash: string;
  status: "verified" | "pending" | "simulated";
  detail: string;
};

type ChatMessage = {
  id: number;
  from: "agent" | "owner";
  text: string;
  meta?: string;
};

type Scenario = {
  business: {
    id: string;
    name: string;
    city: string;
  };
  inventory: InventoryItem[];
  obligations: Obligation[];
  loanOffers: LoanOffer[];
  proofs: ProofEvent[];
  messages: ChatMessage[];
  railSummary: RailSummaryItem[];
  verifiedAssets: VerifiedAsset[];
};

type AaState = {
  businessId: string;
  provider: "setu";
  credentialStatus: {
    baseUrl: string;
    missing: string[];
  };
  latestConsent: null | {
    id: string;
    status: string;
    url: string;
    detail?: { consentTypes?: string[]; [key: string]: unknown };
    traceId?: string | null;
  };
  latestSession: null | {
    id: string;
    consentId: string | null;
    status: string;
    format?: string;
    dataRange?: { from?: string; to?: string } | null;
    traceId?: string | null;
  };
  auditLogs: Array<{
    rail: string;
    action: string;
    consentId?: string | null;
    sessionId?: string | null;
    status?: string | null;
    eventType?: string | null;
    traceId?: string | null;
    createdAt: string;
  }>;
  canProceedToSandbox: boolean;
};

type AaConsentRecord = {
  recordId: string;
  businessId: string;
  customerName: string;
  customerMobile: string;
  vua: string;
  purposeCode: string;
  purposeText: string;
  dataFrom: string;
  dataTo: string;
  consentTypes: string[];
  createdAt: string;
  consentId: string | null;
  status: string;
};

type AaSessionRecord = {
  recordId: string;
  businessId: string;
  consentId: string;
  sessionId: string | null;
  createdAt: string;
  dataFrom: string;
  dataTo: string;
  status: string;
  cashflowInflow90d?: number | null;
  averageDailyBalance?: number | null;
};

type AaDraft = {
  customerName: string;
  customerMobile: string;
  vua: string;
  purposeCode: string;
  purposeText: string;
  dataFrom: string;
  dataTo: string;
  consentTypes: string;
};

const aaDraftStorageKey = "isao.aaDraft";
const aaConsentStorageKey = "isao.aaConsents";
const aaSessionStorageKey = "isao.aaSessions";
const aaSelectionStorageKey = "isao.aaSelectedConsent";

const fallbackInventory: InventoryItem[] = [
  { sku: "AASHIRVAAD-5KG", name: "Aashirvaad Atta 5kg", stock: 18, daysLeft: 2, demandLift: 34, margin: 9 },
  { sku: "AMUL-TAAZA-1L", name: "Amul Taaza 1L", stock: 42, daysLeft: 4, demandLift: 18, margin: 6 },
  { sku: "FORTUNE-OIL-1L", name: "Fortune Oil 1L", stock: 11, daysLeft: 1, demandLift: 41, margin: 12 }
];

const fallbackObligations: Obligation[] = [
  { label: "Electricity bill", due: "Jul 30", amount: "Rs 8,420", rail: "BBPS" },
  { label: "Distributor payable", due: "Aug 02", amount: "Rs 52,000", rail: "UPI" },
  { label: "GST filing", due: "Aug 11", amount: "GSTR-3B", rail: "GSTN" }
];

const fallbackLoanOffers: LoanOffer[] = [
  { lender: "Pragati NBFC", apr: "16.8%", tenure: "45 days", amount: "Rs 80,000", score: 91, fee: "Rs 680" },
  { lender: "JanSetu Finance", apr: "18.2%", tenure: "60 days", amount: "Rs 1,00,000", score: 84, fee: "Rs 950" },
  { lender: "Kirana Credit Co", apr: "19.4%", tenure: "30 days", amount: "Rs 60,000", score: 78, fee: "Rs 420" }
];

const initialProofs: ProofEvent[] = [
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
];

const fallbackRailSummary: RailSummaryItem[] = [
  { rail: "AA", label: "Cashflow", value: "Rs 4.8L inflow" },
  { rail: "ONDC", label: "Demand", value: "+31% grocery" },
  { rail: "GSTN", label: "Compliance", value: "Clean streak" },
  { rail: "OCEN", label: "Credit", value: "3 offers" },
  { rail: "UPI", label: "Actuation", value: "Mandate ready" },
  { rail: "Finternet", label: "Proofs", value: "4 verified" }
];

const railIcons: Record<Rail, typeof DatabaseZap> = {
  AA: DatabaseZap,
  ONDC: ShoppingCart,
  GSTN: FileCheck2,
  OCEN: Landmark,
  UPI: WalletCards,
  DigiLocker: Fingerprint,
  Finternet: GitBranch,
  BBPS: ReceiptIndianRupee
};

const fallbackVerifiedAssets: VerifiedAsset[] = [
  { label: "Udyam registration", holder: "Ravi Stores", rail: "DigiLocker", state: "Verified Asset" },
  { label: "Bank statement consent", holder: "Owner approved", rail: "AA", state: "Consent" },
  { label: "Distributor invoice", holder: "Shakti Wholesale", rail: "Finternet", state: "Obligation" },
  { label: "Repayment mandate", holder: "Pending approval", rail: "UPI", state: "Settlement" }
];

const initialMessages: ChatMessage[] = [
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
];

const fallbackScenario: Scenario = {
  business: {
    id: "ravi-stores",
    name: "Ravi Stores",
    city: "Bengaluru"
  },
  inventory: fallbackInventory,
  obligations: fallbackObligations,
  loanOffers: fallbackLoanOffers,
  proofs: initialProofs,
  messages: initialMessages,
  railSummary: fallbackRailSummary,
  verifiedAssets: fallbackVerifiedAssets
};

function nowTime() {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

function makeProof(label: string, rail: Rail, detail: string, status: ProofEvent["status"] = "simulated"): ProofEvent {
  const hash = Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return {
    id: `pf-${Math.floor(2000 + Math.random() * 7000)}`,
    time: nowTime(),
    label,
    rail,
    hash,
    detail,
    status
  };
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadAaDraft(): AaDraft {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 90);
  return loadJson<AaDraft>(aaDraftStorageKey, {
    customerName: "Ravi Stores",
    customerMobile: "9999999999",
    vua: "9999999999@setu",
    purposeCode: "101",
    purposeText: "working capital affordability",
    dataFrom: from.toISOString(),
    dataTo: now.toISOString(),
    consentTypes: "TRANSACTIONS,SUMMARY,PROFILE"
  });
}

function makeRecordId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

function toLocalInputValue(iso: string) {
  return new Date(iso).toISOString().slice(0, 16);
}

function toIsoValue(localValue: string) {
  return new Date(localValue).toISOString();
}

function App() {
  const [view, setView] = useState<View>("owner");
  const [actionState, setActionState] = useState<ActionState>("pending");
  const [scenario, setScenario] = useState<Scenario>(fallbackScenario);
  const [apiMode, setApiMode] = useState<"mock-api" | "fallback">("fallback");
  const [aaState, setAaState] = useState<AaState | null>(null);
  const [aaBusy, setAaBusy] = useState<"idle" | "creating-consent" | "creating-session">("idle");
  const [aaStatus, setAaStatus] = useState<string | null>(null);
  const [aaDraft, setAaDraft] = useState<AaDraft>(() => loadAaDraft());
  const [aaConsents, setAaConsents] = useState<AaConsentRecord[]>(() =>
    loadJson<AaConsentRecord[]>(aaConsentStorageKey, []).map((record) => ({
      ...record,
      recordId: record.recordId ?? makeRecordId("consent")
    }))
  );
  const [aaSessions, setAaSessions] = useState<AaSessionRecord[]>(() =>
    loadJson<AaSessionRecord[]>(aaSessionStorageKey, []).map((record) => ({
      ...record,
      recordId: record.recordId ?? makeRecordId("session")
    }))
  );
  const [aaSelectedConsentId, setAaSelectedConsentId] = useState<string>(() => localStorage.getItem(aaSelectionStorageKey) ?? "");
  const [proofs, setProofs] = useState<ProofEvent[]>(initialProofs);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;

    apiFetch("/v1/businesses/ravi-stores/snapshot")
      .then((response) => {
        if (!response.ok) throw new Error(`snapshot ${response.status}`);
        return response.json() as Promise<Scenario>;
      })
      .then((snapshot) => {
        if (cancelled) return;
        setScenario(snapshot);
        setProofs(snapshot.proofs);
        setMessages(snapshot.messages);
        setApiMode("mock-api");
      })
      .catch(() => {
        if (cancelled) return;
        setApiMode("fallback");
      });

    apiFetch("/v1/rails/aa/state?businessId=ravi-stores")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`aa state ${response.status}`)))
      .then((state) => {
        if (cancelled) return;
        setAaState(state as AaState);
      })
      .catch(() => {
        if (cancelled) return;
        setAaState(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(aaDraftStorageKey, JSON.stringify(aaDraft));
  }, [aaDraft]);

  useEffect(() => {
    localStorage.setItem(aaConsentStorageKey, JSON.stringify(aaConsents));
  }, [aaConsents]);

  useEffect(() => {
    localStorage.setItem(aaSessionStorageKey, JSON.stringify(aaSessions));
  }, [aaSessions]);

  useEffect(() => {
    localStorage.setItem(aaSelectionStorageKey, aaSelectedConsentId);
  }, [aaSelectedConsentId]);

  const riskScore = actionState === "approved" ? 82 : actionState === "rejected" ? 58 : 76;
  const verifiedCount = proofs.filter((proof) => proof.status === "verified").length;

  const recommendation = useMemo(() => {
    if (actionState === "approved") {
      return {
        label: "Approved for execution",
        detail: "Purchase order, repayment mandate, and settlement instruction are now in the proof chain.",
        tone: "good"
      };
    }

    if (actionState === "rejected") {
      return {
        label: "Owner rejected action",
        detail: "The agent will hold credit execution and only raise stockout reminders.",
        tone: "danger"
      };
    }

    return {
      label: "Approval required",
      detail: "The agent can execute after owner approval. No irreversible action has been taken.",
      tone: "warn"
    };
  }, [actionState]);

  async function submitApproval(action: "approve" | "reject") {
    try {
      const response = await apiFetch("/v1/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId: scenario.business.id, action })
      });

      if (!response.ok) throw new Error(`approval ${response.status}`);
      const result = (await response.json()) as {
        actionState: "approved" | "rejected";
        proofsToPrepend: ProofEvent[];
        messagesToAppend: Array<Omit<ChatMessage, "id">>;
      };

      setActionState(result.actionState);
      setProofs((current) => [...result.proofsToPrepend, ...current]);
      setMessages((current) => [
        ...current,
        ...result.messagesToAppend.map((message, index) => ({
          ...message,
          id: current.length + index + 1
        }))
      ]);
      setApiMode("mock-api");
      return true;
    } catch {
      setApiMode("fallback");
      return false;
    }
  }

  async function approveAction() {
    if (actionState === "approved") return;
    const usedApi = await submitApproval("approve");
    if (usedApi) return;

    setActionState("approved");
    setProofs((current) => [
      makeProof("Owner approval proof", "Finternet", "Signed approval for Rs 72,000 restock and 45-day repayment cap", "verified"),
      makeProof("Purchase order created", "ONDC", "PO issued to Shakti Wholesale for fast-moving SKUs"),
      makeProof("UPI AutoPay mandate", "UPI", "Repayment instruction prepared for owner confirmation"),
      ...current
    ]);
    setMessages((current) => [
      ...current,
      {
        id: current.length + 1,
        from: "owner",
        text: "Approve the working-capital plan.",
        meta: "Owner approval"
      },
      {
        id: current.length + 2,
        from: "agent",
        text: "Approved. I created the purchase order, prepared the repayment mandate, and wrote the proof chain for audit.",
        meta: "Execution started"
      }
    ]);
  }

  async function rejectAction() {
    if (actionState === "rejected") return;
    const usedApi = await submitApproval("reject");
    if (usedApi) return;

    setActionState("rejected");
    setProofs((current) => [
      makeProof("Owner rejection proof", "Finternet", "Owner declined credit execution; no payment instruction created", "verified"),
      ...current
    ]);
    setMessages((current) => [
      ...current,
      {
        id: current.length + 1,
        from: "owner",
        text: "Reject this plan for now.",
        meta: "Owner decision"
      },
      {
        id: current.length + 2,
        from: "agent",
        text: "Rejected. I will not execute the credit workflow and will keep monitoring stockout risk.",
        meta: "Execution blocked"
      }
    ]);
  }

  function resetScenario() {
    setActionState("pending");
    setProofs(scenario.proofs);
    setMessages(scenario.messages);
  }

  async function refreshAaState() {
    const response = await apiFetch("/v1/rails/aa/state?businessId=ravi-stores");
    if (!response.ok) throw new Error(`aa state ${response.status}`);
    setAaState((await response.json()) as AaState);
  }

  async function createAaConsent() {
    setAaBusy("creating-consent");
    setAaStatus(null);
    try {
      const response = await apiFetch("/v1/rails/aa/consents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: scenario.business.id,
          customerMobile: aaDraft.customerMobile,
          customerName: aaDraft.customerName,
          vua: aaDraft.vua,
          purposeCode: aaDraft.purposeCode,
          purposeText: aaDraft.purposeText,
          dataRange: {
            from: aaDraft.dataFrom,
            to: aaDraft.dataTo
          },
          consentTypes: aaDraft.consentTypes.split(",").map((item) => item.trim()).filter(Boolean)
        })
      });

      if (!response.ok) throw new Error(`aa consent ${response.status}`);
      const consent = (await response.json()) as AaState["latestConsent"];
      const consentRecord: AaConsentRecord = {
        recordId: makeRecordId("consent"),
        businessId: scenario.business.id,
        customerName: aaDraft.customerName,
        customerMobile: aaDraft.customerMobile,
        vua: aaDraft.vua,
        purposeCode: aaDraft.purposeCode,
        purposeText: aaDraft.purposeText,
        dataFrom: aaDraft.dataFrom,
        dataTo: aaDraft.dataTo,
        consentTypes: aaDraft.consentTypes.split(",").map((item) => item.trim()).filter(Boolean),
        createdAt: new Date().toISOString(),
        consentId: consent?.id ?? null,
        status: consent?.status ?? "PENDING"
      };
      setAaState((current) =>
        current
          ? {
              ...current,
              latestConsent: consent,
              canProceedToSandbox: Boolean(consent?.id) && Boolean(current.latestSession?.id)
            }
          : current
      );
      setAaConsents((current) => [consentRecord, ...current].slice(0, 20));
      setAaSelectedConsentId(consentRecord.recordId);
      setApiMode("mock-api");
      setAaStatus(`Consent created: ${consent?.id ?? "unknown"}`);
      await refreshAaState();
    } catch {
      setApiMode("fallback");
      setAaStatus("Consent creation failed. Check the demo API output or refresh the page.");
    } finally {
      setAaBusy("idle");
    }
  }

  async function createAaSession() {
    const selectedRecord = aaConsents.find((record) => record.recordId === aaSelectedConsentId);
    const consentId = selectedRecord?.consentId ?? aaState?.latestConsent?.id;
    if (!consentId) return;
    setAaBusy("creating-session");
    setAaStatus(null);
    try {
      const response = await apiFetch("/v1/rails/aa/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: scenario.business.id,
          consentId,
          dataRange: {
            from: aaDraft.dataFrom,
            to: aaDraft.dataTo
          },
          format: "json"
        })
      });

      if (!response.ok) throw new Error(`aa session ${response.status}`);
      const session = (await response.json()) as AaState["latestSession"];
      let cashflowInflow90d: number | null = null;
      let averageDailyBalance: number | null = null;
      try {
        const cashflowResponse = await apiFetch(`/v1/rails/aa/sessions/${session?.id}/cashflow`);
        if (cashflowResponse.ok) {
          const cashflow = (await cashflowResponse.json()) as { inflow90d?: number; averageDailyBalance?: number };
          cashflowInflow90d = Number.isFinite(cashflow.inflow90d ?? NaN) ? Number(cashflow.inflow90d) : null;
          averageDailyBalance = Number.isFinite(cashflow.averageDailyBalance ?? NaN) ? Number(cashflow.averageDailyBalance) : null;
        }
      } catch {
        // keep the session record even if cashflow enrichment fails
      }
      const sessionRecord: AaSessionRecord = {
        recordId: makeRecordId("session"),
        businessId: scenario.business.id,
        consentId,
        sessionId: session?.id ?? null,
        createdAt: new Date().toISOString(),
        dataFrom: aaDraft.dataFrom,
        dataTo: aaDraft.dataTo,
        status: session?.status ?? "COMPLETED",
        cashflowInflow90d,
        averageDailyBalance
      };
      setAaState((current) =>
        current
          ? {
              ...current,
              latestSession: session,
              canProceedToSandbox: Boolean(current.latestConsent?.id) && Boolean(session?.id)
            }
          : current
      );
      setAaSessions((current) => [sessionRecord, ...current].slice(0, 20));
      setApiMode("mock-api");
      setAaStatus(`Session created: ${session?.id ?? "unknown"}${cashflowInflow90d ? ` · inflow Rs ${cashflowInflow90d.toLocaleString("en-IN")}` : ""}`);
      await refreshAaState();
    } catch {
      setApiMode("fallback");
      setAaStatus("Session creation failed. Check the demo API output or refresh the page.");
    } finally {
      setAaBusy("idle");
    }
  }

  function fallbackAgentAnswer(text: string) {
    const lower = text.toLowerCase();
    if (lower.includes("why")) {
      return "Because expected gross margin is Rs 10,900, repayment cost is Rs 1,310, and the stockout risk affects three high-velocity SKUs.";
    }
    if (lower.includes("risk")) {
      return "Main risk is slower-than-expected sell-through. I capped the loan at 45 days and avoided the higher APR offers.";
    }
    if (lower.includes("proof")) {
      return `Current proof chain has ${proofs.length} events, ${verifiedCount} verified attestations, and no failed settlement event.`;
    }
    return "I can monitor cashflow, compare credit offers, prepare approvals, and write proof events before execution.";
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    let answer = fallbackAgentAnswer(text);
    let meta = "Agent response";

    try {
      const response = await apiFetch("/v1/agent/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: scenario.business.id,
          message: text,
          proofCount: proofs.length,
          verifiedProofCount: verifiedCount
        })
      });

      if (response.ok) {
        const result = (await response.json()) as { message: string; meta?: string };
        answer = result.message;
        meta = result.meta ?? meta;
        setApiMode("mock-api");
      }
    } catch {
      setApiMode("fallback");
    }

    setMessages((current) => [
      ...current,
      { id: current.length + 1, from: "owner", text },
      { id: current.length + 2, from: "agent", text: answer, meta }
    ]);
    setDraft("");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-icon">
            <Layers3 size={22} aria-hidden="true" />
          </div>
          <div>
            <div className="brand-title">India Stack Agent OS</div>
            <div className="brand-subtitle">{scenario.business.name}, {scenario.business.city}</div>
          </div>
        </div>

        <div className="nav-section" aria-label="Primary view">
          <button className={view === "owner" ? "nav-item active" : "nav-item"} onClick={() => setView("owner")}>
            <Store size={18} aria-hidden="true" />
            Owner
          </button>
          <button className={view === "partner" ? "nav-item active" : "nav-item"} onClick={() => setView("partner")}>
            <Building2 size={18} aria-hidden="true" />
            Partner
          </button>
        </div>

        <div className="rail-grid">
          {scenario.railSummary.map((item) => {
            const Icon = railIcons[item.rail];
            return (
              <div className="rail-tile" key={item.rail}>
                <Icon size={17} aria-hidden="true" />
                <div>
                  <span>{item.rail}</span>
                  <strong>{item.value}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow">MSME working-capital loop</div>
            <h1>{view === "owner" ? "Operator Console" : "Partner Risk Console"}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={resetScenario} aria-label="Reset scenario" title="Reset scenario">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
            <div className="api-pill">{apiMode}</div>
            <div className={`status-pill ${recommendation.tone}`}>{recommendation.label}</div>
          </div>
        </header>

        {view === "owner" ? (
          <OwnerConsole
            actionState={actionState}
            recommendation={recommendation}
            messages={messages}
            draft={draft}
            setDraft={setDraft}
            sendMessage={sendMessage}
            approveAction={approveAction}
            rejectAction={rejectAction}
            aaState={aaState}
            aaBusy={aaBusy}
            createAaConsent={createAaConsent}
            createAaSession={createAaSession}
            refreshAaState={refreshAaState}
            aaStatus={aaStatus}
            aaDraft={aaDraft}
            setAaDraft={setAaDraft}
            aaConsents={aaConsents}
            aaSessions={aaSessions}
            aaSelectedConsentId={aaSelectedConsentId}
            setAaSelectedConsentId={setAaSelectedConsentId}
            inventory={scenario.inventory}
            obligations={scenario.obligations}
            verifiedAssets={scenario.verifiedAssets}
          />
        ) : (
          <PartnerConsole
            riskScore={riskScore}
            actionState={actionState}
            proofs={proofs}
            loanOffers={scenario.loanOffers}
            aaState={aaState}
            aaConsents={aaConsents}
            aaSessions={aaSessions}
            aaSelectedConsentId={aaSelectedConsentId}
            setAaSelectedConsentId={setAaSelectedConsentId}
            onRefreshAa={refreshAaState}
          />
        )}
      </section>

      <ProofChain proofs={proofs} actionState={actionState} />
    </main>
  );
}

function OwnerConsole({
  actionState,
  recommendation,
  messages,
  draft,
  setDraft,
  sendMessage,
  approveAction,
  rejectAction,
  aaState,
  aaBusy,
  createAaConsent,
  createAaSession,
  refreshAaState,
  aaStatus,
  aaDraft,
  setAaDraft,
  aaConsents,
  aaSessions,
  aaSelectedConsentId,
  setAaSelectedConsentId,
  inventory,
  obligations,
  verifiedAssets
}: {
  actionState: ActionState;
  recommendation: { label: string; detail: string; tone: string };
  messages: ChatMessage[];
  draft: string;
  setDraft: (value: string) => void;
  sendMessage: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  approveAction: () => void | Promise<void>;
  rejectAction: () => void | Promise<void>;
  aaState: AaState | null;
  aaBusy: "idle" | "creating-consent" | "creating-session";
  createAaConsent: () => void | Promise<void>;
  createAaSession: () => void | Promise<void>;
  refreshAaState: () => void | Promise<void>;
  aaStatus: string | null;
  aaDraft: AaDraft;
  setAaDraft: React.Dispatch<React.SetStateAction<AaDraft>>;
  aaConsents: AaConsentRecord[];
  aaSessions: AaSessionRecord[];
  aaSelectedConsentId: string;
  setAaSelectedConsentId: React.Dispatch<React.SetStateAction<string>>;
  inventory: InventoryItem[];
  obligations: Obligation[];
  verifiedAssets: VerifiedAsset[];
}) {
  return (
    <div className="owner-grid">
      <section className="decision-panel">
        <div className="panel-header">
          <div>
            <span className="section-label">Agent recommendation</span>
            <h2>Restock before weekend demand</h2>
          </div>
          <div className="confidence">
            <Sparkles size={18} aria-hidden="true" />
            91 confidence
          </div>
        </div>

        <div className="decision-flow" aria-label="Decision flow">
          <FlowStep icon={ShoppingCart} rail="ONDC" title="Demand spike" detail="Grocery searches and orders up 31% locally." />
          <FlowStep icon={DatabaseZap} rail="AA" title="Affordability" detail="45-day repayment fits cashflow buffer." />
          <FlowStep icon={Landmark} rail="OCEN" title="Credit match" detail="Pragati NBFC is cheapest risk-adjusted offer." />
          <FlowStep icon={ShieldCheck} rail="Finternet" title="Proof chain" detail="Approval, PO, and mandate become auditable events." />
        </div>

        <div className={`recommendation-strip ${recommendation.tone}`}>
          <AlertTriangle size={19} aria-hidden="true" />
          <div>
            <strong>{recommendation.label}</strong>
            <span>{recommendation.detail}</span>
          </div>
        </div>

        <div className="action-grid">
          <div className="amount-block">
            <span>Recommended restock</span>
            <strong>Rs 72,000</strong>
          </div>
          <div className="amount-block">
            <span>Expected gross margin</span>
            <strong>Rs 10,900</strong>
          </div>
          <div className="amount-block">
            <span>Repayment cap</span>
            <strong>45 days</strong>
          </div>
        </div>

        <div className="button-row">
          <button className="primary-button" onClick={approveAction} disabled={actionState === "approved"}>
            <Check size={18} aria-hidden="true" />
            Approve
          </button>
          <button className="secondary-button" onClick={rejectAction} disabled={actionState === "rejected"}>
            <X size={18} aria-hidden="true" />
            Reject
          </button>
        </div>
      </section>

      <section className="chat-panel">
        <div className="panel-header compact">
          <div>
            <span className="section-label">Owner conversation</span>
            <h2>Approval loop</h2>
          </div>
          <MessageSquareText size={20} aria-hidden="true" />
        </div>
        <div className="message-list">
          {messages.map((message) => (
            <div className={message.from === "agent" ? "message agent" : "message owner"} key={message.id}>
              <p>{message.text}</p>
              {message.meta && <span>{message.meta}</span>}
            </div>
          ))}
        </div>
        <form className="chat-form" onSubmit={sendMessage}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask why, risk, or proof..."
            aria-label="Message the agent"
          />
          <button className="icon-button solid" type="submit" aria-label="Send message" title="Send">
            <Send size={17} aria-hidden="true" />
          </button>
        </form>
      </section>

      <section className="aa-panel">
        <div className="panel-header compact">
          <div>
            <span className="section-label">AA sandbox workspace</span>
            <h2>Editable consent and session prep</h2>
          </div>
          <DatabaseZap size={20} aria-hidden="true" />
        </div>

        <div className="aa-summary">
          <div className="aa-chip">
            <span>Provider</span>
            <strong>{aaState?.provider ?? "setu"}</strong>
          </div>
          <div className="aa-chip">
            <span>Sandbox base URL</span>
            <strong>{aaState?.credentialStatus.baseUrl ?? "https://fiu-sandbox.setu.co"}</strong>
          </div>
          <div className="aa-chip">
            <span>Missing creds</span>
            <strong>{aaState?.credentialStatus.missing.length ? aaState.credentialStatus.missing.join(", ") : "none for mock"}</strong>
          </div>
          <div className="aa-chip">
            <span>Ready for session</span>
            <strong>{aaSelectedConsentId || aaState?.latestConsent?.id ? "yes" : "not yet"}</strong>
          </div>
        </div>

        <div className="aa-form-grid">
          <label className="aa-field">
            <span>Customer name</span>
            <input value={aaDraft.customerName} onChange={(event) => setAaDraft((current) => ({ ...current, customerName: event.target.value }))} />
          </label>
          <label className="aa-field">
            <span>Mobile</span>
            <input value={aaDraft.customerMobile} onChange={(event) => setAaDraft((current) => ({ ...current, customerMobile: event.target.value }))} />
          </label>
          <label className="aa-field">
            <span>VUA</span>
            <input value={aaDraft.vua} onChange={(event) => setAaDraft((current) => ({ ...current, vua: event.target.value }))} />
          </label>
          <label className="aa-field">
            <span>Purpose code</span>
            <input value={aaDraft.purposeCode} onChange={(event) => setAaDraft((current) => ({ ...current, purposeCode: event.target.value }))} />
          </label>
          <label className="aa-field aa-span-2">
            <span>Purpose text</span>
            <input value={aaDraft.purposeText} onChange={(event) => setAaDraft((current) => ({ ...current, purposeText: event.target.value }))} />
          </label>
          <label className="aa-field">
            <span>From</span>
            <input type="datetime-local" value={toLocalInputValue(aaDraft.dataFrom)} onChange={(event) => setAaDraft((current) => ({ ...current, dataFrom: toIsoValue(event.target.value) }))} />
          </label>
          <label className="aa-field">
            <span>To</span>
            <input type="datetime-local" value={toLocalInputValue(aaDraft.dataTo)} onChange={(event) => setAaDraft((current) => ({ ...current, dataTo: toIsoValue(event.target.value) }))} />
          </label>
          <label className="aa-field aa-span-2">
            <span>Consent types, comma separated</span>
            <input value={aaDraft.consentTypes} onChange={(event) => setAaDraft((current) => ({ ...current, consentTypes: event.target.value }))} />
          </label>
        </div>

        <div className="aa-actions">
          <button className="primary-button" onClick={createAaConsent} disabled={aaBusy !== "idle"}>
            <Check size={18} aria-hidden="true" />
            Create consent
          </button>
          <button className="secondary-button" onClick={createAaSession} disabled={aaBusy !== "idle" || !(aaSelectedConsentId || aaState?.latestConsent?.id)}>
            <ArrowRight size={18} aria-hidden="true" />
            Create session
          </button>
          <button className="icon-button" onClick={refreshAaState} aria-label="Refresh AA state" title="Refresh AA state">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </div>

        {aaStatus && <div className="aa-banner">{aaStatus}</div>}

        <div className="aa-status-grid">
          <div className="aa-status-card">
            <span>Latest consent</span>
            <strong>{aaState?.latestConsent?.id ?? "none yet"}</strong>
            <small>{aaState?.latestConsent?.status ?? "pending local setup"}</small>
          </div>
          <div className="aa-status-card">
            <span>Latest session</span>
            <strong>{aaState?.latestSession?.id ?? "none yet"}</strong>
            <small>{aaState?.latestSession?.status ?? "waiting for consent"}</small>
          </div>
          <div className="aa-status-card">
            <span>Audit trail</span>
            <strong>{aaState?.auditLogs.length ?? 0} entries</strong>
            <small>callback and consent events</small>
          </div>
        </div>

        <div className="aa-lists">
          <section className="aa-list-card">
            <div className="panel-header compact">
              <div>
                <span className="section-label">Consent history</span>
                <h2>Local draft records</h2>
              </div>
              <History size={18} aria-hidden="true" />
            </div>
            <div className="aa-list">
              {aaConsents.length ? aaConsents.map((record) => (
                <button
                  key={`${record.createdAt}-${record.consentId ?? record.customerName}`}
                  className={record.consentId === aaSelectedConsentId ? "aa-list-row selected" : "aa-list-row"}
                  onClick={() => record.consentId && setAaSelectedConsentId(record.consentId)}
                >
                  <div>
                    <strong>{record.customerName}</strong>
                    <span>{record.vua} · {record.purposeText}</span>
                  </div>
                  <div>
                    <strong>{record.consentId ?? "pending"}</strong>
                    <span>{record.status}</span>
                  </div>
                </button>
              )) : <div className="aa-list-empty">No consent records yet.</div>}
            </div>
          </section>

          <section className="aa-list-card">
            <div className="panel-header compact">
              <div>
                <span className="section-label">Session history</span>
                <h2>Created sessions</h2>
              </div>
              <CircleDollarSign size={18} aria-hidden="true" />
            </div>
            <div className="aa-list">
              {aaSessions.length ? aaSessions.map((record) => (
                <div className="aa-list-row" key={`${record.createdAt}-${record.sessionId ?? record.consentId}`}>
                  <div>
                    <strong>{record.sessionId ?? "pending"}</strong>
                    <span>{record.consentId} · {record.dataFrom.slice(0, 10)} → {record.dataTo.slice(0, 10)}</span>
                  </div>
                  <div>
                    <strong>{record.status}</strong>
                    <span>{record.cashflowInflow90d ? `Rs ${record.cashflowInflow90d.toLocaleString("en-IN")}` : "cashflow pending"}</span>
                  </div>
                </div>
              )) : <div className="aa-list-empty">No sessions yet.</div>}
            </div>
          </section>
        </div>

        <div className="aa-log">
          {(aaState?.auditLogs ?? []).slice(0, 3).map((entry, index) => (
            <div className="aa-log-row" key={`${entry.action}-${index}`}>
              <div>
                <strong>{entry.action}</strong>
                <span>{entry.consentId ?? entry.sessionId ?? entry.eventType ?? "AA event"}</span>
              </div>
              <span>{new Date(entry.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
            </div>
          ))}
          {!aaState?.auditLogs?.length && <div className="aa-log-empty">No AA events yet. Create a consent to start the trace.</div>}
        </div>
      </section>

      <BusinessMemory inventory={inventory} obligations={obligations} verifiedAssets={verifiedAssets} />
    </div>
  );
}

function BusinessMemory({
  inventory,
  obligations,
  verifiedAssets
}: {
  inventory: InventoryItem[];
  obligations: Obligation[];
  verifiedAssets: VerifiedAsset[];
}) {
  return (
    <section className="memory-band">
      <div className="panel-header compact">
        <div>
          <span className="section-label">Business memory</span>
          <h2>Assets, stock, obligations</h2>
        </div>
        <Fingerprint size={20} aria-hidden="true" />
      </div>

      <div className="memory-grid">
        <div className="memory-column">
          <div className="mini-title">
            <Boxes size={17} aria-hidden="true" />
            Inventory
          </div>
          {inventory.map((item) => (
            <div className="inventory-row" key={item.sku}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.stock} units - {item.daysLeft} days left</span>
              </div>
              <div className="metric-chip">+{item.demandLift}%</div>
            </div>
          ))}
        </div>

        <div className="memory-column">
          <div className="mini-title">
            <ReceiptIndianRupee size={17} aria-hidden="true" />
            Obligations
          </div>
          {obligations.map((item) => (
            <div className="inventory-row" key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.due} - {item.rail}</span>
              </div>
              <div className="metric-chip neutral">{item.amount}</div>
            </div>
          ))}
        </div>

        <div className="memory-column">
          <div className="mini-title">
            <PackageCheck size={17} aria-hidden="true" />
            Verified objects
          </div>
          {verifiedAssets.map((item) => (
            <div className="asset-row" key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.holder}</span>
              </div>
              <span>{item.state}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PartnerConsole({
  riskScore,
  actionState,
  proofs,
  loanOffers,
  aaState,
  aaConsents,
  aaSessions,
  aaSelectedConsentId,
  setAaSelectedConsentId,
  onRefreshAa
}: {
  riskScore: number;
  actionState: ActionState;
  proofs: ProofEvent[];
  loanOffers: LoanOffer[];
  aaState: AaState | null;
  aaConsents: AaConsentRecord[];
  aaSessions: AaSessionRecord[];
  aaSelectedConsentId: string;
  setAaSelectedConsentId: React.Dispatch<React.SetStateAction<string>>;
  onRefreshAa: () => void | Promise<void>;
}) {
  const [offerFilter, setOfferFilter] = useState<"all" | "best" | "budget">("all");
  const [partnerVerdict, setPartnerVerdict] = useState<"review" | "lend" | "hold" | "reject">("review");
  const [partnerNote, setPartnerNote] = useState("Review AA consent and session evidence before deciding.");
  const [focusRail, setFocusRail] = useState<"AA" | "GSTN" | "ONDC" | "OCEN" | "UPI" | "Finternet" | "BBPS">("AA");

  const selectedConsent = aaConsents.find((record) => record.recordId === aaSelectedConsentId) ?? aaConsents[0] ?? null;
  const selectedSession = aaSessions.find((record) => record.consentId === selectedConsent?.consentId) ?? aaSessions[0] ?? null;
  const cashflowBand = selectedSession?.cashflowInflow90d
    ? selectedSession.cashflowInflow90d > 400000
      ? "Strong"
      : selectedSession.cashflowInflow90d > 200000
        ? "Moderate"
        : "Tight"
    : "Unavailable";
  const selectedOffer = useMemo(() => {
    if (!loanOffers.length) return null;
    if (offerFilter === "best") return [...loanOffers].sort((a, b) => b.score - a.score)[0] ?? null;
    if (offerFilter === "budget") return [...loanOffers].sort((a, b) => Number.parseFloat(a.apr) - Number.parseFloat(b.apr))[0] ?? null;
    return loanOffers[0] ?? null;
  }, [loanOffers, offerFilter]);
  const showOffers = useMemo(() => {
    if (offerFilter === "best") {
      return [...loanOffers].sort((a, b) => b.score - a.score).slice(0, 2);
    }
    if (offerFilter === "budget") {
      return [...loanOffers].sort((a, b) => Number.parseFloat(a.apr) - Number.parseFloat(b.apr)).slice(0, 2);
    }
    return loanOffers;
  }, [loanOffers, offerFilter]);
  const selectedEvidenceCount = (selectedConsent ? 1 : 0) + (selectedSession ? 1 : 0) + proofs.length;

  return (
    <div className="partner-grid">
      <section className="partner-main">
        <div className="panel-header">
          <div>
            <span className="section-label">Lender view</span>
            <h2>Underwriting, monitoring, and evidence review</h2>
          </div>
          <div className="score-dial" aria-label={`Risk score ${riskScore}`}>
            <span>{riskScore}</span>
            <small>risk fit</small>
          </div>
        </div>

        <div className="partner-metrics">
          <Metric icon={IndianRupee} label="Eligible credit" value="Rs 80,000" />
          <Metric icon={Banknote} label="Estimated cost" value="Rs 1,310" />
          <Metric icon={ClipboardCheck} label="Verified proofs" value={`${proofs.length}`} />
          <Metric icon={History} label="Human override" value={actionState === "pending" ? "Required" : "Captured"} />
        </div>

        <div className="partner-aa-summary">
          <div className="partner-aa-card">
            <span>Selected consent</span>
            <strong>{selectedConsent?.consentId ?? aaState?.latestConsent?.id ?? "none"}</strong>
            <small>{selectedConsent?.customerName ?? aaState?.latestConsent?.detail?.purposeCode ?? "ready for sandbox"}</small>
          </div>
          <div className="partner-aa-card">
            <span>Selected session</span>
            <strong>{selectedSession?.sessionId ?? aaState?.latestSession?.id ?? "none"}</strong>
            <small>{selectedSession?.status ?? aaState?.latestSession?.status ?? "waiting"}</small>
          </div>
          <div className="partner-aa-card">
            <span>Cashflow band</span>
            <strong>{cashflowBand}</strong>
            <small>{selectedSession?.cashflowInflow90d ? `Rs ${selectedSession.cashflowInflow90d.toLocaleString("en-IN")}` : "from AA session"}</small>
          </div>
          <div className="partner-aa-card">
            <span>AA readiness</span>
            <strong>{aaState?.canProceedToSandbox ? "Sandbox ready" : "Mock only"}</strong>
            <small>{aaState?.credentialStatus.missing?.length ? `Missing: ${aaState.credentialStatus.missing.join(", ")}` : "Use real creds later"}</small>
          </div>
        </div>

        <div className="partner-selection-panel">
          <div className="partner-selection-card">
            <span>Selected consent</span>
            <strong>{selectedConsent?.customerName ?? "No consent selected"}</strong>
            <p>{selectedConsent ? `${selectedConsent.consentId} · ${selectedConsent.purposeText}` : "Click a consent row to inspect it here."}</p>
          </div>
          <div className="partner-selection-card">
            <span>Selected session</span>
            <strong>{selectedSession?.sessionId ?? "No session selected"}</strong>
            <p>{selectedSession ? `${selectedSession.consentId} · ${selectedSession.status}` : "The matching session will appear here."}</p>
          </div>
        </div>

        <div className="partner-toolbar">
          <button type="button" className="secondary-button" onClick={onRefreshAa}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh AA
          </button>
          <button type="button" className="secondary-button" onClick={() => setAaSelectedConsentId(aaConsents[0]?.recordId ?? "")} disabled={!aaConsents.length}>
            <History size={16} aria-hidden="true" />
            Use latest consent
          </button>
          <button type="button" className={focusRail === "AA" ? "secondary-button active" : "secondary-button"} onClick={() => setFocusRail("AA")}>
            AA focus
          </button>
          <button type="button" className={focusRail === "GSTN" ? "secondary-button active" : "secondary-button"} onClick={() => setFocusRail("GSTN")}>
            GSTN focus
          </button>
        </div>

        <div className="partner-aa-lists">
          <section className="partner-list-card">
            <div className="panel-header compact">
              <div>
                <span className="section-label">Consent feed</span>
                <h2>Available owner consents</h2>
              </div>
              <DatabaseZap size={18} aria-hidden="true" />
            </div>
            <div className="partner-list">
              {aaConsents.length ? aaConsents.map((record) => (
                <div
                  key={record.recordId}
                  className={record.recordId === aaSelectedConsentId ? "partner-list-row selected" : "partner-list-row"}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setAaSelectedConsentId(record.recordId);
                    setPartnerVerdict("review");
                    setPartnerNote(`Reviewing consent ${record.consentId} for ${record.customerName}.`);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setAaSelectedConsentId(record.recordId);
                    setPartnerVerdict("review");
                    setPartnerNote(`Reviewing consent ${record.consentId} for ${record.customerName}.`);
                  }}
                >
                  <div>
                    <strong>{record.customerName}</strong>
                    <span>{record.purposeText}</span>
                  </div>
                  <div>
                    <strong>{record.status}</strong>
                    <span>{record.consentId ?? "pending"}</span>
                    <span className="chip">Select</span>
                  </div>
                </div>
              )) : <div className="partner-list-empty">No owner consents yet.</div>}
            </div>
          </section>

          <section className="partner-list-card">
            <div className="panel-header compact">
              <div>
                <span className="section-label">Session feed</span>
                <h2>AA session evidence</h2>
              </div>
              <CircleDollarSign size={18} aria-hidden="true" />
            </div>
            <div className="partner-list">
              {aaSessions.length ? aaSessions.map((record) => (
                <div className="partner-list-row" key={`${record.createdAt}-${record.sessionId ?? record.consentId}`}>
                  <div>
                    <strong>{record.sessionId ?? "pending"}</strong>
                    <span>{record.consentId} · {record.dataFrom.slice(0, 10)} → {record.dataTo.slice(0, 10)}</span>
                  </div>
                  <div>
                    <strong>{record.status}</strong>
                    <span>{record.cashflowInflow90d ? `Rs ${record.cashflowInflow90d.toLocaleString("en-IN")}` : "cashflow pending"}</span>
                  </div>
                </div>
              )) : <div className="partner-list-empty">No AA sessions yet.</div>}
            </div>
          </section>
        </div>

        <div className="offers-table">
          <div className="table-head">
            <span>Lender</span>
            <span>APR</span>
            <span>Tenure</span>
            <span>Fit</span>
          </div>
          <div className="partner-offer-toolbar">
            <button type="button" className={offerFilter === "all" ? "chip active" : "chip"} onClick={() => setOfferFilter("all")}>All</button>
            <button type="button" className={offerFilter === "best" ? "chip active" : "chip"} onClick={() => setOfferFilter("best")}>Best fit</button>
            <button type="button" className={offerFilter === "budget" ? "chip active" : "chip"} onClick={() => setOfferFilter("budget")}>Budget</button>
          </div>
          {showOffers.map((offer, index) => (
            <div className={index === 0 ? "offer-row selected" : "offer-row"} key={offer.lender}>
              <span>{offer.lender}</span>
              <span>{offer.apr}</span>
              <span>{offer.tenure}</span>
              <strong>{offer.score}</strong>
            </div>
          ))}
        </div>

        <div className="partner-verdict-panel">
          <div className="partner-verdict-actions">
            <button
              type="button"
              className={partnerVerdict === "lend" ? "primary-button selected" : "secondary-button"}
              disabled={!selectedConsent}
              onClick={() => { setPartnerVerdict("lend"); setPartnerNote(`Proceed with ${selectedOffer?.lender ?? "the top lender"} after owner confirmation.`); }}
            >
              Recommend lend
            </button>
            <button
              type="button"
              className={partnerVerdict === "hold" ? "secondary-button active" : "secondary-button"}
              disabled={!selectedConsent}
              onClick={() => { setPartnerVerdict("hold"); setPartnerNote("Keep in review until AA and approval evidence are complete."); }}
            >
              Hold
            </button>
            <button
              type="button"
              className={partnerVerdict === "reject" ? "secondary-button active" : "secondary-button"}
              disabled={!selectedConsent}
              onClick={() => { setPartnerVerdict("reject"); setPartnerNote("Reject if evidence weakens or session / consent is missing."); }}
            >
              Reject
            </button>
          </div>
          <div className="partner-verdict-copy">
            <span>Partner verdict</span>
            <strong>{partnerVerdict.toUpperCase()}</strong>
            <p>{selectedConsent ? partnerNote : "Select a consent first to activate partner actions."}</p>
          </div>
        </div>

        <div className="partner-insights">
          <div className="partner-insight">
            <span>Decision posture</span>
            <strong>{actionState === "approved" ? "Ready to lend" : actionState === "rejected" ? "Do not proceed" : "Await owner approval"}</strong>
            <p>{actionState === "approved" ? "All core proof events are in place." : "Partner can review evidence now and wait for owner action."}</p>
          </div>
          <div className="partner-insight">
            <span>AA confidence</span>
            <strong>{aaState?.latestConsent?.id ? "Consent on record" : "No consent yet"}</strong>
            <p>{selectedConsent?.purposeText ?? "Sandbox-ready AA evidence appears here."}</p>
          </div>
          <div className="partner-insight">
            <span>Evidence count</span>
            <strong>{selectedEvidenceCount}</strong>
            <p>Use this to compare how complete the dossier is before you lend.</p>
          </div>
          <div className="partner-insight">
            <span>Focus rail</span>
            <strong>{focusRail}</strong>
            <p>{focusRail === "AA" ? "Cashflow and consent review" : focusRail === "GSTN" ? "Compliance and filing view" : "Alternative rail review"}</p>
          </div>
        </div>
      </section>

      <section className="intervention-panel">
        <div className="panel-header compact">
          <div>
            <span className="section-label">Exception handling</span>
            <h2>Partner controls</h2>
          </div>
          <ShieldCheck size={20} aria-hidden="true" />
        </div>
        <div className="control-list">
          <ControlItem label="Owner approval" status={actionState === "pending" ? "Open" : "Closed"} />
          <ControlItem label="Repayment cap" status="Rs 80,000 max" />
          <ControlItem label="Data consent" status="Purpose-bound" />
          <ControlItem label="Settlement finality" status={actionState === "approved" ? "Prepared" : "Blocked"} />
          <ControlItem label="AA status" status={aaState?.latestSession?.status ?? "Waiting"} />
          <ControlItem label="Evidence set" status={`${proofs.length} proofs`} />
          <ControlItem label="Latest consent" status={aaState?.latestConsent?.status ?? "None"} />
          <ControlItem label="Risk band" status={riskScore >= 80 ? "Strong" : riskScore >= 70 ? "Moderate" : "Tight"} />
          <ControlItem label="Partner verdict" status={partnerVerdict.toUpperCase()} />
          <ControlItem label="Selected lender" status={selectedOffer?.lender ?? "None"} />
        </div>
      </section>
    </div>
  );
}

function ProofChain({ proofs, actionState }: { proofs: ProofEvent[]; actionState: ActionState }) {
  return (
    <aside className="proof-panel">
      <div className="proof-header">
        <div>
          <span className="section-label">Finternet layer</span>
          <h2>Proof Chain</h2>
        </div>
        <div className={`proof-state ${actionState}`}>{actionState}</div>
      </div>

      <div className="proof-list">
        {proofs.map((proof, index) => (
          <article className="proof-event" key={`${proof.id}-${index}`}>
            <div className="proof-line">
              <span className="proof-dot" />
              {index < proofs.length - 1 && <span className="proof-connector" />}
            </div>
            <div className="proof-content">
              <div className="proof-title">
                <strong>{proof.label}</strong>
                <span>{proof.time}</span>
              </div>
              <p>{proof.detail}</p>
              <div className="proof-meta">
                <span>{proof.rail}</span>
                <span>#{proof.hash}</span>
                <span>{proof.status}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function FlowStep({
  icon: Icon,
  rail,
  title,
  detail
}: {
  icon: typeof ShoppingCart;
  rail: Rail;
  title: string;
  detail: string;
}) {
  return (
    <div className="flow-step">
      <div className="flow-icon">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div>
        <span>{rail}</span>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <ArrowRight size={16} aria-hidden="true" className="flow-arrow" />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof IndianRupee; label: string; value: string }) {
  return (
    <div className="metric-card">
      <Icon size={19} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ControlItem({ label, status }: { label: string; status: string }) {
  return (
    <div className="control-item">
      <span>{label}</span>
      <strong>{status}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

function apiFetch(path: string, init?: RequestInit) {
  const apiOrigin = (import.meta as unknown as { env?: { VITE_API_ORIGIN?: string } }).env?.VITE_API_ORIGIN ?? "http://localhost:8787";
  const proxyUrl = path.startsWith("/v1") ? path : `/v1${path}`;
  return fetch(proxyUrl, init).catch(async () => fetch(new URL(proxyUrl, apiOrigin), init));
}
