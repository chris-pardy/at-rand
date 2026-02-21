import { createHmac } from "crypto";

const DRAND_API = "https://api.drand.sh";

export interface DrandRound {
  round: number;
  randomness: string;
}

export async function fetchLatestRound(): Promise<DrandRound> {
  const res = await fetch(`${DRAND_API}/public/latest`);
  if (!res.ok) {
    throw new Error(`drand API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { round: number; randomness: string };
  return { round: data.round, randomness: data.randomness };
}

/**
 * Derive a deterministic random value in [min, max] from a drand round
 * and a unique key (the rkey). Uses HMAC-SHA256 to mix the drand randomness
 * with the rkey and request index, producing a unique value per request.
 */
export function deriveValue(
  randomness: string,
  rkey: string,
  index: number,
  min: number,
  max: number
): number {
  const hmac = createHmac("sha256", randomness);
  hmac.update(`${rkey}:${index}`);
  const hash = hmac.digest();
  // Use first 4 bytes as a 32-bit unsigned integer
  const n = hash.readUInt32BE(0);
  const range = max - min + 1;
  return (n % range) + min;
}
