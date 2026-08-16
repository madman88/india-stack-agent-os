import { readRailFixture } from "../clients/rail-fixtures.mjs";
import { fetchRailJson, railAdapterMode, usesRailHttp } from "../clients/rail-client.mjs";

const fallbackDocument = {
  rail: "DigiLocker",
  documentType: "Udyam Registration",
  issuer: "Government of India",
  holder: "Ravi Stores",
  status: "verified",
  documentId: "digilocker-udyam-ravi-stores",
  issuedAt: "2026-01-10T00:00:00.000Z"
};

export async function readVerifiedDocument(documentId = "digilocker-udyam-ravi-stores") {
  if (railAdapterMode() === "fixture") {
    return normalizeVerifiedDocument(await readRailFixture("DigiLocker", "readVerifiedDocument"));
  }

  if (usesRailHttp()) {
    return fetchRailJson(`/digilocker/documents/${encodeURIComponent(documentId)}`, {
      rail: "DigiLocker",
      operation: "readVerifiedDocument"
    });
  }

  return fallbackDocument;
}

function normalizeVerifiedDocument(input) {
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
