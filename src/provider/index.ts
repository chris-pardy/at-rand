import { createAgent } from "../lib/pds";
import { getRecord } from "../lib/pds";
import { createLogger } from "../lib/logger";
import { handleRfe, type RfeRecord } from "./entropy";
import { startFirehose } from "./firehose";

const log = createLogger("provider");
const RFE_COLLECTION = "dev.chrispardy.atrand.rfe";

async function main() {
  const config = {
    service: process.env.PROVIDER_ATP_SERVICE || "https://bsky.social",
    identifier: process.env.PROVIDER_ATP_IDENTIFIER || "",
    password: process.env.PROVIDER_ATP_PASSWORD || "",
  };

  if (!config.identifier || !config.password) {
    log.fatal("PROVIDER_ATP_IDENTIFIER and PROVIDER_ATP_PASSWORD are required");
    process.exit(1);
  }

  const agent = await createAgent(config);
  log.info({ did: agent.session!.did }, "logged in");

  const firehose = startFirehose(agent);
  log.info("firehose watcher started");

  const port = parseInt(process.env.PROVIDER_PORT || "3100", 10);
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/xrpc/dev.chrispardy.atrand.getResponse") {
        return handleGetResponse(url, agent);
      }

      return new Response(JSON.stringify({ error: "NotFound" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  log.info({ port: server.port }, "xrpc server listening");

  process.on("SIGINT", () => {
    firehose.close();
    server.stop();
    process.exit(0);
  });
}

async function handleGetResponse(url: URL, agent: import("@atproto/api").AtpAgent) {
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

  if (collection !== RFE_COLLECTION) {
    return new Response(
      JSON.stringify({ error: "InvalidRfe", message: "URI does not point to an RFE record" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const rfeRecord = await getRecord(agent, repo, collection, rkey);
  if (!rfeRecord) {
    log.warn({ rfeUri }, "rfe not found");
    return new Response(
      JSON.stringify({ error: "RfeNotFound", message: "RFE record not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    log.info({ rfeUri }, "xrpc getResponse request");
    const response = await handleRfe(
      agent,
      rfeRecord.uri,
      rfeRecord.cid,
      rfeRecord.value as unknown as RfeRecord
    );
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    log.error({ err, rfeUri }, "error handling xrpc request");
    return new Response(
      JSON.stringify({ error: "InternalError", message: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

main().catch((err) => {
  log.fatal({ err }, "fatal error");
  process.exit(1);
});
