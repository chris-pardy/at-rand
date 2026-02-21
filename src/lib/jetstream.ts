const JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe";
const RECONNECT_DELAY_MS = 3000;

export interface JetstreamEvent {
  did: string;
  time_us: number;
  kind: "commit" | "identity" | "account";
  commit?: {
    rev: string;
    operation: "create" | "update" | "delete";
    collection: string;
    rkey: string;
    record?: Record<string, unknown>;
    cid?: string;
  };
}

export interface JetstreamOptions {
  wantedCollections: string[];
  wantedDids?: string[];
  onEvent: (event: JetstreamEvent) => void | Promise<void>;
  onError?: (error: Error) => void;
  cursor?: number;
}

export function connectJetstream(options: JetstreamOptions): { close: () => void } {
  let ws: WebSocket | null = null;
  let closed = false;
  let cursor = options.cursor;

  function buildUrl(): string {
    const url = new URL(JETSTREAM_URL);
    for (const col of options.wantedCollections) {
      url.searchParams.append("wantedCollections", col);
    }
    if (options.wantedDids) {
      for (const did of options.wantedDids) {
        url.searchParams.append("wantedDids", did);
      }
    }
    if (cursor !== undefined) {
      url.searchParams.set("cursor", String(cursor));
    }
    return url.toString();
  }

  function connect() {
    if (closed) return;

    ws = new WebSocket(buildUrl());

    ws.addEventListener("message", async (msg) => {
      try {
        const event: JetstreamEvent = JSON.parse(
          typeof msg.data === "string" ? msg.data : new TextDecoder().decode(msg.data as ArrayBuffer)
        );
        cursor = event.time_us;
        await options.onEvent(event);
      } catch (err) {
        options.onError?.(err as Error);
      }
    });

    ws.addEventListener("error", (evt) => {
      options.onError?.(new Error(`WebSocket error: ${evt}`));
    });

    ws.addEventListener("close", () => {
      if (!closed) {
        setTimeout(connect, RECONNECT_DELAY_MS);
      }
    });
  }

  connect();

  return {
    close() {
      closed = true;
      ws?.close();
    },
  };
}
