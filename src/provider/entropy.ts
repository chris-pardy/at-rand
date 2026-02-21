import type { AtpAgent } from "@atproto/api";
import { deriveRkey } from "../lib/rkey";
import { getRecord, putRecord } from "../lib/pds";
import { fetchLatestRound, deriveValue } from "../lib/drand";
import { createLogger } from "../lib/logger";

const log = createLogger("provider:entropy");
const RESPONSE_COLLECTION = "dev.chrispardy.atrand.response";

export interface RangeRequest {
  min: number;
  max: number;
}

export interface RfeRecord {
  subject: { uri: string; cid: string };
  requests: RangeRequest[];
  createdAt: string;
}

export interface ResponseRecord {
  subject: { uri: string; cid: string };
  rfe: { uri: string; cid: string };
  values: number[];
  provenance?: unknown;
  createdAt: string;
}

export function generateValues(
  requests: RangeRequest[],
  randomness: string,
  rkey: string
): number[] {
  return requests.map(({ min, max }, index) =>
    deriveValue(randomness, rkey, index, min, max)
  );
}

export async function handleRfe(
  agent: AtpAgent,
  rfeUri: string,
  rfeCid: string,
  rfe: RfeRecord
): Promise<ResponseRecord | null> {
  const rkey = deriveRkey(rfe.subject.uri, rfe.subject.cid);

  // Anti-re-roll: check if response already exists
  const existing = await getRecord(
    agent,
    agent.session!.did,
    RESPONSE_COLLECTION,
    rkey
  );
  if (existing) {
    log.info({ rkey, rfeUri }, "response already exists, skipping");
    return existing.value as unknown as ResponseRecord;
  }

  const round = await fetchLatestRound();
  const values = generateValues(rfe.requests, round.randomness, rkey);

  const record: ResponseRecord = {
    subject: rfe.subject,
    rfe: { uri: rfeUri, cid: rfeCid },
    values,
    provenance: { type: "drand", round: round.round },
    createdAt: new Date().toISOString(),
  };

  await putRecord(agent, RESPONSE_COLLECTION, rkey, record as unknown as Record<string, unknown>);
  log.info({ rkey, rfeUri, values, provenance: record.provenance }, "response created");
  return record;
}
