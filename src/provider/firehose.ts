import type { AtpAgent } from "@atproto/api";
import { connectJetstream, type JetstreamEvent } from "../lib/jetstream";
import { createLogger } from "../lib/logger";
import { handleRfe, type RfeRecord } from "./entropy";

const log = createLogger("provider:firehose");
const RFE_COLLECTION = "dev.chrispardy.atrand.rfe";

export function startFirehose(agent: AtpAgent): { close: () => void } {
  return connectJetstream({
    wantedCollections: [RFE_COLLECTION],
    onEvent: async (event: JetstreamEvent) => {
      if (event.kind !== "commit") return;
      if (!event.commit) return;
      if (event.commit.collection !== RFE_COLLECTION) return;
      if (event.commit.operation !== "create" && event.commit.operation !== "update") return;
      if (!event.commit.record) return;

      const rfe = event.commit.record as unknown as RfeRecord;
      const rfeUri = `at://${event.did}/${RFE_COLLECTION}/${event.commit.rkey}`;
      const rfeCid = event.commit.cid!;

      log.info({ rfeUri, did: event.did, operation: event.commit.operation }, "rfe received");

      try {
        await handleRfe(agent, rfeUri, rfeCid, rfe);
      } catch (err) {
        log.error({ err, rfeUri }, "error handling rfe");
      }
    },
    onError: (err) => {
      log.error({ err }, "firehose error");
    },
  });
}
