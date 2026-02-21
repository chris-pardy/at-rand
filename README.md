# at:rand

AT Protocol Entropy Exchange — a system for exchanging random numbers over the AT Protocol.

Players submit "requests for entropy" (RFEs) in their own PDS pointing at a subject record (e.g. game state), and a trusted entropy provider watches the firehose and responds with random values. The key property: you can't re-roll — once entropy is generated for a given subject, updating or resubmitting the RFE won't produce new values.

## How it works

1. A client creates an RFE record (`dev.chrispardy.atrand.rfe`) in their PDS, referencing a subject record and specifying ranges (e.g. `{min: 1, max: 6}`)
2. The RFE rkey is a SHA-256 hash of `${subject_uri}#${subject_cid}`, making it deterministic and preventing re-rolls
3. The entropy provider watches the firehose, generates random values, and writes a response record (`dev.chrispardy.atrand.response`) with the same rkey
4. Responses can also be requested on-demand via the XRPC endpoint `dev.chrispardy.atrand.getResponse`

## Project structure

```
lexicons/           Lexicon definitions (RFE, response, XRPC query)
src/lib/            Shared code (rkey derivation, PDS helpers, Jetstream client)
src/provider/       Entropy provider service
src/dicebot/        Demo dice bot for Bluesky
assets/dice/        Dice face images for the bot
```

## Setup

```sh
bun install
cp .env.example .env.local
# Fill in your credentials in .env.local
```

## Running the entropy provider

Most users will only need the provider. It watches the firehose for RFE records and responds with random values, and exposes an XRPC endpoint for on-demand requests.

```sh
bun run provider
```

**Environment variables:**

| Variable | Description |
|---|---|
| `PROVIDER_ATP_SERVICE` | PDS URL (default: `https://bsky.social`) |
| `PROVIDER_ATP_IDENTIFIER` | Handle or DID of the provider account |
| `PROVIDER_ATP_PASSWORD` | App password |
| `PROVIDER_PORT` | HTTP port for XRPC endpoint (default: `3100`) |

## Running the dice bot (optional)

The dice bot is a demo that watches Bluesky for posts containing phrases like "roll the dice" or "roll a die", creates RFEs, and replies with dice face images when the provider responds. It's included as a reference implementation — you don't need to run it to use the entropy provider.

```sh
bun run dicebot
```

**Additional environment variables:**

| Variable | Description |
|---|---|
| `DICEBOT_ATP_SERVICE` | PDS URL (default: `https://bsky.social`) |
| `DICEBOT_ATP_IDENTIFIER` | Handle or DID of the dice bot account |
| `DICEBOT_ATP_PASSWORD` | App password |
| `PROVIDER_DID` | DID of the entropy provider to watch for responses |

## Tests

```sh
bun test
```

## Deployment

Both services can run in a single Fly.io app using process groups. See `fly.toml` and `Dockerfile` for the configuration. The Dockerfile uses `bun build --compile` to produce standalone executables.

```sh
fly secrets set PROVIDER_ATP_IDENTIFIER=... PROVIDER_ATP_PASSWORD=... # etc
fly deploy
```

## Lexicons

- `dev.chrispardy.atrand.rfe` — Request for entropy record
- `dev.chrispardy.atrand.response` — Entropy response record
- `dev.chrispardy.atrand.getResponse` — XRPC query to get/generate a response
