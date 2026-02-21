import { describe, expect, test, mock, beforeEach } from "bun:test";
import { getRecord, putRecord } from "../pds";

// Mock AtpAgent
function createMockAgent(did: string = "did:plc:mock") {
  return {
    session: { did },
    com: {
      atproto: {
        repo: {
          getRecord: mock(() => Promise.resolve({
            data: {
              uri: `at://${did}/collection/rkey`,
              cid: "bafymockcid",
              value: { test: true },
            },
          })),
          putRecord: mock(() => Promise.resolve({
            data: {
              uri: `at://${did}/collection/rkey`,
              cid: "bafynewcid",
            },
          })),
        },
      },
    },
  } as any;
}

describe("getRecord", () => {
  test("returns record data on success", async () => {
    const agent = createMockAgent();
    const result = await getRecord(agent, "did:plc:mock", "collection", "rkey");
    expect(result).not.toBeNull();
    expect(result!.uri).toBe("at://did:plc:mock/collection/rkey");
    expect(result!.cid).toBe("bafymockcid");
    expect(result!.value).toEqual({ test: true });
  });

  test("returns null on 404", async () => {
    const agent = createMockAgent();
    agent.com.atproto.repo.getRecord = mock(() =>
      Promise.reject({ status: 404 })
    );
    const result = await getRecord(agent, "did:plc:mock", "collection", "rkey");
    expect(result).toBeNull();
  });

  test("returns null on 400", async () => {
    const agent = createMockAgent();
    agent.com.atproto.repo.getRecord = mock(() =>
      Promise.reject({ status: 400 })
    );
    const result = await getRecord(agent, "did:plc:mock", "collection", "rkey");
    expect(result).toBeNull();
  });

  test("throws on other errors", async () => {
    const agent = createMockAgent();
    agent.com.atproto.repo.getRecord = mock(() =>
      Promise.reject({ status: 500 })
    );
    expect(getRecord(agent, "did:plc:mock", "collection", "rkey")).rejects.toEqual({
      status: 500,
    });
  });
});

describe("putRecord", () => {
  test("creates record and returns uri/cid", async () => {
    const agent = createMockAgent();
    const result = await putRecord(agent, "collection", "rkey", { data: 1 });
    expect(result.uri).toBe("at://did:plc:mock/collection/rkey");
    expect(result.cid).toBe("bafynewcid");
    expect(agent.com.atproto.repo.putRecord).toHaveBeenCalledWith({
      repo: "did:plc:mock",
      collection: "collection",
      rkey: "rkey",
      record: { data: 1 },
    });
  });
});
