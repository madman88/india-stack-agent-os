import { prepareRepaymentMandate } from "../adapters/upi.mjs";
import { makeProof } from "../lib/proofs.mjs";

export function captureApproval(body) {
  const actionState = body.action === "reject" ? "rejected" : "approved";

  if (actionState === "rejected") {
    return {
      businessId: body.businessId,
      actionState,
      proofsToPrepend: [
        makeProof("Owner rejection proof", "Finternet", "Owner declined credit execution; no payment instruction created", "verified")
      ],
      messagesToAppend: [
        { from: "owner", text: "Reject this plan for now.", meta: "Owner decision" },
        {
          from: "agent",
          text: "Rejected. I will not execute the credit workflow and will keep monitoring stockout risk.",
          meta: "Execution blocked"
        }
      ]
    };
  }

  const mandate = prepareRepaymentMandate({ amount: 72000, repaymentCapDays: 45 });

  return {
    businessId: body.businessId,
    actionState,
    proofsToPrepend: [
      makeProof("Owner approval proof", "Finternet", "Signed approval for Rs 72,000 restock and 45-day repayment cap", "verified"),
      makeProof("Purchase order created", "ONDC", "PO issued to Shakti Wholesale for fast-moving SKUs"),
      makeProof("UPI AutoPay mandate", mandate.rail, "Repayment instruction prepared for owner confirmation")
    ],
    messagesToAppend: [
      { from: "owner", text: "Approve the working-capital plan.", meta: "Owner approval" },
      {
        from: "agent",
        text: "Approved. I created the purchase order, prepared the repayment mandate, and wrote the proof chain for audit.",
        meta: "Execution started"
      }
    ]
  };
}
