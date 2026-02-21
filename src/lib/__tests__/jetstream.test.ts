import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { connectJetstream, type JetstreamEvent } from "../jetstream";

// Mock WebSocket
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

  close() {
    this.emit("close", {});
  }

  emit(event: string, data: any) {
    for (const handler of this.listeners[event] || []) {
      handler(data);
    }
  }

  sendMessage(event: JetstreamEvent) {
    this.emit("message", { data: JSON.stringify(event) });
  }
}

describe("connectJetstream", () => {
  let originalWebSocket: any;

  beforeEach(() => {
    MockWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  test("connects with wanted collections in URL", () => {
    const onEvent = mock(() => {});
    const conn = connectJetstream({
      wantedCollections: ["dev.chrispardy.atrand.rfe"],
      onEvent,
    });

    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain("wantedCollections=dev.chrispardy.atrand.rfe");
    conn.close();
  });

  test("includes wantedDids in URL", () => {
    const onEvent = mock(() => {});
    const conn = connectJetstream({
      wantedCollections: ["col"],
      wantedDids: ["did:plc:abc"],
      onEvent,
    });

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain("wantedDids=did%3Aplc%3Aabc");
    conn.close();
  });

  test("calls onEvent with parsed messages", async () => {
    const events: JetstreamEvent[] = [];
    const onEvent = mock((e: JetstreamEvent) => { events.push(e); });
    const conn = connectJetstream({
      wantedCollections: ["col"],
      onEvent,
    });

    const ws = MockWebSocket.instances[0];
    const testEvent: JetstreamEvent = {
      did: "did:plc:test",
      time_us: 12345,
      kind: "commit",
      commit: {
        rev: "rev1",
        operation: "create",
        collection: "col",
        rkey: "abc",
        record: { text: "hello" },
        cid: "bafycid",
      },
    };
    ws.sendMessage(testEvent);

    // Wait for async handler
    await new Promise((r) => setTimeout(r, 10));
    expect(events.length).toBe(1);
    expect(events[0].did).toBe("did:plc:test");
    conn.close();
  });

  test("calls onError on parse failure", async () => {
    const errors: Error[] = [];
    const conn = connectJetstream({
      wantedCollections: ["col"],
      onEvent: () => {},
      onError: (e) => errors.push(e),
    });

    const ws = MockWebSocket.instances[0];
    ws.emit("message", { data: "not json{" });
    await new Promise((r) => setTimeout(r, 10));
    expect(errors.length).toBe(1);
    conn.close();
  });

  test("close prevents reconnection", async () => {
    const conn = connectJetstream({
      wantedCollections: ["col"],
      onEvent: () => {},
    });

    expect(MockWebSocket.instances.length).toBe(1);
    conn.close();
    // Wait for potential reconnect
    await new Promise((r) => setTimeout(r, 100));
    // Should not have created a new connection after close
    expect(MockWebSocket.instances.length).toBe(1);
  });
});
