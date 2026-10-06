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
  const rawTransactions = accounts.flatMap((account) => collectTransactions(account.data ?? account.decryptedFI ?? account));
  const from = Date.parse(session.dataRange?.from);
  const to = Date.parse(session.dataRange?.to);
  const validRange = Number.isFinite(from) && Number.isFinite(to) && to > from;
  const windowStart = validRange ? Math.max(from, to - 90 * 86400000) : null;
  const timestamp = (transaction) => Date.parse(transaction.transactionTimestamp ?? transaction.valueDate ?? transaction.transactionDate);
  const invalidDates = validRange ? rawTransactions.filter((t) => !Number.isFinite(timestamp(t)) || timestamp(t) < from || timestamp(t) > to).length : rawTransactions.length;
  const invalidAmounts = rawTransactions.filter((t) => !Number.isFinite(Number(t.amount ?? t.transactionAmount ?? t.depositAmount)) || !["CREDIT", "CR", "DEPOSIT", "INFLOW", "DEBIT", "DR", "WITHDRAWAL", "OUTFLOW"].includes(String(t.transactionType ?? t.type ?? "").toUpperCase())).length;
  // Preserve undated fixture compatibility, but mark it unsuitable for decisions.
  const transactions = rawTransactions.filter((t) => !validRange || !Number.isFinite(timestamp(t)) || (timestamp(t) >= windowStart && timestamp(t) <= to));
  const credits = transactions.filter((transaction) => isCredit(transaction));
  const inflow90d = credits.reduce((sum, transaction) => sum + transactionAmount(transaction), 0);
  const outflow90d = transactions.filter((t) => ["DEBIT", "DR", "WITHDRAWAL", "OUTFLOW"].includes(String(t.transactionType ?? t.type ?? "").toUpperCase())).reduce((sum, t) => sum + transactionAmount(t), 0);
  const balances = accounts.map(accountBalance).filter(Number.isFinite);

  return {
    rail: "AA",
    inflow90d,
    outflow90d,
    netInflow90d: Math.round((inflow90d - outflow90d) * 100) / 100,
    observedDays: validRange ? Math.min(90, Math.ceil((to - from) / 86400000)) : null,
    reportedBalance: balances.length ? Math.round(balances.reduce((sum, value) => sum + value, 0) * 100) / 100 : null,
    dataQuality: { transactionCount: transactions.length, invalidDates, invalidAmounts,
      decisionReady: session.status === "COMPLETED" && validRange && accounts.length > 0 && rawTransactions.length > 0 && invalidDates === 0 && invalidAmounts === 0 && accounts.every((a) => Boolean(a.data ?? a.decryptedFI) && (!(a.status ?? a.FIstatus) || ["READY", "DELIVERED"].includes(a.status ?? a.FIstatus))) },
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

function collectAccounts(fips) {
  return (Array.isArray(fips) ? fips : []).flatMap((fip) => {
    const accounts = fip.accounts ?? fip.data ?? [];
    return Array.isArray(accounts) ? accounts : [];
  });
}

function collectTransactions(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectTransactions);
  if (value.account) return collectTransactions(value.account);

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
  const data = account.data ?? account.decryptedFI ?? account;
  const summary = data.account?.summary ?? data.summary ?? {};
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
