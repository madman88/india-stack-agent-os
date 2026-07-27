export function normalizeRepaymentMandate(input) {
  return {
    rail: input.mandate.rail,
    type: input.mandate.mandateType,
    amount: input.mandate.amount,
    repaymentCapDays: input.mandate.repaymentCapDays,
    status: input.mandate.state
  };
}
