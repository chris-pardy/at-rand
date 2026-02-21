import type { AtpAgent } from "@atproto/api";
import { connectJetstream, type JetstreamEvent } from "../lib/jetstream";
import { deriveRkey } from "../lib/rkey";
import { getRecord, putRecord } from "../lib/pds";

const POST_COLLECTION = "app.bsky.feed.post";
const RFE_COLLECTION = "dev.chrispardy.atrand.rfe";

const ROLL_PATTERN = /\broll(?:ing)?\s+(?:the\s+dice|of\s+the\s+dice|a\s+die)\b/i;

export function matchDiceRoll(text: string): { count: number } | null {
  const match = text.match(ROLL_PATTERN);
  if (!match) return null;
  const isDie = /a\s+die/i.test(match[0]);
  return { count: isDie ? 1 : 2 };
}

export function startPostWatcher(agent: AtpAgent): { close: () => void } {
  return connectJetstream({
    wantedCollections: [POST_COLLECTION],
    onEvent: async (event: JetstreamEvent) => {
      if (event.kind !== "commit") return;
      if (!event.commit) return;
      if (event.commit.operation !== "create") return;
      if (event.commit.collection !== POST_COLLECTION) return;
      if (!event.commit.record) return;

      const post = event.commit.record as { text?: string };
      if (!post.text) return;

      const diceMatch = matchDiceRoll(post.text);
      if (!diceMatch) return;

      // Fetch the post to get its CID for the strongRef
      const postRecord = await getRecord(
        agent,
        event.did,
        POST_COLLECTION,
        event.commit.rkey
      );
      if (!postRecord) return;

      const subject = { uri: postRecord.uri, cid: postRecord.cid };
      const rkey = deriveRkey(subject.uri, subject.cid);

      // Build RFE requests (d6 for each die)
      const requests = Array.from({ length: diceMatch.count }, () => ({
        min: 1,
        max: 6,
      }));

      const rfeRecord = {
        subject,
        requests,
        createdAt: new Date().toISOString(),
      };

      try {
        await putRecord(agent, RFE_COLLECTION, rkey, rfeRecord);
      } catch (err) {
        console.error("Error creating RFE:", err);
      }
    },
    onError: (err) => {
      console.error("Post watcher error:", err);
    },
  });
}
