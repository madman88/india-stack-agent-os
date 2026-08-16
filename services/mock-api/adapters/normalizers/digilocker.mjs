export function normalizeVerifiedDocument(input) {
  return {
    rail: "DigiLocker",
    documentType: input.documentType ?? input.name ?? "Document",
    issuer: input.issuer ?? input.issuedBy ?? "Unknown issuer",
    holder: input.holder ?? input.name ?? "Unknown holder",
    status: input.status ?? "verified",
    documentId: input.documentId ?? input.id ?? "digilocker-document",
    issuedAt: input.issuedAt ?? input.issued_on ?? new Date().toISOString()
  };
}
