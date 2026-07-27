import { createHash } from "node:crypto";

export function makeProof(label, rail, detail, status = "simulated") {
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
  const hash = createHash("sha256").update(`${label}:${rail}:${detail}:${time}`).digest("hex").slice(0, 8);

  return {
    id: `pf-${hash.slice(0, 4)}`,
    time,
    label,
    rail,
    hash,
    status,
    detail
  };
}
