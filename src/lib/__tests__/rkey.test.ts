import { describe, expect, test } from "bun:test";
import { deriveRkey } from "../rkey";

describe("deriveRkey", () => {
  test("returns a 64-char hex string", () => {
    const rkey = deriveRkey("at://did:plc:abc/app.bsky.feed.post/123", "bafyabc");
    expect(rkey).toMatch(/^[0-9a-f]{64}$/);
  });

  test("is deterministic", () => {
    const uri = "at://did:plc:abc/app.bsky.feed.post/123";
    const cid = "bafyabc";
    expect(deriveRkey(uri, cid)).toBe(deriveRkey(uri, cid));
  });

  test("different inputs produce different hashes", () => {
    const rkey1 = deriveRkey("at://did:plc:abc/app.bsky.feed.post/123", "bafyabc");
    const rkey2 = deriveRkey("at://did:plc:abc/app.bsky.feed.post/456", "bafyabc");
    const rkey3 = deriveRkey("at://did:plc:abc/app.bsky.feed.post/123", "bafyxyz");
    expect(rkey1).not.toBe(rkey2);
    expect(rkey1).not.toBe(rkey3);
  });

  test("hash is of uri#cid format", () => {
    const { createHash } = require("crypto");
    const uri = "at://did:plc:test/col/rkey";
    const cid = "bafycid";
    const expected = createHash("sha256").update(`${uri}#${cid}`).digest("hex");
    expect(deriveRkey(uri, cid)).toBe(expected);
  });
});
