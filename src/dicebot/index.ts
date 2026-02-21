import { createAgent } from "../lib/pds";
import { createLogger } from "../lib/logger";
import { uploadDiceImages } from "./dice";
import { startPostWatcher } from "./posts";
import { startResponseWatcher } from "./responses";

const log = createLogger("dicebot");

async function main() {
  const config = {
    service: process.env.DICEBOT_ATP_SERVICE || "https://bsky.social",
    identifier: process.env.DICEBOT_ATP_IDENTIFIER || "",
    password: process.env.DICEBOT_ATP_PASSWORD || "",
  };
  const providerDid = process.env.PROVIDER_DID || "";

  if (!config.identifier || !config.password) {
    log.fatal("DICEBOT_ATP_IDENTIFIER and DICEBOT_ATP_PASSWORD are required");
    process.exit(1);
  }
  if (!providerDid) {
    log.fatal("PROVIDER_DID is required");
    process.exit(1);
  }

  const agent = await createAgent(config);
  const botDid = agent.session!.did;
  log.info({ did: botDid }, "logged in");

  const diceBlobs = await uploadDiceImages(agent);
  log.info("dice images ready");

  const postWatcher = startPostWatcher(agent);
  log.info("post watcher started");

  const responseWatcher = startResponseWatcher(agent, providerDid, botDid, diceBlobs);
  log.info("response watcher started");

  process.on("SIGINT", () => {
    postWatcher.close();
    responseWatcher.close();
    process.exit(0);
  });
}

main().catch((err) => {
  log.fatal({ err }, "fatal error");
  process.exit(1);
});
