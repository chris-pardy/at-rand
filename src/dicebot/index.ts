import { createAgent } from "../lib/pds";
import { uploadDiceImages } from "./dice";
import { startPostWatcher } from "./posts";
import { startResponseWatcher } from "./responses";

async function main() {
  const config = {
    service: process.env.DICEBOT_ATP_SERVICE || "https://bsky.social",
    identifier: process.env.DICEBOT_ATP_IDENTIFIER || "",
    password: process.env.DICEBOT_ATP_PASSWORD || "",
  };
  const providerDid = process.env.PROVIDER_DID || "";

  if (!config.identifier || !config.password) {
    console.error("DICEBOT_ATP_IDENTIFIER and DICEBOT_ATP_PASSWORD are required");
    process.exit(1);
  }
  if (!providerDid) {
    console.error("PROVIDER_DID is required");
    process.exit(1);
  }

  const agent = await createAgent(config);
  const botDid = agent.session!.did;
  console.log(`Dice bot logged in as ${botDid}`);

  const diceBlobs = await uploadDiceImages(agent);
  console.log("Dice images uploaded");

  const postWatcher = startPostWatcher(agent);
  console.log("Post watcher started");

  const responseWatcher = startResponseWatcher(agent, providerDid, botDid, diceBlobs);
  console.log("Response watcher started");

  process.on("SIGINT", () => {
    postWatcher.close();
    responseWatcher.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
