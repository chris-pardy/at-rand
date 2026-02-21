import { createHash } from "crypto";

/**
 * Derive a deterministic rkey from a subject URI and CID.
 * Returns the SHA-256 hex hash of `${uri}#${cid}`.
 */
export function deriveRkey(uri: string, cid: string): string {
  return createHash("sha256").update(`${uri}#${cid}`).digest("hex");
}
