# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
# pnpm via corepack (Node 20 já inclui corepack)
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile || pnpm install; else pnpm install; fi
COPY . .
RUN pnpm exec prisma generate || true

# ---- Development (hot reload) ----
FROM base AS development
ENV NODE_ENV=development
EXPOSE 3001
# pnpm start:dev faz hot reload; volume montado via compose sobrepõe /app
CMD ["pnpm", "run", "start:dev"]

# ---- Production build ----
FROM base AS build
RUN pnpm run build && pnpm prune --prod

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/prisma ./prisma
EXPOSE 3001
# Nest compila para dist/src/* (sourceRoot = src); cobre ambos os layouts
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
