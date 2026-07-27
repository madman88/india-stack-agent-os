import { normalizeRepaymentMandate } from "./normalizers/upi.mjs";
import { readRailFixture } from "../clients/rail-fixtures.mjs";
import { fetchRailJson, railAdapterMode, usesRailHttp } from "../clients/rail-client.mjs";

function fallbackRepaymentMandate({ amount, repaymentCapDays }) {
  return {
    rail: "UPI",
    type: "AutoPay",
    amount,
    repaymentCapDays,
    status: "prepared"
  };
}

export async function prepareRepaymentMandate({ amount, repaymentCapDays }) {
  if (railAdapterMode() === "fixture") {
    return normalizeRepaymentMandate(await readRailFixture("UPI", "prepareRepaymentMandate"));
  }

  if (usesRailHttp()) {
    return fetchRailJson("/upi/mandates", {
      rail: "UPI",
      operation: "prepareRepaymentMandate",
      method: "POST",
      body: { amount, repaymentCapDays }
    });
  }

  return fallbackRepaymentMandate({ amount, repaymentCapDays });
}
