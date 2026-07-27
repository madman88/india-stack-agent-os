import { fetchRailJson, railBaseUrl } from "../clients/rail-client.mjs";

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
  if (railBaseUrl()) {
    return fetchRailJson("/upi/mandates", {
      rail: "UPI",
      method: "POST",
      body: { amount, repaymentCapDays }
    });
  }

  return fallbackRepaymentMandate({ amount, repaymentCapDays });
}
