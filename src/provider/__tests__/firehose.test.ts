import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import type { JetstreamEvent } from "../../lib/jetstream";

// Mock WebSocket for jetstream
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

describe("startFirehose", () => {
  let originalWebSocket: any;

  beforeEach(() => {
    MockWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  test("subscribes to RFE collection", async () => {
    const { startFirehose } = await import("../firehose");
    const agent = {
      session: { did: "did:plc:provider" },
      com: {
        atproto: {
          repo: {
            getRecord: mock(async () => { throw { status: 404 }; }),
            putRecord: mock(async () => ({
              data: { uri: "at://did:plc:provider/col/rkey", cid: "cid" },
            })),
          },
        },
      },
    } as any;

    const conn = startFirehose(agent);
    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toContain("dev.chrispardy.atrand.rfe");
    conn.close();
  });

  test("handles create events", async () => {
    const { startFirehose } = await import("../firehose");
    const putMock = mock(async () => ({
      data: { uri: "at://did:plc:provider/col/rkey", cid: "cid" },
    }));
    const agent = {
      session: { did: "did:plc:provider" },
      com: {
        atproto: {
          repo: {
            getRecord: mock(async () => { throw { status: 404 }; }),
            putRecord: putMock,
          },
        },
      },
    } as any;

    const conn = startFirehose(agent);
    const ws = MockWebSocket.instances[0];

    ws.sendMessage({
      did: "did:plc:user",
      time_us: 1000,
      kind: "commit",
      commit: {
        rev: "rev1",
        operation: "create",
        collection: "dev.chrispardy.atrand.rfe",
        rkey: "abc123",
        cid: "bafyrfecid",
        record: {
          subject: {
            uri: "at://did:plc:user/app.bsky.feed.post/post1",
            cid: "bafypostcid",
          },
          requests: [{ min: 1, max: 6 }],
          createdAt: new Date().toISOString(),
        },
      },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(putMock).toHaveBeenCalled();
    conn.close();
  });

  test("ignores non-create events", async () => {
    const { startFirehose } = await import("../firehose");
    const putMock = mock(async () => ({
      data: { uri: "at://did:plc:provider/col/rkey", cid: "cid" },
    }));
    const agent = {
      session: { did: "did:plc:provider" },
      com: {
        atproto: {
          repo: {
            getRecord: mock(async () => { throw { status: 404 }; }),
            putRecord: putMock,
          },
        },
      },
    } as any;

    const conn = startFirehose(agent);
    const ws = MockWebSocket.instances[0];

    ws.sendMessage({
      did: "did:plc:user",
      time_us: 1000,
      kind: "commit",
      commit: {
        rev: "rev1",
        operation: "delete",
        collection: "dev.chrispardy.atrand.rfe",
        rkey: "abc123",
      },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(putMock).not.toHaveBeenCalled();
    conn.close();
  });
});
