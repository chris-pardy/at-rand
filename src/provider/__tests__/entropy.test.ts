import { describe, expect, test, mock } from "bun:test";
import { generateValues, handleRfe, type RfeRecord } from "../entropy";

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
  test("generates values within ranges", () => {
    const requests = [
      { min: 1, max: 6 },
      { min: 1, max: 6 },
      { min: 0, max: 100 },
    ];
    for (let i = 0; i < 100; i++) {
      const values = generateValues(requests);
      expect(values.length).toBe(3);
      expect(values[0]).toBeGreaterThanOrEqual(1);
      expect(values[0]).toBeLessThanOrEqual(6);
      expect(values[1]).toBeGreaterThanOrEqual(1);
      expect(values[1]).toBeLessThanOrEqual(6);
      expect(values[2]).toBeGreaterThanOrEqual(0);
      expect(values[2]).toBeLessThanOrEqual(100);
    }
  });

  test("handles single value range", () => {
    const values = generateValues([{ min: 5, max: 5 }]);
    expect(values).toEqual([5]);
  });

  test("returns one value per request", () => {
    const requests = Array.from({ length: 10 }, () => ({ min: 1, max: 6 }));
    const values = generateValues(requests);
    expect(values.length).toBe(10);
  });
});

describe("handleRfe", () => {
  const rfe: RfeRecord = {
    subject: {
      uri: "at://did:plc:user/app.bsky.feed.post/abc",
      cid: "bafysubject",
    },
    requests: [{ min: 1, max: 6 }, { min: 1, max: 6 }],
    createdAt: new Date().toISOString(),
  };

  test("generates response when none exists", async () => {
    const agent = createMockAgent(null);
    const result = await handleRfe(agent, "at://did:plc:user/dev.chrispardy.atrand.rfe/abc", "bafyrfe", rfe);
    expect(result).not.toBeNull();
    expect(result!.values.length).toBe(2);
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
        createdAt: new Date().toISOString(),
      },
    };
    const agent = createMockAgent(existing);
    const result = await handleRfe(agent, "at://did:plc:user/dev.chrispardy.atrand.rfe/abc", "bafyrfe", rfe);
    expect(result).toEqual(existing.value);
    expect(agent.com.atproto.repo.putRecord).not.toHaveBeenCalled();
  });
});
