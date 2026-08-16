import { readRailFixture } from "../clients/rail-fixtures.mjs";
import { fetchRailJson, railAdapterMode, usesRailHttp } from "../clients/rail-client.mjs";
import { scenario } from "../lib/fixtures.mjs";

const fallbackBills = {
  rail: "BBPS",
  summary: {
    totalOutstanding: 8420,
    dueSoon: 1,
    nextDueDate: "2026-08-19"
  },
  bills: [
    {
      biller: "BESCOM",
      label: "Electricity bill",
      amount: 8420,
      dueDate: "2026-08-19",
      status: "due"
    }
  ]
};

export async function readBillObligations() {
  if (railAdapterMode() === "fixture") {
    return normalizeBillObligations(await readRailFixture("BBPS", "readBillObligations"));
  }

  if (usesRailHttp()) {
    return fetchRailJson("/bbps/bills", {
      rail: "BBPS",
      operation: "readBillObligations"
    });
  }

  return fallbackBills;
}

function normalizeBillObligations(input) {
  const bills = input.bills ?? input.obligations ?? [];
  return {
    rail: "BBPS",
    summary: input.summary ?? {
      totalOutstanding: bills.reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0),
      dueSoon: bills.filter((bill) => bill.status === "due").length,
      nextDueDate: bills[0]?.dueDate ?? scenario.obligations[0]?.due ?? null
    },
    bills: bills.map((bill) => ({
      biller: bill.biller ?? bill.name ?? "Biller",
      label: bill.label ?? bill.name ?? "Bill",
      amount: Number(bill.amount ?? bill.outstanding ?? 0),
      dueDate: bill.dueDate ?? bill.due ?? null,
      status: bill.status ?? "due"
    }))
  };
}
