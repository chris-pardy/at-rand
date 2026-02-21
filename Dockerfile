# Build stage
FROM oven/bun AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
COPY assets ./assets
COPY tsconfig.json ./
RUN bun build src/provider/index.ts --compile --outfile provider
RUN bun build src/dicebot/index.ts --compile --outfile dicebot

# Runtime stage
FROM debian:bookworm-slim
COPY --from=build /app/provider /usr/local/bin/provider
COPY --from=build /app/dicebot /usr/local/bin/dicebot
COPY --from=build /app/assets/dice /usr/local/assets/dice
