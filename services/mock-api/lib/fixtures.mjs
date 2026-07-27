export const businessId = "ravi-stores";

export const scenario = {
  business: {
    id: businessId,
    name: "Ravi Stores",
    city: "Bengaluru"
  },
  inventory: [
    { sku: "AASHIRVAAD-5KG", name: "Aashirvaad Atta 5kg", stock: 18, daysLeft: 2, demandLift: 34, margin: 9 },
    { sku: "AMUL-TAAZA-1L", name: "Amul Taaza 1L", stock: 42, daysLeft: 4, demandLift: 18, margin: 6 },
    { sku: "FORTUNE-OIL-1L", name: "Fortune Oil 1L", stock: 11, daysLeft: 1, demandLift: 41, margin: 12 }
  ],
  obligations: [
    { label: "Electricity bill", due: "Jul 30", amount: "Rs 8,420", rail: "BBPS" },
    { label: "Distributor payable", due: "Aug 02", amount: "Rs 52,000", rail: "UPI" },
    { label: "GST filing", due: "Aug 11", amount: "GSTR-3B", rail: "GSTN" }
  ],
  loanOffers: [
    { lender: "Pragati NBFC", apr: "16.8%", tenure: "45 days", amount: "Rs 80,000", score: 91, fee: "Rs 680" },
    { lender: "JanSetu Finance", apr: "18.2%", tenure: "60 days", amount: "Rs 1,00,000", score: 84, fee: "Rs 950" },
    { lender: "Kirana Credit Co", apr: "19.4%", tenure: "30 days", amount: "Rs 60,000", score: 78, fee: "Rs 420" }
  ],
  proofs: [
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
  ],
  messages: [
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
  ],
  railSummary: [
    { rail: "AA", label: "Cashflow", value: "Rs 4.8L inflow" },
    { rail: "ONDC", label: "Demand", value: "+31% grocery" },
    { rail: "GSTN", label: "Compliance", value: "Clean streak" },
    { rail: "OCEN", label: "Credit", value: "3 offers" },
    { rail: "UPI", label: "Actuation", value: "Mandate ready" },
    { rail: "Finternet", label: "Proofs", value: "4 verified" }
  ],
  verifiedAssets: [
    { label: "Udyam registration", holder: "Ravi Stores", rail: "DigiLocker", state: "Verified Asset" },
    { label: "Bank statement consent", holder: "Owner approved", rail: "AA", state: "Consent" },
    { label: "Distributor invoice", holder: "Shakti Wholesale", rail: "Finternet", state: "Obligation" },
    { label: "Repayment mandate", holder: "Pending approval", rail: "UPI", state: "Settlement" }
  ]
};
