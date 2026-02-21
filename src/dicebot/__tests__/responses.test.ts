import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import type { JetstreamEvent } from "../../lib/jetstream";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  listeners: Record<string, Function[]> = {};

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  addEventListener(event: string, handler: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }
  close() {}
  emit(event: string, data: any) {
    for (const handler of this.listeners[event] || []) {
      handler(data);
    }
  }
  sendMessage(event: JetstreamEvent) {
    this.emit("message", { data: JSON.stringify(event) });
  }
}

function mockDiceBlobs() {
  const blobs = new Map<number, any>();
  for (let i = 1; i <= 6; i++) {
    blobs.set(i, { ref: `blob-${i}` });
  }
  return blobs;
}

describe("startResponseWatcher", () => {
  let originalWebSocket: any;

  beforeEach(() => {
    MockWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  test("filters by provider DID", async () => {
    const { startResponseWatcher } = await import("../responses");
    const agent = createMockAgent();
    const conn = startResponseWatcher(agent, "did:plc:provider", "did:plc:bot", mockDiceBlobs());

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain("wantedDids=did%3Aplc%3Aprovider");
    conn.close();
  });

  test("posts reply with image embed for matching response", async () => {
    const { startResponseWatcher } = await import("../responses");
    const createRecordMock = mock(async () => ({
      data: { uri: "at://did:plc:bot/app.bsky.feed.post/reply1", cid: "bafyreply" },
    }));
    const agent = createMockAgent(createRecordMock);
    const conn = startResponseWatcher(agent, "did:plc:provider", "did:plc:bot", mockDiceBlobs());

    const ws = MockWebSocket.instances[0];
    ws.sendMessage({
      did: "did:plc:provider",
      time_us: 1000,
      kind: "commit",
      commit: {
        rev: "rev1",
        operation: "create",
        collection: "dev.chrispardy.atrand.response",
        rkey: "rkey1",
        cid: "bafyrespcid",
        record: {
          subject: {
            uri: "at://did:plc:user/app.bsky.feed.post/post1",
            cid: "bafypostcid",
          },
          rfe: {
            uri: "at://did:plc:bot/dev.chrispardy.atrand.rfe/rfe1",
            cid: "bafyrfecid",
          },
          values: [3, 5],
          createdAt: new Date().toISOString(),
        },
      },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(createRecordMock).toHaveBeenCalled();
    const callArgs = createRecordMock.mock.calls[0][0] as any;
    expect(callArgs.collection).toBe("app.bsky.feed.post");
    expect(callArgs.record.embed.$type).toBe("app.bsky.embed.images");
    expect(callArgs.record.embed.images.length).toBe(2);
    conn.close();
  });

  test("ignores responses for other bots", async () => {
    const { startResponseWatcher } = await import("../responses");
    const createRecordMock = mock(async () => ({
      data: { uri: "at://did:plc:bot/app.bsky.feed.post/reply1", cid: "bafyreply" },
    }));
    const agent = createMockAgent(createRecordMock);
    const conn = startResponseWatcher(agent, "did:plc:provider", "did:plc:bot", mockDiceBlobs());

    const ws = MockWebSocket.instances[0];
    ws.sendMessage({
      did: "did:plc:provider",
      time_us: 1000,
      kind: "commit",
      commit: {
        rev: "rev1",
        operation: "create",
        collection: "dev.chrispardy.atrand.response",
        rkey: "rkey1",
        cid: "bafyrespcid",
        record: {
          subject: {
            uri: "at://did:plc:user/app.bsky.feed.post/post1",
            cid: "bafypostcid",
          },
          rfe: {
            uri: "at://did:plc:otherbot/dev.chrispardy.atrand.rfe/rfe1",
            cid: "bafyrfecid",
          },
          values: [4, 2],
          createdAt: new Date().toISOString(),
        },
      },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(createRecordMock).not.toHaveBeenCalled();
    conn.close();
  });
});

function createMockAgent(createRecordMock?: any) {
  return {
    session: { did: "did:plc:bot" },
    com: {
      atproto: {
        repo: {
          createRecord: createRecordMock || mock(async () => ({
            data: { uri: "at://did:plc:bot/col/rkey", cid: "cid" },
          })),
        },
      },
    },
  } as any;
}
