import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";

describe("XRPC endpoint", () => {
  test("returns 400 for missing uri param", async () => {
    const res = await buildHandler({}).fetch(
      new Request("http://localhost/xrpc/dev.chrispardy.atrand.getResponse")
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("InvalidRequest");
  });

  test("returns 400 for invalid AT-URI", async () => {
    const res = await buildHandler({}).fetch(
      new Request("http://localhost/xrpc/dev.chrispardy.atrand.getResponse?uri=not-a-uri")
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for non-RFE collection URI", async () => {
    const res = await buildHandler({}).fetch(
      new Request(
        "http://localhost/xrpc/dev.chrispardy.atrand.getResponse?uri=at://did:plc:abc/app.bsky.feed.post/123"
      )
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("InvalidRfe");
  });

  test("returns 404 when RFE not found", async () => {
    const handler = buildHandler({ getRecordResult: null });
    const res = await handler.fetch(
      new Request(
        "http://localhost/xrpc/dev.chrispardy.atrand.getResponse?uri=at://did:plc:abc/dev.chrispardy.atrand.rfe/abc123"
      )
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("RfeNotFound");
  });

  test("returns response for valid RFE", async () => {
    const rfeValue = {
      subject: {
        uri: "at://did:plc:user/app.bsky.feed.post/post1",
        cid: "bafypostcid",
      },
      requests: [{ min: 1, max: 6 }],
      createdAt: new Date().toISOString(),
    };
    const handler = buildHandler({
      getRecordResult: {
        uri: "at://did:plc:abc/dev.chrispardy.atrand.rfe/abc123",
        cid: "bafyrfecid",
        value: rfeValue,
      },
    });
    const res = await handler.fetch(
      new Request(
        "http://localhost/xrpc/dev.chrispardy.atrand.getResponse?uri=at://did:plc:abc/dev.chrispardy.atrand.rfe/abc123"
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.values).toBeDefined();
    expect(body.values.length).toBe(1);
    expect(body.subject).toEqual(rfeValue.subject);
  });

  test("returns 404 for unknown paths", async () => {
    const res = await buildHandler({}).fetch(
      new Request("http://localhost/xrpc/unknown.method")
    );
    expect(res.status).toBe(404);
  });
});

// Helper to build the request handler with mocked dependencies
function buildHandler(opts: {
  getRecordResult?: { uri: string; cid: string; value: any } | null;
}) {
  const did = "did:plc:provider";
  let getRecordCallCount = 0;

  const agent = {
    session: { did },
    com: {
      atproto: {
        repo: {
          getRecord: mock(async ({ repo, collection, rkey }: any) => {
            getRecordCallCount++;
            // First call: fetch the RFE; second call: check existing response
            if (collection === "dev.chrispardy.atrand.response") {
              throw { status: 404 };
            }
            if (opts.getRecordResult === null || opts.getRecordResult === undefined) {
              throw { status: 404 };
            }
            return { data: opts.getRecordResult };
          }),
          putRecord: mock(async () => ({
            data: { uri: `at://${did}/dev.chrispardy.atrand.response/rkey`, cid: "bafynew" },
          })),
        },
      },
    },
  } as any;

  return {
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      if (url.pathname === "/xrpc/dev.chrispardy.atrand.getResponse") {
        return handleGetResponse(url, agent);
      }

      return new Response(JSON.stringify({ error: "NotFound" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}

// Inline the handler logic for testing (avoids starting actual server)
async function handleGetResponse(url: URL, agent: any) {
  const { getRecord } = await import("../../lib/pds");
  const { handleRfe } = await import("../entropy");

  const rfeUri = url.searchParams.get("uri");
  if (!rfeUri) {
    return new Response(
      JSON.stringify({ error: "InvalidRequest", message: "Missing 'uri' parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const match = rfeUri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) {
    return new Response(
      JSON.stringify({ error: "InvalidRequest", message: "Invalid AT-URI format" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const [, repo, collection, rkey] = match;

  if (collection !== "dev.chrispardy.atrand.rfe") {
    return new Response(
      JSON.stringify({ error: "InvalidRfe", message: "URI does not point to an RFE record" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const rfeRecord = await getRecord(agent, repo, collection, rkey);
  if (!rfeRecord) {
    return new Response(
      JSON.stringify({ error: "RfeNotFound", message: "RFE record not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const response = await handleRfe(agent, rfeRecord.uri, rfeRecord.cid, rfeRecord.value as any);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "InternalError", message: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
