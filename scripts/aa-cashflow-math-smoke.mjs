import { normalizeSetuCashflowAttestation } from "../services/mock-api/rails/setu-aa-client.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function session(overrides = {}) {
  return {
    id: overrides.id ?? "setu-session-math",
    consentId: overrides.consentId ?? "setu-consent-math",
    status: overrides.status ?? "COMPLETED",
    traceId: overrides.traceId ?? "trace-math",
    fips: overrides.fips ?? []
  };
}

const twoAccountCashflow = normalizeSetuCashflowAttestation(
  session({
    fips: [
      {
        accounts: [
          {
            data: {
              summary: { currentBalance: "100" },
              transactions: { transaction: [{ transactionType: "CREDIT", amount: "50" }, { transactionType: "DEBIT", amount: "20" }] }
            }
          },
          {
            data: {
              summary: { currentBalance: "300" },
              transactions: { transaction: [{ transactionType: "CR", amount: "70" }, { transactionType: "INFLOW", amount: "-30" }] }
            }
          }
        ]
      }
    ]
  })
);
assert(twoAccountCashflow.inflow90d === 150, "cashflow must sum only credit-like transactions by absolute value");
assert(twoAccountCashflow.averageDailyBalance === 200, "cashflow must average balances across accounts");
assert(twoAccountCashflow.volatility === "moderate", "cashflow volatility band mismatch for mixed amounts");

const nestedTransactionsCashflow = normalizeSetuCashflowAttestation(
  session({
    fips: [
      {
        accounts: [
          {
            decryptedFI: {
              summary: { availableBalance: "500" },
              transactions: [{ type: "deposit", transactionAmount: "100" }, { type: "debit", transactionAmount: "90" }, { type: "credit", depositAmount: "100" }]
            }
          }
        ]
      }
    ]
  })
);
assert(nestedTransactionsCashflow.inflow90d === 200, "cashflow must handle alternate AA transaction fields");
assert(nestedTransactionsCashflow.averageDailyBalance === 500, "cashflow must handle alternate balance fields");
assert(nestedTransactionsCashflow.volatility === "low", "cashflow volatility should be low for stable transaction values");

const sparseCashflow = normalizeSetuCashflowAttestation(session({ fips: [{ accounts: [{ data: { transactions: { transaction: [] } } }] }] }));
assert(sparseCashflow.inflow90d === 0, "empty transactions should produce zero inflow");
assert(sparseCashflow.averageDailyBalance === 0, "missing balances should produce zero average balance");
assert(sparseCashflow.volatility === "unknown", "insufficient transactions should produce unknown volatility");

try {
  normalizeSetuCashflowAttestation(session({ status: "PENDING" }));
  throw new Error("pending session should not normalize");
} catch (error) {
  assert(error instanceof Error && error.message.includes("not ready"), "pending session error mismatch");
}

console.log("AA cashflow math smoke passed");
