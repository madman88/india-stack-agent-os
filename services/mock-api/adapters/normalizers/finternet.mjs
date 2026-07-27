export function normalizeProofEvent(input) {
  return {
    id: input.proof.id,
    time: input.proof.time,
    label: input.proof.label,
    rail: input.proof.rail,
    hash: input.proof.hash,
    status: input.proof.status,
    detail: input.proof.detail
  };
}
