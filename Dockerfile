FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY . .
RUN corepack pnpm install --frozen-lockfile
RUN corepack pnpm build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app

CMD ["corepack", "pnpm", "--filter", "@integrador/api", "start"]
