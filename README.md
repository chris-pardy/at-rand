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

## Implementing your own entropy provider

The protocol is designed so anyone can run their own entropy provider with any randomness source — drand, hardware RNG, physical dice, coin flips, etc. Your provider just needs to do two things: watch for RFEs and write response records.

### Protocol overview

```
Client                              Provider
  │                                    │
  ├─ writes RFE to own PDS ──────────>│ (firehose or XRPC)
  │                                    │
  │                                    ├─ reads RFE from client's PDS
  │                                    ├─ generates random values
  │                                    ├─ writes response to own PDS
  │<────────────────────────────────── │
  │                                    │
  └─ reads response from provider's PDS
```

### Records

**RFE** (`dev.chrispardy.atrand.rfe`) — written by the client:

```json
{
  "subject": { "uri": "at://did:plc:user/app.example.game/abc", "cid": "bafy..." },
  "requests": [
    { "min": 1, "max": 6 },
    { "min": 1, "max": 6 }
  ],
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

The rkey is `SHA-256(subject_uri + "#" + subject_cid)` in hex. This makes it deterministic — the same subject always maps to the same rkey, preventing re-rolls.

**Response** (`dev.chrispardy.atrand.response`) — written by the provider:

```json
{
  "subject": { "uri": "at://did:plc:user/app.example.game/abc", "cid": "bafy..." },
  "rfe": { "uri": "at://did:plc:user/dev.chrispardy.atrand.rfe/abc123", "cid": "bafy..." },
  "values": [3, 5],
  "provenance": { "type": "drand", "round": 12345 },
  "createdAt": "2025-01-01T00:00:01.000Z"
}
```

The response uses the **same rkey** as the RFE. `values` contains one integer per request, each within the specified `[min, max]` range. `provenance` is optional and its structure is up to you — use it to provide proof of how the randomness was generated.

### What your provider needs to do

1. **Watch for RFEs** — subscribe to the AT Protocol firehose filtered for `dev.chrispardy.atrand.rfe` records, or expose an XRPC endpoint (`dev.chrispardy.atrand.getResponse`) that accepts an RFE AT-URI
2. **Read the RFE** — fetch the record from the client's PDS to get the subject and requests
3. **Derive the rkey** — `SHA-256(subject_uri + "#" + subject_cid)` as a hex string
4. **Check for existing response** — look up your own PDS for a response with that rkey. If one exists, return it (anti-re-roll)
5. **Generate random values** — using whatever randomness source you want, generate one integer per request within `[min, max]` inclusive
6. **Write the response** — put a `dev.chrispardy.atrand.response` record in your PDS with the derived rkey

### XRPC endpoint (optional)

If you want to support on-demand requests, expose `dev.chrispardy.atrand.getResponse` as an HTTP endpoint:

```
GET /xrpc/dev.chrispardy.atrand.getResponse?uri=at://did:plc:user/dev.chrispardy.atrand.rfe/abc123
```

Returns the response record as JSON, generating it first if it doesn't exist.

## Lexicons

- `dev.chrispardy.atrand.rfe` — Request for entropy record
- `dev.chrispardy.atrand.response` — Entropy response record
- `dev.chrispardy.atrand.getResponse` — XRPC query to get/generate a response
