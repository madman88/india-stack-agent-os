export function normalizeBillObligations(input) {
  const bills = input.bills ?? input.obligations ?? [];
  return {
    rail: "BBPS",
    summary: input.summary ?? {
      totalOutstanding: bills.reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0),
      dueSoon: bills.filter((bill) => bill.status === "due").length,
      nextDueDate: bills[0]?.dueDate ?? null
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
