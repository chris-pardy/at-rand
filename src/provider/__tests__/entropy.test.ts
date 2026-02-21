import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { generateValues, handleRfe, type RfeRecord } from "../entropy";

// Mock drand fetch
const MOCK_DRAND = {
  round: 12345,
  randomness: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
};

const originalFetch = globalThis.fetch;

function createMockAgent(existingResponse: any = null) {
  const did = "did:plc:provider";
  return {
    session: { did },
    com: {
      atproto: {
        repo: {
          getRecord: mock(async () => {
            if (existingResponse) {
              return { data: existingResponse };
            }
            throw { status: 404 };
          }),
          putRecord: mock(async () => ({
            data: { uri: `at://${did}/dev.chrispardy.atrand.response/abc`, cid: "bafynew" },
          })),
        },
      },
    },
  } as any;
}

describe("generateValues", () => {
  const randomness = MOCK_DRAND.randomness;

  test("generates values within ranges", () => {
    const requests = [
      { min: 1, max: 6 },
      { min: 1, max: 6 },
      { min: 0, max: 100 },
    ];
    const values = generateValues(requests, randomness, "test-rkey");
    expect(values.length).toBe(3);
    expect(values[0]).toBeGreaterThanOrEqual(1);
    expect(values[0]).toBeLessThanOrEqual(6);
    expect(values[1]).toBeGreaterThanOrEqual(1);
    expect(values[1]).toBeLessThanOrEqual(6);
    expect(values[2]).toBeGreaterThanOrEqual(0);
    expect(values[2]).toBeLessThanOrEqual(100);
  });

  test("is deterministic", () => {
    const requests = [{ min: 1, max: 6 }, { min: 1, max: 6 }];
    const a = generateValues(requests, randomness, "rkey-abc");
    const b = generateValues(requests, randomness, "rkey-abc");
    expect(a).toEqual(b);
  });

  test("handles single value range", () => {
    const values = generateValues([{ min: 5, max: 5 }], randomness, "rkey");
    expect(values).toEqual([5]);
  });

  test("returns one value per request", () => {
    const requests = Array.from({ length: 10 }, () => ({ min: 1, max: 6 }));
    const values = generateValues(requests, randomness, "rkey");
    expect(values.length).toBe(10);
  });
});

describe("handleRfe", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(MOCK_DRAND), { status: 200 })
    ) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const rfe: RfeRecord = {
    subject: {
      uri: "at://did:plc:user/app.bsky.feed.post/abc",
      cid: "bafysubject",
    },
    requests: [{ min: 1, max: 6 }, { min: 1, max: 6 }],
    createdAt: new Date().toISOString(),
  };

  test("generates response with drand provenance when none exists", async () => {
    const agent = createMockAgent(null);
    const result = await handleRfe(agent, "at://did:plc:user/dev.chrispardy.atrand.rfe/abc", "bafyrfe", rfe);
    expect(result).not.toBeNull();
    expect(result!.values.length).toBe(2);
    expect(result!.provenance).toEqual({ type: "drand", round: MOCK_DRAND.round });
    expect(result!.subject).toEqual(rfe.subject);
    expect(result!.rfe.uri).toBe("at://did:plc:user/dev.chrispardy.atrand.rfe/abc");
    expect(agent.com.atproto.repo.putRecord).toHaveBeenCalled();
  });

  test("returns existing response without generating new one (anti-re-roll)", async () => {
    const existing = {
      uri: "at://did:plc:provider/dev.chrispardy.atrand.response/xyz",
      cid: "bafyexisting",
      value: {
        subject: rfe.subject,
        rfe: { uri: "at://did:plc:user/dev.chrispardy.atrand.rfe/abc", cid: "bafyrfe" },
        values: [3, 5],
        provenance: { type: "drand", round: 99999 },
        createdAt: new Date().toISOString(),
      },
    };
    const agent = createMockAgent(existing);
    const result = await handleRfe(agent, "at://did:plc:user/dev.chrispardy.atrand.rfe/abc", "bafyrfe", rfe);
    expect(result).toEqual(existing.value);
    expect(agent.com.atproto.repo.putRecord).not.toHaveBeenCalled();
    // Should NOT have called drand since response existed
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
