import type { AtpAgent } from "@atproto/api";
import { deriveRkey } from "../lib/rkey";
import { getRecord, putRecord } from "../lib/pds";

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
  createdAt: string;
}

export function generateValues(requests: RangeRequest[]): number[] {
  return requests.map(({ min, max }) => {
    const range = max - min + 1;
    return Math.floor(Math.random() * range) + min;
  });
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
    return existing.value as unknown as ResponseRecord;
  }

  const values = generateValues(rfe.requests);
  const record: ResponseRecord = {
    subject: rfe.subject,
    rfe: { uri: rfeUri, cid: rfeCid },
    values,
    createdAt: new Date().toISOString(),
  };

  await putRecord(agent, RESPONSE_COLLECTION, rkey, record as unknown as Record<string, unknown>);
  return record;
}
