import { readFileSync } from "fs";
import { join } from "path";
import type { AtpAgent } from "@atproto/api";
import type { BlobRef } from "@atproto/api";
import { getRecord, putRecord } from "../lib/pds";

const ASSETS_DIR = join(import.meta.dir, "..", "..", "assets", "dice");
const BLOB_CACHE_COLLECTION = "dev.chrispardy.atrand.diceBlobs";
const BLOB_CACHE_RKEY = "self";

/**
 * Load dice blob refs from PDS cache record, or upload fresh and cache them.
 * Blobs stay alive as long as they're referenced by a record.
 */
export async function uploadDiceImages(
  agent: AtpAgent
): Promise<Map<number, BlobRef>> {
  // Try loading cached blob refs
  const cached = await getRecord(
    agent,
    agent.session!.did,
    BLOB_CACHE_COLLECTION,
    BLOB_CACHE_RKEY
  );

  if (cached) {
    const record = cached.value as { blobs?: Record<string, BlobRef> };
    if (record.blobs && Object.keys(record.blobs).length === 6) {
      const blobs = new Map<number, BlobRef>();
      for (let face = 1; face <= 6; face++) {
        blobs.set(face, record.blobs[String(face)]);
      }
      console.log("Loaded cached dice blobs");
      return blobs;
    }
  }

  // Upload fresh
  const blobs = new Map<number, BlobRef>();
  const blobRecord: Record<string, BlobRef> = {};
  for (let face = 1; face <= 6; face++) {
    const png = readFileSync(join(ASSETS_DIR, `d${face}.png`));
    const res = await agent.uploadBlob(new Blob([png], { type: "image/png" }));
    blobs.set(face, res.data.blob);
    blobRecord[String(face)] = res.data.blob;
  }

  // Cache the blob refs in a record so they persist
  await putRecord(agent, BLOB_CACHE_COLLECTION, BLOB_CACHE_RKEY, {
    blobs: blobRecord,
    createdAt: new Date().toISOString(),
  });

  return blobs;
}

export function formatDiceReply(values: number[]): string {
  return `🎲 Rolled ${values.length === 1 ? "a die" : "the dice"}`;
}

export function buildDiceEmbed(
  values: number[],
  blobs: Map<number, BlobRef>
): { $type: string; images: { image: BlobRef; alt: string; aspectRatio: { width: number; height: number } }[] } {
  return {
    $type: "app.bsky.embed.images",
    images: values.map((v) => ({
      image: blobs.get(v)!,
      alt: `Dice face showing ${v}`,
      aspectRatio: { width: 1, height: 1 },
    })),
  };
}
