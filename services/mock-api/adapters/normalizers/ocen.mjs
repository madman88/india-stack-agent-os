export function normalizeCreditOffers(input) {
  return input.offers.map((offer) => ({
    lender: offer.providerName,
    apr: offer.annualPercentageRate,
    tenure: offer.tenureLabel,
    amount: offer.sanctionLimit,
    score: offer.rankScore,
    fee: offer.processingFee
  }));
}
