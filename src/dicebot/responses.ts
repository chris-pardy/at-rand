import type { AtpAgent, BlobRef } from "@atproto/api";
import { connectJetstream, type JetstreamEvent } from "../lib/jetstream";
import { formatDiceReply, buildDiceEmbed } from "./dice";

const RESPONSE_COLLECTION = "dev.chrispardy.atrand.response";
const POST_COLLECTION = "app.bsky.feed.post";

interface ResponseRecord {
  subject: { uri: string; cid: string };
  rfe: { uri: string; cid: string };
  values: number[];
}

export function startResponseWatcher(
  agent: AtpAgent,
  providerDid: string,
  botDid: string,
  diceBlobs: Map<number, BlobRef>
): { close: () => void } {
  return connectJetstream({
    wantedCollections: [RESPONSE_COLLECTION],
    wantedDids: [providerDid],
    onEvent: async (event: JetstreamEvent) => {
      if (event.kind !== "commit") return;
      if (!event.commit) return;
      if (event.commit.operation !== "create") return;
      if (event.commit.collection !== RESPONSE_COLLECTION) return;
      if (!event.commit.record) return;

      const response = event.commit.record as unknown as ResponseRecord;

      // Check if this response is for one of our RFEs
      if (!response.rfe?.uri?.includes(botDid)) return;

      const replyText = formatDiceReply(response.values);
      const embed = buildDiceEmbed(response.values, diceBlobs);

      const subjectUri = response.subject.uri;
      const subjectCid = response.subject.cid;

      try {
        await agent.com.atproto.repo.createRecord({
          repo: agent.session!.did,
          collection: POST_COLLECTION,
          record: {
            $type: POST_COLLECTION,
            text: replyText,
            embed,
            reply: {
              root: { uri: subjectUri, cid: subjectCid },
              parent: { uri: subjectUri, cid: subjectCid },
            },
            createdAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error("Error posting dice reply:", err);
      }
    },
    onError: (err) => {
      console.error("Response watcher error:", err);
    },
  });
}
