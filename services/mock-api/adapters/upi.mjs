export function prepareRepaymentMandate({ amount, repaymentCapDays }) {
  return {
    rail: "UPI",
    type: "AutoPay",
    amount,
    repaymentCapDays,
    status: "prepared"
  };
}
